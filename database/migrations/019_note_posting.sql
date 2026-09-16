-- Migration 019: Debit Note and Credit Note atomic posting
-- Debit Note (purchase return): reverses stock inward, DR Party / CR Purchases
-- Credit Note (sale return):    reverses stock outward, DR Sales / CR Party
-- Run on Supabase: psql $DATABASE_URL -f 019_note_posting.sql

create or replace function public.erp_post_note(
  p_kind           text,
  p_organization_id uuid,
  p_financial_year_id uuid,
  p_document       jsonb,
  p_actor_auth_id  uuid    default null,
  p_actor_email    text    default null,
  p_request_id     uuid    default null
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_party_id       uuid;
  v_invoice_id     uuid;
  v_voucher_id     uuid;
  v_party_account  uuid;
  v_trade_account  uuid;
  v_tax_account    uuid;
  v_line           jsonb;
  v_item           public.items%rowtype;
  v_batch_id       uuid;
  v_warehouse_id   uuid;

  v_number  text    := nullif(trim(p_document->>'id'), '');
  v_date    date    := coalesce(nullif(p_document->>'date', '')::date, current_date);

  v_subtotal  numeric(14,2) := 0;
  v_discount  numeric(14,2) := 0;
  v_tax       numeric(14,2) := 0;
  v_unrounded numeric(14,2) := 0;
  v_total     numeric(14,2);
  v_rounding  numeric(14,2);

  v_qty          numeric(14,3);
  v_free         numeric(14,3);
  v_rate         numeric(14,2);
  v_disc_rate    numeric(7,4);
  v_gst          numeric(7,4);
  v_gross        numeric(14,2);
  v_discount_line numeric(14,2);
  v_taxable      numeric(14,2);
  v_tax_line     numeric(14,2);
  v_line_total   numeric(14,2);
begin
  if p_kind not in ('debit_note', 'credit_note') then
    raise exception 'Unsupported note kind. Use debit_note or credit_note.';
  end if;
  if v_number is null or jsonb_array_length(coalesce(p_document->''lines'', ''[]''::jsonb)) = 0 then
    raise exception ''Note number and at least one line are required.'';
  end if;

  perform public.erp_assert_open_period(p_organization_id, v_date);

  select id into v_party_id from public.parties
  where organization_id = p_organization_id
    and lower(legal_name) = lower(trim(p_document->>''party''))
    and not is_blocked limit 1;
  if v_party_id is null then raise exception ''Active party was not found.''; end if;

  select id into v_warehouse_id from public.warehouses
  where organization_id = p_organization_id and is_active
  order by (code = ''MAIN'') desc, code limit 1;
  if v_warehouse_id is null then raise exception ''An active warehouse is required.''; end if;

  for v_line in select value from jsonb_array_elements(p_document->''lines'') loop
    select * into v_item from public.items
    where organization_id = p_organization_id and is_active
      and (lower(name) = lower(trim(v_line->>''name'')) or code = trim(v_line->>''itemCode'')) limit 1;
    if v_item.id is null then raise exception ''Active item % was not found.'', coalesce(v_line->>''name'', v_line->>''itemCode''); end if;
    v_qty := coalesce((v_line->>''qty'')::numeric,0); v_free := coalesce((v_line->>''freeQty'')::numeric,0);
    v_rate := coalesce((v_line->>''rate'')::numeric,0); v_disc_rate := coalesce((v_line->>''discount'')::numeric,0); v_gst := coalesce((v_line->>''gstRate'')::numeric,0);
    if v_qty <= 0 or v_free < 0 or v_rate < 0 or v_disc_rate not between 0 and 100 or v_gst not between 0 and 100 then raise exception ''Invalid qty/rate/disc/gst for %.'', v_item.name; end if;
    v_gross := round(v_qty*v_rate,2); v_discount_line := round(v_gross*v_disc_rate/100,2); v_taxable := v_gross-v_discount_line; v_tax_line := round(v_taxable*v_gst/100,2); v_line_total := v_taxable+v_tax_line;
    v_subtotal := v_subtotal+v_gross; v_discount := v_discount+v_discount_line; v_tax := v_tax+v_tax_line; v_unrounded := v_unrounded+v_line_total;
  end loop;
  v_total := coalesce(nullif(p_document->>''grandTotal'','''')::numeric, round(v_unrounded,0));
  v_rounding := round(v_total-v_unrounded,2);
  if abs(v_rounding) > 1 then raise exception ''Rounding adjustment cannot exceed one currency unit.''; end if;

  select id into v_party_account from public.chart_of_accounts where organization_id=p_organization_id and party_id=v_party_id;
  if v_party_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group,party_id) values(p_organization_id,''PTY-''||substr(md5(v_party_id::text),1,12),(select legal_name from public.parties where id=v_party_id),''party'',case when p_kind=''credit_note'' then ''Sundry Debtors'' else ''Sundry Creditors'' end,v_party_id) returning id into v_party_account; end if;
  select id into v_trade_account from public.chart_of_accounts where organization_id=p_organization_id and name=case when p_kind=''credit_note'' then ''Sales'' else ''Purchases'' end limit 1;
  if v_trade_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,case when p_kind=''credit_note'' then ''SALES'' else ''PURCHASES'' end,case when p_kind=''credit_note'' then ''Sales'' else ''Purchases'' end,case when p_kind=''credit_note'' then ''income'' else ''expense'' end,case when p_kind=''credit_note'' then ''Sales Accounts'' else ''Purchase Accounts'' end) returning id into v_trade_account; end if;
  if v_tax > 0 then select id into v_tax_account from public.chart_of_accounts where organization_id=p_organization_id and name=case when p_kind=''credit_note'' then ''Output GST'' else ''Input GST'' end limit 1; if v_tax_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,case when p_kind=''credit_note'' then ''OUTPUT-GST'' else ''INPUT-GST'' end,case when p_kind=''credit_note'' then ''Output GST'' else ''Input GST'' end,case when p_kind=''credit_note'' then ''liability'' else ''asset'' end,''Duties & Taxes'') returning id into v_tax_account; end if; end if;

  insert into public.business_documents(organization_id,document_type,document_number,document_date,status,total,details)
  values(p_organization_id,case when p_kind=''credit_note'' then ''sale_return'' else ''purchase_return'' end,v_number,v_date,''posted'',v_total,p_document) returning id into v_invoice_id;

  for v_line in select value from jsonb_array_elements(p_document->''lines'') loop
    select * into v_item from public.items where organization_id=p_organization_id and is_active and(lower(name)=lower(trim(v_line->>''name'')) or code=trim(v_line->>''itemCode'')) limit 1;
    v_qty:=coalesce((v_line->>''qty'')::numeric,0); v_free:=coalesce((v_line->>''freeQty'')::numeric,0);
    select id into v_batch_id from public.item_batches where item_id=v_item.id and batch_number=coalesce(nullif(trim(v_line->>''batch''),''''),''UNSPECIFIED'');
    if v_batch_id is null then insert into public.item_batches(item_id,batch_number,expiry_on,mrp) values(v_item.id,coalesce(nullif(trim(v_line->>''batch''),''''),''UNSPECIFIED''),nullif(v_line->>''expiry'','''')::date,coalesce(nullif(v_line->>''mrp'','''')::numeric,v_item.mrp)) returning id into v_batch_id; end if;
    insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,occurred_at,source_type,source_id) values(p_organization_id,v_batch_id,v_warehouse_id,case when p_kind=''credit_note'' then ''sale_return''::movement_type else ''purchase_return''::movement_type end,case when p_kind=''credit_note'' then (v_qty+v_free) else -(v_qty+v_free) end,v_date::timestamptz,p_kind,v_invoice_id);
  end loop;

  insert into public.vouchers(organization_id,financial_year_id,voucher_type,voucher_number,voucher_date,status,narration) values(p_organization_id,p_financial_year_id,case when p_kind=''credit_note'' then ''credit_note''::voucher_type else ''debit_note''::voucher_type end,v_number,v_date,''posted'',case when p_kind=''credit_note'' then ''Credit Note '' else ''Debit Note '' end||v_number) returning id into v_voucher_id;
  if p_kind=''credit_note'' then
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_trade_account,v_subtotal-v_discount,0,''Sales return — ''||v_number),(v_voucher_id,v_party_account,0,v_total,''Credit note — ''||v_number);
    if v_tax>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,v_tax,0,''Output GST reversal''); end if;
  else
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_party_account,v_total,0,''Debit note — ''||v_number),(v_voucher_id,v_trade_account,0,v_subtotal-v_discount,''Purchase return — ''||v_number);
    if v_tax>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,0,v_tax,''Input GST reversal''); end if;
  end if;
  if v_rounding<>0 then select id into v_tax_account from public.chart_of_accounts where organization_id=p_organization_id and name=''Rounding Adjustment'' limit 1; if v_tax_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,''ROUNDING'',''Rounding Adjustment'',''general'',''Indirect Expenses'') returning id into v_tax_account; end if; if (p_kind=''credit_note'' and v_rounding>0) or (p_kind=''debit_note'' and v_rounding<0) then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,0,abs(v_rounding),''Rounding''); else insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,abs(v_rounding),0,''Rounding''); end if; end if;
  insert into public.audit_logs(organization_id,entity_type,entity_id,action,after_state,actor_auth_id,actor_email,request_id,metadata) values(p_organization_id,p_kind,v_invoice_id,''posted'',jsonb_build_object(''number'',v_number,''total'',v_total),p_actor_auth_id,p_actor_email,p_request_id,jsonb_build_object(''source'',''erp_post_note''));
  return jsonb_build_object(''id'',v_number,''recordId'',v_invoice_id,''date'',v_date,''subtotal'',v_subtotal,''discountTotal'',v_discount,''taxTotal'',v_tax,''roundingAdjustment'',v_rounding,''total'',v_total,''status'',''posted'');
end;
$$;

revoke execute on function public.erp_post_note(text,uuid,uuid,jsonb,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.erp_post_note(text,uuid,uuid,jsonb,uuid,text,uuid) to service_role;
