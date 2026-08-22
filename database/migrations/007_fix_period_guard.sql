-- The generic period trigger must resolve the date column dynamically because
-- trigger records for different tables do not share the same date fields.
create or replace function public.erp_guard_document_period()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_date_key text; v_date date;
begin
  v_date_key := case tg_table_name
    when 'vouchers' then 'voucher_date'
    when 'sales_invoices' then 'invoice_date'
    when 'purchase_invoices' then 'invoice_date'
    when 'inventory_adjustments' then 'adjustment_date'
    else null
  end;
  if v_date_key is null then raise exception 'Unsupported accounting document table: %', tg_table_name; end if;
  v_date := (to_jsonb(new)->>v_date_key)::date;
  perform public.erp_assert_open_period((to_jsonb(new)->>'organization_id')::uuid, v_date);
  return new;
end;
$$;
