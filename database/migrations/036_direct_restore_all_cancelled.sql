-- ============================================================
-- Migration 036: Direct Restore All Cancelled Invoices
-- Restores all cancelled invoices to 'posted' status directly,
-- cleans up cancellation reverse stock movements, and restores vouchers.
-- ============================================================

-- STEP 1: Restore any currently cancelled sales invoices to 'posted'
UPDATE public.sales_invoices
SET
  status              = 'posted',
  cancellation_reason = NULL,
  cancelled_at        = NULL
WHERE
  status = 'cancelled';

-- STEP 2: Restore all linked vouchers back to 'posted'
UPDATE public.vouchers v
SET status = 'posted'
WHERE v.id IN (
  SELECT voucher_id FROM public.sales_invoices
  WHERE status = 'posted'
    AND cancelled_at IS NULL
    AND voucher_id IS NOT NULL
)
AND v.status = 'cancelled';

-- STEP 3: Remove all reverse stock movements created during cancellations
DELETE FROM public.stock_movements
WHERE source_type = 'invoice_cancellation'
  AND source_id IN (
    SELECT id FROM public.sales_invoices
    WHERE status = 'posted'
  );

-- STEP 4: Create erp_restore_invoice RPC function for safe, atomic restoration
CREATE OR REPLACE FUNCTION public.erp_restore_invoice(
  p_kind             text,
  p_organization_id  uuid,
  p_invoice_id       uuid,
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
  v_voucher uuid;
  v_status  text;
BEGIN
  IF p_kind = 'sales' THEN
    SELECT voucher_id, status::text
    INTO   v_voucher, v_status
    FROM   public.sales_invoices
    WHERE  id = p_invoice_id
      AND  organization_id = p_organization_id
    FOR UPDATE;

    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Invoice was not found.';
    END IF;

    -- Remove reverse stock movements created upon cancellation
    DELETE FROM public.stock_movements
    WHERE organization_id = p_organization_id
      AND source_id        = p_invoice_id
      AND source_type      = 'invoice_cancellation';

    -- Restore linked voucher
    IF v_voucher IS NOT NULL THEN
      UPDATE public.vouchers
      SET    status = 'posted'
      WHERE  id = v_voucher
        AND  organization_id = p_organization_id;
    END IF;

    -- Restore invoice status
    UPDATE public.sales_invoices
    SET    status              = 'posted',
           cancellation_reason = NULL,
           cancelled_at        = NULL
    WHERE  id              = p_invoice_id
      AND  organization_id = p_organization_id;

  ELSIF p_kind = 'purchases' THEN
    SELECT voucher_id, status
    INTO   v_voucher, v_status
    FROM   public.purchase_invoices
    WHERE  id = p_invoice_id
      AND  organization_id = p_organization_id
    FOR UPDATE;

    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Invoice was not found.';
    END IF;

    DELETE FROM public.stock_movements
    WHERE organization_id = p_organization_id
      AND source_id        = p_invoice_id
      AND source_type      = 'invoice_cancellation';

    IF v_voucher IS NOT NULL THEN
      UPDATE public.vouchers
      SET    status = 'posted'
      WHERE  id = v_voucher
        AND  organization_id = p_organization_id;
    END IF;

    UPDATE public.purchase_invoices
    SET    status              = 'posted',
           cancellation_reason = NULL,
           cancelled_at        = NULL
    WHERE  id              = p_invoice_id
      AND  organization_id = p_organization_id;
  ELSE
    RAISE EXCEPTION 'Unsupported invoice kind.';
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
    'restored',
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', 'posted'),
    p_actor_auth_id,
    p_actor_email,
    p_request_id,
    jsonb_build_object('stock_restored', true, 'voucher_restored', true)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.erp_restore_invoice(text,uuid,uuid,uuid,text,uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_restore_invoice(text,uuid,uuid,uuid,text,uuid)
  TO service_role;
