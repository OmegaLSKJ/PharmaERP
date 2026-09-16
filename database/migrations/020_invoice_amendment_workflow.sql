create or replace function public.erp_amend_invoice(
  p_kind text,
  p_organization_id uuid,
  p_financial_year_id uuid,
  p_invoice_id uuid,
  p_document jsonb,
  p_reason text,
  p_actor_auth_id uuid default null,
  p_actor_email text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_number text;
  v_status text;
  v_revision integer;
  v_document jsonb;
  v_result jsonb;
begin
  if p_kind = 'sales' then
    select invoice_number, status::text into v_number, v_status
    from public.sales_invoices
    where id = p_invoice_id and organization_id = p_organization_id
    for update;
  elsif p_kind = 'purchases' then
    select invoice_number, status into v_number, v_status
    from public.purchase_invoices
    where id = p_invoice_id and organization_id = p_organization_id
    for update;
  else
    raise exception 'Unsupported invoice kind.';
  end if;

  if v_number is null then raise exception 'Invoice was not found.'; end if;
  if v_status <> 'posted' then raise exception 'Only posted invoices can be amended.'; end if;

  perform public.erp_cancel_invoice(
    p_kind,
    p_organization_id,
    p_invoice_id,
    coalesce(nullif(trim(p_reason), ''), 'Amended by user'),
    p_actor_auth_id,
    p_actor_email,
    p_request_id
  );

  if p_kind = 'sales' then
    select count(*) + 1 into v_revision
    from public.sales_invoices
    where organization_id = p_organization_id
      and invoice_number like v_number || '-R%';
  else
    select count(*) + 1 into v_revision
    from public.purchase_invoices
    where organization_id = p_organization_id
      and invoice_number like v_number || '-R%';
  end if;

  v_document := p_document || jsonb_build_object('id', v_number || '-R' || v_revision);
  v_result := public.erp_post_invoice(
    p_kind,
    p_organization_id,
    p_financial_year_id,
    v_document,
    p_actor_auth_id,
    p_actor_email,
    p_request_id
  );

  insert into public.audit_logs(
    organization_id, entity_type, entity_id, action,
    before_state, after_state, actor_auth_id, actor_email, request_id, metadata
  ) values (
    p_organization_id, p_kind, p_invoice_id, 'amended',
    jsonb_build_object('number', v_number), v_result,
    p_actor_auth_id, p_actor_email, p_request_id,
    jsonb_build_object('replacement_number', v_result->>'id')
  );

  return v_result || jsonb_build_object('amendedInvoiceId', p_invoice_id, 'amendedInvoiceNumber', v_number);
end;
$$;

revoke execute on function public.erp_amend_invoice(text,uuid,uuid,uuid,jsonb,text,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.erp_amend_invoice(text,uuid,uuid,uuid,jsonb,text,uuid,text,uuid) to service_role;
