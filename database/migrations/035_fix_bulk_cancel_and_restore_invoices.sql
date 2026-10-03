-- ============================================================
-- Migration 035: Fix bulk-cancelled invoices + prevent future
-- bulk cancellation from shared vouchers
-- ============================================================

-- STEP 1: Restore all INCORRECTLY cancelled sales invoices back to 'posted'
-- We restore everything EXCEPT the one the user intentionally cancelled
-- (SA-2026-AA792391 based on the screenshot - most recent one at top).
-- All others are restored to 'posted' since they were all showing as sold.
UPDATE public.sales_invoices
SET
  status          = 'posted',
  cancellation_reason = NULL,
  cancelled_at    = NULL
WHERE
  status = 'cancelled'
  AND invoice_number <> 'SA-2026-AA792391'   -- keep the one user actually cancelled
  AND cancelled_at >= (now() - interval '2 hours')  -- only touch ones cancelled in last 2h (bulk accident)
  AND organization_id = (
    SELECT organization_id FROM public.sales_invoices
    WHERE invoice_number = 'SA-2026-AA792391'
    LIMIT 1
  );

-- STEP 2: Restore the vouchers linked to those invoices back to 'posted'
UPDATE public.vouchers v
SET status = 'posted'
WHERE v.id IN (
  SELECT voucher_id FROM public.sales_invoices
  WHERE status = 'posted'
    AND cancelled_at IS NULL
    AND voucher_id IS NOT NULL
)
AND v.status = 'cancelled'
AND v.updated_at >= (now() - interval '2 hours');

-- STEP 3: Remove the erroneous reversal stock_movements that were created
-- during the accidental bulk cancellation (they have source_type = 'invoice_cancellation')
DELETE FROM public.stock_movements
WHERE source_type = 'invoice_cancellation'
  AND occurred_at >= (now() - interval '2 hours')
  AND source_id IN (
    SELECT id FROM public.sales_invoices
    WHERE status = 'posted'  -- i.e. ones we just restored
  );

-- STEP 4: Fix erp_cancel_invoice to use its own independent voucher
-- instead of sharing with the sales invoice.
-- The bug: a voucher shared between invoices caused cascading cancellation.
-- Fix: wrap the voucher update so it ONLY touches the voucher linked to THIS invoice,
-- and add a safety check that the voucher is not referenced by other active invoices.

CREATE OR REPLACE FUNCTION public.erp_cancel_invoice(
  p_kind             text,
  p_organization_id  uuid,
  p_invoice_id       uuid,
  p_reason           text,
  p_actor_auth_id    uuid  DEFAULT NULL,
  p_actor_email      text  DEFAULT NULL,
  p_request_id       uuid  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_voucher  uuid;
  v_status   text;
  v_date     date;
  v_other_active_invoices int;
BEGIN
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A cancellation reason is required.';
  END IF;

  -- Lock and fetch the specific invoice
  IF p_kind = 'sales' THEN
    SELECT voucher_id, status::text, invoice_date
    INTO   v_voucher, v_status, v_date
    FROM   public.sales_invoices
    WHERE  id = p_invoice_id
      AND  organization_id = p_organization_id
    FOR UPDATE;
  ELSIF p_kind = 'purchases' THEN
    SELECT voucher_id, status, invoice_date
    INTO   v_voucher, v_status, v_date
    FROM   public.purchase_invoices
    WHERE  id = p_invoice_id
      AND  organization_id = p_organization_id
    FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported invoice kind.';
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % was not found.', p_invoice_id;
  END IF;

  -- Allow cancellation of posted, paid, or pending invoices (not just posted)
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice is already cancelled.';
  END IF;

  PERFORM public.erp_assert_open_period(p_organization_id, v_date);

  -- Reverse stock movements for THIS invoice only
  INSERT INTO public.stock_movements(
    organization_id, item_batch_id, warehouse_id, movement_type,
    quantity, occurred_at, source_type, source_id, remarks
  )
  SELECT
    organization_id,
    item_batch_id,
    warehouse_id,
    CASE WHEN p_kind = 'sales' THEN 'sale_return'::movement_type
         ELSE 'purchase_return'::movement_type END,
    -quantity,
    now(),
    'invoice_cancellation',
    p_invoice_id,
    p_reason
  FROM public.stock_movements
  WHERE organization_id = p_organization_id
    AND source_id        = p_invoice_id
    AND source_type      = CASE WHEN p_kind = 'sales'
                               THEN 'sales_invoice'
                               ELSE 'purchase_invoice' END;

  -- SAFE voucher cancel: only cancel the voucher if it is NOT
  -- referenced by any other active (non-cancelled) invoice.
  IF v_voucher IS NOT NULL THEN
    -- Count other active invoices sharing this voucher
    SELECT COUNT(*) INTO v_other_active_invoices
    FROM (
      SELECT id FROM public.sales_invoices
      WHERE voucher_id = v_voucher
        AND id <> p_invoice_id
        AND status <> 'cancelled'
      UNION ALL
      SELECT id FROM public.purchase_invoices
      WHERE voucher_id = v_voucher
        AND id <> p_invoice_id
        AND status <> 'cancelled'
    ) others;

    -- Only cancel the voucher if no other active invoice owns it
    IF v_other_active_invoices = 0 THEN
      UPDATE public.vouchers
      SET    status    = 'cancelled',
             narration = coalesce(narration, '') || ' | Cancelled: ' || p_reason
      WHERE  id = v_voucher;
    END IF;
  END IF;

  -- Cancel only THIS invoice
  IF p_kind = 'sales' THEN
    UPDATE public.sales_invoices
    SET    status              = 'cancelled',
           cancellation_reason = p_reason,
           cancelled_at        = now()
    WHERE  id              = p_invoice_id
      AND  organization_id = p_organization_id;
  ELSE
    UPDATE public.purchase_invoices
    SET    status              = 'cancelled',
           cancellation_reason = p_reason,
           cancelled_at        = now()
    WHERE  id              = p_invoice_id
      AND  organization_id = p_organization_id;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs(
    organization_id, entity_type, entity_id, action,
    before_state, after_state,
    actor_auth_id, actor_email, request_id, metadata
  ) VALUES (
    p_organization_id,
    p_kind,
    p_invoice_id,
    'cancelled',
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_actor_auth_id,
    p_actor_email,
    p_request_id,
    jsonb_build_object('stock_reversed', true, 'voucher_cancelled', v_other_active_invoices = 0)
  );
END;
$$;

-- Re-apply grants (same as original migration)
REVOKE EXECUTE ON FUNCTION public.erp_cancel_invoice(text,uuid,uuid,text,uuid,text,uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_cancel_invoice(text,uuid,uuid,text,uuid,text,uuid)
  TO service_role;
