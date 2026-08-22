-- Production hardening: accounting controls, inventory reservations, compliance,
-- atomic posting/import helpers, permissions, audit metadata and live report views.

alter table public.items add column if not exists schedule_class text not null default 'OTC';
alter table public.items add column if not exists prescription_required boolean not null default false;
alter table public.items add column if not exists cold_chain boolean not null default false;
alter table public.items add column if not exists controlled_substance boolean not null default false;
alter table public.items add column if not exists is_recalled boolean not null default false;
alter table public.items drop constraint if exists items_schedule_class_check;
alter table public.items add constraint items_schedule_class_check check (schedule_class in ('OTC','H','H1','X','NDPS'));

alter table public.sales_invoices add column if not exists rounding_adjustment numeric(14,2) not null default 0;
alter table public.sales_invoices add column if not exists cancellation_reason text;
alter table public.sales_invoices add column if not exists cancelled_at timestamptz;
alter table public.purchase_invoices add column if not exists rounding_adjustment numeric(14,2) not null default 0;
alter table public.purchase_invoices add column if not exists cancellation_reason text;
alter table public.purchase_invoices add column if not exists cancelled_at timestamptz;

alter table public.sales_invoice_lines drop constraint if exists sales_invoice_lines_discount_percent_check;
alter table public.sales_invoice_lines add constraint sales_invoice_lines_discount_percent_check check (discount_percent between 0 and 100);
alter table public.sales_invoice_lines drop constraint if exists sales_invoice_lines_gst_rate_check;
alter table public.sales_invoice_lines add constraint sales_invoice_lines_gst_rate_check check (gst_rate between 0 and 100);
alter table public.sales_invoice_lines add constraint sales_invoice_lines_rate_check check (rate >= 0) not valid;
alter table public.purchase_invoice_lines drop constraint if exists purchase_invoice_lines_discount_percent_check;
alter table public.purchase_invoice_lines add constraint purchase_invoice_lines_discount_percent_check check (discount_percent between 0 and 100);
alter table public.purchase_invoice_lines drop constraint if exists purchase_invoice_lines_gst_rate_check;
alter table public.purchase_invoice_lines add constraint purchase_invoice_lines_gst_rate_check check (gst_rate between 0 and 100);

alter table public.audit_logs add column if not exists actor_auth_id uuid;
alter table public.audit_logs add column if not exists actor_email text;
alter table public.audit_logs add column if not exists request_id uuid;
alter table public.audit_logs add column if not exists ip_address inet;
alter table public.audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by_auth_id uuid,
  close_notes text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (organization_id, starts_on, ends_on)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_code text not null check (role_code in ('admin','manager','operator')),
  action text not null,
  allowed boolean not null default true,
  unique (organization_id, role_code, action)
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_batch_id uuid not null references public.item_batches(id),
  warehouse_id uuid not null references public.warehouses(id),
  source_type text not null,
  source_id uuid,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','released','consumed','expired')),
  expires_at timestamptz,
  created_by_auth_id uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  adjustment_number text not null,
  adjustment_date date not null,
  reason text not null,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  created_by_auth_id uuid,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, adjustment_number)
);

create table if not exists public.inventory_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inventory_adjustments(id) on delete cascade,
  item_batch_id uuid not null references public.item_batches(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason text
);

create table if not exists public.drug_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_id uuid references public.parties(id),
  license_number text not null,
  license_type text not null,
  issued_on date,
  expires_on date not null,
  issuing_authority text,
  status text not null default 'active' check (status in ('active','suspended','expired','revoked')),
  document_url text,
  created_at timestamptz not null default now(),
  unique (organization_id, license_number),
  check (issued_on is null or expires_on >= issued_on)
);

create table if not exists public.product_recalls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recall_number text not null,
  manufacturer_id uuid references public.manufacturers(id),
  initiated_on date not null,
  reason text not null,
  severity text not null check (severity in ('class_i','class_ii','class_iii')),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  regulatory_reference text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, recall_number)
);

create table if not exists public.product_recall_batches (
  recall_id uuid not null references public.product_recalls(id) on delete cascade,
  item_batch_id uuid not null references public.item_batches(id),
  action text not null default 'quarantine' check (action in ('quarantine','return','destroy','release')),
  quarantined_quantity numeric(14,3) not null default 0 check (quarantined_quantity >= 0),
  completed_at timestamptz,
  primary key (recall_id, item_batch_id)
);

create table if not exists public.controlled_drug_register (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_invoice_id uuid not null references public.sales_invoices(id),
  sale_invoice_line_id uuid not null references public.sales_invoice_lines(id),
  patient_name text not null,
  prescriber_name text not null,
  prescription_reference text not null,
  dispensed_at timestamptz not null default now(),
  created_by_auth_id uuid,
  unique (sale_invoice_line_id)
);

create index if not exists idx_periods_org_dates on public.accounting_periods(organization_id, starts_on, ends_on);
create index if not exists idx_reservations_stock on public.stock_reservations(item_batch_id, warehouse_id) where status = 'active';
create index if not exists idx_adjustments_org_date on public.inventory_adjustments(organization_id, adjustment_date desc);
create index if not exists idx_licenses_org_expiry on public.drug_licenses(organization_id, expires_on);
create index if not exists idx_recalls_org_status on public.product_recalls(organization_id, status);
create index if not exists idx_audit_request on public.audit_logs(organization_id, request_id, occurred_at desc);

-- Prevent posting into a closed accounting period.
create or replace function public.erp_assert_open_period(p_org uuid, p_date date)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from public.accounting_periods where organization_id = p_org and status = 'closed' and p_date between starts_on and ends_on) then
    raise exception using errcode = 'P0001', message = format('Accounting period for %s is closed.', p_date);
  end if;
end;
$$;

create or replace function public.erp_guard_document_period()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_org uuid; v_date date;
begin
  v_org := new.organization_id;
  v_date := case tg_table_name when 'vouchers' then new.voucher_date when 'sales_invoices' then new.invoice_date when 'purchase_invoices' then new.invoice_date when 'inventory_adjustments' then new.adjustment_date end;
  perform public.erp_assert_open_period(v_org, v_date);
  return new;
end;
$$;

drop trigger if exists vouchers_open_period on public.vouchers;
create trigger vouchers_open_period before insert or update of voucher_date, status on public.vouchers for each row execute function public.erp_guard_document_period();
drop trigger if exists sales_open_period on public.sales_invoices;
create trigger sales_open_period before insert or update of invoice_date, status on public.sales_invoices for each row execute function public.erp_guard_document_period();
drop trigger if exists purchases_open_period on public.purchase_invoices;
create trigger purchases_open_period before insert or update of invoice_date, status on public.purchase_invoices for each row execute function public.erp_guard_document_period();
drop trigger if exists adjustments_open_period on public.inventory_adjustments;
create trigger adjustments_open_period before insert or update of adjustment_date, status on public.inventory_adjustments for each row execute function public.erp_guard_document_period();

-- Serialize changes to each batch/location and reject negative or over-reserved stock.
create or replace function public.erp_guard_stock_balance()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_batch uuid; v_warehouse uuid; v_current numeric(14,3); v_projected numeric(14,3); v_reserved numeric(14,3);
begin
  v_batch := coalesce(new.item_batch_id, old.item_batch_id);
  v_warehouse := coalesce(new.warehouse_id, old.warehouse_id);
  perform pg_advisory_xact_lock(hashtextextended(v_batch::text || ':' || v_warehouse::text, 0));
  select coalesce(sum(quantity),0) into v_current from public.stock_movements where item_batch_id = v_batch and warehouse_id = v_warehouse;
  v_projected := v_current + case when tg_op = 'INSERT' then new.quantity when tg_op = 'DELETE' then -old.quantity else new.quantity - old.quantity end;
  select coalesce(sum(quantity),0) into v_reserved from public.stock_reservations where item_batch_id = v_batch and warehouse_id = v_warehouse and status = 'active' and (expires_at is null or expires_at > now());
  if v_projected < 0 then raise exception using errcode = 'P0001', message = format('Negative stock is not allowed. Available %s, projected %s.', v_current, v_projected); end if;
  if v_projected < v_reserved then raise exception using errcode = 'P0001', message = format('Stock is reserved. Projected %s is below reserved %s.', v_projected, v_reserved); end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists stock_balance_guard on public.stock_movements;
create trigger stock_balance_guard before insert or update or delete on public.stock_movements for each row execute function public.erp_guard_stock_balance();

-- Posted vouchers must remain balanced. Deferred checking permits multi-row inserts.
create or replace function public.erp_check_voucher_balance()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_debit numeric(14,2); v_credit numeric(14,2); v_status document_status;
begin
  v_id := coalesce(new.voucher_id, old.voucher_id);
  select status into v_status from public.vouchers where id = v_id;
  if v_status = 'posted' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_debit, v_credit from public.voucher_lines where voucher_id = v_id;
    if v_debit <= 0 or v_debit <> v_credit then raise exception using errcode = 'P0001', message = format('Voucher is not balanced: debit %s, credit %s.', v_debit, v_credit); end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists voucher_balance_guard on public.voucher_lines;
create constraint trigger voucher_balance_guard after insert or update or delete on public.voucher_lines deferrable initially deferred for each row execute function public.erp_check_voucher_balance();

create or replace function public.erp_reserve_stock(p_organization_id uuid, p_item_batch_id uuid, p_warehouse_id uuid, p_quantity numeric, p_source_type text, p_source_id uuid default null, p_expires_at timestamptz default null, p_actor_auth_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_stock numeric(14,3); v_reserved numeric(14,3); v_id uuid;
begin
  if p_quantity <= 0 then raise exception 'Reservation quantity must be positive.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_item_batch_id::text || ':' || p_warehouse_id::text, 0));
  select coalesce(sum(quantity),0) into v_stock from public.stock_movements where organization_id = p_organization_id and item_batch_id = p_item_batch_id and warehouse_id = p_warehouse_id;
  select coalesce(sum(quantity),0) into v_reserved from public.stock_reservations where item_batch_id = p_item_batch_id and warehouse_id = p_warehouse_id and status = 'active' and (expires_at is null or expires_at > now());
  if v_stock - v_reserved < p_quantity then raise exception 'Insufficient available stock for reservation.'; end if;
  insert into public.stock_reservations(organization_id,item_batch_id,warehouse_id,source_type,source_id,quantity,expires_at,created_by_auth_id) values (p_organization_id,p_item_batch_id,p_warehouse_id,p_source_type,p_source_id,p_quantity,p_expires_at,p_actor_auth_id) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.erp_release_reservation(p_organization_id uuid, p_reservation_id uuid, p_status text default 'released')
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_status not in ('released','consumed','expired') then raise exception 'Invalid reservation status.'; end if;
  update public.stock_reservations set status = p_status, released_at = now() where id = p_reservation_id and organization_id = p_organization_id and status = 'active';
  if not found then raise exception 'Active reservation was not found.'; end if;
end;
$$;

-- One atomic routine for a complete sales or purchase invoice.
create or replace function public.erp_post_invoice(p_kind text, p_organization_id uuid, p_financial_year_id uuid, p_document jsonb, p_actor_auth_id uuid default null, p_actor_email text default null, p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_party_id uuid; v_invoice_id uuid; v_voucher_id uuid; v_party_account uuid; v_trade_account uuid; v_tax_account uuid;
  v_line jsonb; v_item public.items%rowtype; v_batch_id uuid; v_warehouse_id uuid; v_line_id uuid;
  v_number text := nullif(trim(p_document->>'id'),''); v_date date := coalesce(nullif(p_document->>'date','')::date,current_date);
  v_subtotal numeric(14,2) := 0; v_discount numeric(14,2) := 0; v_tax numeric(14,2) := 0; v_unrounded numeric(14,2) := 0; v_total numeric(14,2); v_rounding numeric(14,2);
  v_qty numeric(14,3); v_free numeric(14,3); v_rate numeric(14,2); v_disc_rate numeric(7,4); v_gst numeric(7,4); v_gross numeric(14,2); v_discount_line numeric(14,2); v_taxable numeric(14,2); v_tax_line numeric(14,2); v_line_total numeric(14,2);
begin
  if p_kind not in ('sales','purchases') then raise exception 'Unsupported invoice kind.'; end if;
  if v_number is null or jsonb_array_length(coalesce(p_document->'lines','[]'::jsonb)) = 0 then raise exception 'Invoice number and at least one line are required.'; end if;
  perform public.erp_assert_open_period(p_organization_id, v_date);
  select id into v_party_id from public.parties where organization_id = p_organization_id and lower(legal_name) = lower(trim(p_document->>'party')) and not is_blocked limit 1;
  if v_party_id is null then raise exception 'Active party was not found.'; end if;
  select id into v_warehouse_id from public.warehouses where organization_id = p_organization_id and is_active order by (code = 'MAIN') desc, code limit 1;
  if v_warehouse_id is null then raise exception 'An active warehouse is required.'; end if;

  -- Calculate authoritative totals before any posting.
  for v_line in select value from jsonb_array_elements(p_document->'lines') loop
    select * into v_item from public.items where organization_id = p_organization_id and is_active and (lower(name) = lower(trim(v_line->>'name')) or code = trim(v_line->>'itemCode')) limit 1;
    if v_item.id is null then raise exception 'Active item % was not found.', coalesce(v_line->>'name',v_line->>'itemCode'); end if;
    if p_kind = 'sales' and (v_item.is_recalled or exists (select 1 from public.product_recall_batches prb join public.item_batches ib on ib.id=prb.item_batch_id where ib.item_id=v_item.id and prb.completed_at is null and prb.action='quarantine')) then raise exception 'Recalled item % cannot be sold.', v_item.name; end if;
    if p_kind = 'sales' and (v_item.schedule_class in ('H','H1','X','NDPS') or v_item.prescription_required) and (nullif(trim(p_document->>'patientName'),'') is null or nullif(trim(p_document->>'prescriberName'),'') is null or nullif(trim(p_document->>'prescriptionReference'),'') is null) then raise exception 'Prescription, patient and prescriber details are required for %.', v_item.name; end if;
    v_qty := coalesce((v_line->>'qty')::numeric,0); v_free := coalesce((v_line->>'freeQty')::numeric,0); v_rate := coalesce((v_line->>'rate')::numeric,0); v_disc_rate := coalesce((v_line->>'discount')::numeric,0); v_gst := coalesce((v_line->>'gstRate')::numeric,0);
    if v_qty <= 0 or v_free < 0 or v_rate < 0 or v_disc_rate not between 0 and 100 or v_gst not between 0 and 100 then raise exception 'Invalid quantity, rate, discount or GST for %.', v_item.name; end if;
    v_gross := round(v_qty*v_rate,2); v_discount_line := round(v_gross*v_disc_rate/100,2); v_taxable := v_gross-v_discount_line; v_tax_line := round(v_taxable*v_gst/100,2); v_line_total := v_taxable+v_tax_line;
    v_subtotal := v_subtotal+v_gross; v_discount := v_discount+v_discount_line; v_tax := v_tax+v_tax_line; v_unrounded := v_unrounded+v_line_total;
  end loop;
  v_total := coalesce(nullif(p_document->>'grandTotal','')::numeric, round(v_unrounded,0));
  v_rounding := round(v_total-v_unrounded,2);
  if abs(v_rounding) > 1 then raise exception 'Rounding adjustment cannot exceed one currency unit.'; end if;

  select id into v_party_account from public.chart_of_accounts where organization_id=p_organization_id and party_id=v_party_id;
  if v_party_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group,party_id) values(p_organization_id,'PTY-'||substr(md5(v_party_id::text),1,12),(select legal_name from public.parties where id=v_party_id),'party',case when p_kind='sales' then 'Sundry Debtors' else 'Sundry Creditors' end,v_party_id) returning id into v_party_account; end if;
  select id into v_trade_account from public.chart_of_accounts where organization_id=p_organization_id and name=case when p_kind='sales' then 'Sales' else 'Purchases' end limit 1;
  if v_trade_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,case when p_kind='sales' then 'SALES' else 'PURCHASES' end,case when p_kind='sales' then 'Sales' else 'Purchases' end,case when p_kind='sales' then 'income' else 'expense' end,case when p_kind='sales' then 'Sales Accounts' else 'Purchase Accounts' end) returning id into v_trade_account; end if;
  if v_tax > 0 then
    select id into v_tax_account from public.chart_of_accounts where organization_id=p_organization_id and name=case when p_kind='sales' then 'Output GST' else 'Input GST' end limit 1;
    if v_tax_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,case when p_kind='sales' then 'OUTPUT-GST' else 'INPUT-GST' end,case when p_kind='sales' then 'Output GST' else 'Input GST' end,case when p_kind='sales' then 'liability' else 'asset' end,'Duties & Taxes') returning id into v_tax_account; end if;
  end if;

  if p_kind='sales' then
    insert into public.sales_invoices(organization_id,financial_year_id,party_id,invoice_number,invoice_date,status,subtotal,discount_total,tax_total,rounding_adjustment,grand_total) values(p_organization_id,p_financial_year_id,v_party_id,v_number,v_date,'posted',v_subtotal,v_discount,v_tax,v_rounding,v_total) returning id into v_invoice_id;
  else
    insert into public.purchase_invoices(organization_id,financial_year_id,party_id,invoice_number,supplier_invoice_number,invoice_date,status,subtotal,discount_total,tax_total,rounding_adjustment,grand_total) values(p_organization_id,p_financial_year_id,v_party_id,v_number,nullif(p_document->>'supplierInvoice',''),v_date,'posted',v_subtotal,v_discount,v_tax,v_rounding,v_total) returning id into v_invoice_id;
  end if;

  for v_line in select value from jsonb_array_elements(p_document->'lines') loop
    select * into v_item from public.items where organization_id=p_organization_id and is_active and (lower(name)=lower(trim(v_line->>'name')) or code=trim(v_line->>'itemCode')) limit 1;
    v_qty:=coalesce((v_line->>'qty')::numeric,0); v_free:=coalesce((v_line->>'freeQty')::numeric,0); v_rate:=coalesce((v_line->>'rate')::numeric,0); v_disc_rate:=coalesce((v_line->>'discount')::numeric,0); v_gst:=coalesce((v_line->>'gstRate')::numeric,0);
    v_gross:=round(v_qty*v_rate,2); v_discount_line:=round(v_gross*v_disc_rate/100,2); v_taxable:=v_gross-v_discount_line; v_tax_line:=round(v_taxable*v_gst/100,2); v_line_total:=v_taxable+v_tax_line;
    select id into v_batch_id from public.item_batches where item_id=v_item.id and batch_number=coalesce(nullif(trim(v_line->>'batch'),''),'UNSPECIFIED');
    if v_batch_id is null and p_kind='purchases' then insert into public.item_batches(item_id,batch_number,expiry_on,mrp) values(v_item.id,coalesce(nullif(trim(v_line->>'batch'),''),'UNSPECIFIED'),nullif(v_line->>'expiry','')::date,coalesce(nullif(v_line->>'mrp','')::numeric,v_item.mrp)) returning id into v_batch_id; end if;
    if v_batch_id is null then raise exception 'Batch % was not found for %.', v_line->>'batch', v_item.name; end if;
    if p_kind='sales' then
      insert into public.sales_invoice_lines(invoice_id,item_id,item_batch_id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total) values(v_invoice_id,v_item.id,v_batch_id,v_qty,v_free,v_rate,v_disc_rate,v_gst,v_line_total) returning id into v_line_id;
      insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,occurred_at,source_type,source_id) values(p_organization_id,v_batch_id,v_warehouse_id,'sale',-(v_qty+v_free),v_date::timestamptz,'sales_invoice',v_invoice_id);
      if v_item.schedule_class in ('H','H1','X','NDPS') or v_item.prescription_required then insert into public.controlled_drug_register(organization_id,sale_invoice_id,sale_invoice_line_id,patient_name,prescriber_name,prescription_reference,created_by_auth_id) values(p_organization_id,v_invoice_id,v_line_id,p_document->>'patientName',p_document->>'prescriberName',p_document->>'prescriptionReference',p_actor_auth_id); end if;
    else
      insert into public.purchase_invoice_lines(invoice_id,item_id,item_batch_id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total) values(v_invoice_id,v_item.id,v_batch_id,v_qty,v_free,v_rate,v_disc_rate,v_gst,v_line_total);
      insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,occurred_at,source_type,source_id) values(p_organization_id,v_batch_id,v_warehouse_id,'purchase',v_qty+v_free,v_date::timestamptz,'purchase_invoice',v_invoice_id);
    end if;
  end loop;

  insert into public.vouchers(organization_id,financial_year_id,voucher_type,voucher_number,voucher_date,status,narration) values(p_organization_id,p_financial_year_id,case when p_kind='sales' then 'sale'::voucher_type else 'purchase'::voucher_type end,v_number,v_date,'posted',initcap(p_kind)||' invoice '||v_number) returning id into v_voucher_id;
  if p_kind='sales' then
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_party_account,v_total,0,'Invoice '||v_number),(v_voucher_id,v_trade_account,0,v_subtotal-v_discount,'Taxable sales');
    if v_tax>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,0,v_tax,'Output GST'); end if;
  else
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_trade_account,v_subtotal-v_discount,0,'Taxable purchases'),(v_voucher_id,v_party_account,0,v_total,'Invoice '||v_number);
    if v_tax>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,v_tax,0,'Input GST'); end if;
  end if;
  -- Rounding belongs on the smaller side so the voucher remains exactly balanced.
  if v_rounding <> 0 then
    select id into v_tax_account from public.chart_of_accounts where organization_id=p_organization_id and name='Rounding Adjustment' limit 1;
    if v_tax_account is null then insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group) values(p_organization_id,'ROUNDING','Rounding Adjustment','general','Indirect Expenses') returning id into v_tax_account; end if;
    if (p_kind='sales' and v_rounding>0) or (p_kind='purchases' and v_rounding<0) then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,0,abs(v_rounding),'Rounding'); else insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_voucher_id,v_tax_account,abs(v_rounding),0,'Rounding'); end if;
  end if;
  if p_kind='sales' then update public.sales_invoices set voucher_id=v_voucher_id where id=v_invoice_id; else update public.purchase_invoices set voucher_id=v_voucher_id where id=v_invoice_id; end if;
  insert into public.audit_logs(organization_id,entity_type,entity_id,action,after_state,actor_auth_id,actor_email,request_id,metadata) values(p_organization_id,p_kind,v_invoice_id,'posted',jsonb_build_object('number',v_number,'total',v_total),p_actor_auth_id,p_actor_email,p_request_id,jsonb_build_object('source','erp_post_invoice'));
  return jsonb_build_object('id',v_number,'recordId',v_invoice_id,'date',v_date,'subtotal',v_subtotal,'discountTotal',v_discount,'taxTotal',v_tax,'roundingAdjustment',v_rounding,'total',v_total,'status','posted');
end;
$$;

create or replace function public.erp_import_invoices(p_kind text, p_organization_id uuid, p_financial_year_id uuid, p_documents jsonb, p_actor_auth_id uuid default null, p_actor_email text default null, p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_document jsonb; v_count integer:=0;
begin
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents)=0 then raise exception 'Import batch is empty.'; end if;
  if jsonb_array_length(p_documents)>1000 then raise exception 'Import batch is limited to 1,000 invoices.'; end if;
  for v_document in select value from jsonb_array_elements(p_documents) loop perform public.erp_post_invoice(p_kind,p_organization_id,p_financial_year_id,v_document,p_actor_auth_id,p_actor_email,p_request_id); v_count:=v_count+1; end loop;
  return jsonb_build_object('type',p_kind,'records',v_count);
end;
$$;

create or replace function public.erp_import_master(p_type text, p_organization_id uuid, p_rows jsonb, p_actor_auth_id uuid default null, p_actor_email text default null, p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r jsonb; v_count integer:=0; v_party uuid; v_item uuid; v_batch uuid; v_warehouse uuid; v_manufacturer uuid; v_salt uuid; v_hsn uuid; v_qty numeric;
begin
  if p_type not in ('parties','manufacturers','salts','hsn','warehouses','accounts','items','opening-stock') then raise exception 'Unsupported master import type.'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Import batch is empty.'; end if;
  if jsonb_array_length(p_rows)>5000 then raise exception 'Import batch is limited to 5,000 rows.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if p_type='parties' then
      if lower(coalesce(r->>'party_type','')) not in ('customer','supplier','both') then raise exception 'Invalid party_type for code %.',r->>'code'; end if;
      insert into public.parties(organization_id,code,party_type,legal_name,phone,email,gstin,credit_limit,is_blocked)
      values(p_organization_id,trim(r->>'code'),lower(r->>'party_type')::party_type,trim(r->>'legal_name'),nullif(trim(r->>'phone'),''),nullif(trim(r->>'email'),''),nullif(trim(r->>'gstin'),''),coalesce(nullif(r->>'credit_limit','')::numeric,0),lower(coalesce(r->>'status',''))='blocked')
      on conflict(organization_id,code) do update set party_type=excluded.party_type,legal_name=excluded.legal_name,phone=excluded.phone,email=excluded.email,gstin=excluded.gstin,credit_limit=excluded.credit_limit,is_blocked=excluded.is_blocked returning id into v_party;
      if nullif(trim(r->>'city'),'') is not null then
        update public.party_addresses set line1=coalesce(nullif(trim(r->>'address'),''),trim(r->>'city')),city=trim(r->>'city'),state_code=nullif(trim(r->>'state'),''),postal_code=nullif(trim(r->>'pincode'),'') where party_id=v_party and is_default;
        if not found then insert into public.party_addresses(party_id,address_type,line1,city,state_code,postal_code,is_default) values(v_party,'business',coalesce(nullif(trim(r->>'address'),''),trim(r->>'city')),trim(r->>'city'),nullif(trim(r->>'state'),''),nullif(trim(r->>'pincode'),''),true); end if;
      end if;
    elsif p_type='manufacturers' then
      insert into public.manufacturers(organization_id,name,code,is_active) values(p_organization_id,trim(r->>'name'),nullif(trim(r->>'code'),''),lower(coalesce(r->>'status',''))<>'inactive') on conflict(organization_id,name) do update set code=excluded.code,is_active=excluded.is_active;
    elsif p_type='salts' then
      insert into public.salts(organization_id,code,name,composition,category) values(p_organization_id,trim(r->>'code'),trim(r->>'name'),nullif(trim(r->>'composition'),''),nullif(trim(r->>'category'),'')) on conflict(organization_id,name) do update set code=excluded.code,composition=excluded.composition,category=excluded.category;
    elsif p_type='hsn' then
      insert into public.hsn_codes(organization_id,code,description,gst_rate) values(p_organization_id,trim(r->>'code'),nullif(trim(r->>'description'),''),coalesce(nullif(r->>'gst_rate','')::numeric,0)) on conflict(organization_id,code) do update set description=excluded.description,gst_rate=excluded.gst_rate;
    elsif p_type='warehouses' then
      insert into public.warehouses(organization_id,code,name,warehouse_type,address,capacity,is_active) values(p_organization_id,trim(r->>'code'),trim(r->>'name'),coalesce(nullif(trim(r->>'warehouse_type'),''),'Store Room'),nullif(trim(r->>'address'),''),coalesce(nullif(r->>'capacity','')::numeric,0),lower(coalesce(r->>'status',''))<>'inactive') on conflict(organization_id,code) do update set name=excluded.name,warehouse_type=excluded.warehouse_type,address=excluded.address,capacity=excluded.capacity,is_active=excluded.is_active;
    elsif p_type='accounts' then
      insert into public.chart_of_accounts(organization_id,code,name,account_type,account_group,opening_balance,is_active) values(p_organization_id,trim(r->>'code'),trim(r->>'name'),coalesce(nullif(trim(r->>'account_type'),''),'general'),coalesce(nullif(trim(r->>'account_group'),''),'General'),coalesce(nullif(r->>'opening_balance','')::numeric,0),lower(coalesce(r->>'status',''))<>'inactive') on conflict(organization_id,code) do update set name=excluded.name,account_type=excluded.account_type,account_group=excluded.account_group,opening_balance=excluded.opening_balance,is_active=excluded.is_active;
    elsif p_type='items' then
      v_manufacturer:=null;v_salt:=null;v_hsn:=null;
      if nullif(trim(r->>'manufacturer'),'') is not null then select id into v_manufacturer from public.manufacturers where organization_id=p_organization_id and lower(name)=lower(trim(r->>'manufacturer')); if v_manufacturer is null then raise exception 'Manufacturer % does not exist.',r->>'manufacturer'; end if; end if;
      if nullif(trim(r->>'salt'),'') is not null then select id into v_salt from public.salts where organization_id=p_organization_id and lower(name)=lower(trim(r->>'salt')); if v_salt is null then raise exception 'Salt % does not exist.',r->>'salt'; end if; end if;
      if nullif(trim(r->>'hsn_code'),'') is not null then select id into v_hsn from public.hsn_codes where organization_id=p_organization_id and code=trim(r->>'hsn_code'); if v_hsn is null then raise exception 'HSN % does not exist.',r->>'hsn_code'; end if; end if;
      insert into public.items(organization_id,code,name,packing,manufacturer_id,salt_id,hsn_id,mrp,sale_rate,purchase_rate,is_active,schedule_class,prescription_required,cold_chain,controlled_substance)
      values(p_organization_id,trim(r->>'code'),trim(r->>'name'),nullif(trim(r->>'packing'),''),v_manufacturer,v_salt,v_hsn,coalesce(nullif(r->>'mrp','')::numeric,0),coalesce(nullif(r->>'sale_rate','')::numeric,0),coalesce(nullif(r->>'purchase_rate','')::numeric,0),lower(coalesce(r->>'status',''))<>'inactive',upper(coalesce(nullif(trim(r->>'schedule_class'),''),'OTC')),lower(coalesce(r->>'prescription_required','false')) in ('true','yes','1'),lower(coalesce(r->>'cold_chain','false')) in ('true','yes','1'),lower(coalesce(r->>'controlled_substance','false')) in ('true','yes','1'))
      on conflict(organization_id,code) do update set name=excluded.name,packing=excluded.packing,manufacturer_id=excluded.manufacturer_id,salt_id=excluded.salt_id,hsn_id=excluded.hsn_id,mrp=excluded.mrp,sale_rate=excluded.sale_rate,purchase_rate=excluded.purchase_rate,is_active=excluded.is_active,schedule_class=excluded.schedule_class,prescription_required=excluded.prescription_required,cold_chain=excluded.cold_chain,controlled_substance=excluded.controlled_substance;
    else
      select id into v_item from public.items where organization_id=p_organization_id and code=trim(r->>'item_code');
      select id into v_warehouse from public.warehouses where organization_id=p_organization_id and code=trim(r->>'warehouse_code');
      v_qty:=coalesce(nullif(r->>'quantity','')::numeric,-1);
      if v_item is null or v_warehouse is null or v_qty<0 then raise exception 'Invalid opening stock references or quantity.'; end if;
      insert into public.item_batches(item_id,batch_number,expiry_on,mrp) values(v_item,trim(r->>'batch'),nullif(r->>'expiry','')::date,coalesce(nullif(r->>'mrp','')::numeric,0)) on conflict(item_id,batch_number) do update set expiry_on=excluded.expiry_on,mrp=excluded.mrp returning id into v_batch;
      delete from public.stock_movements where organization_id=p_organization_id and item_batch_id=v_batch and warehouse_id=v_warehouse and movement_type='opening';
      if v_qty>0 then insert into public.stock_movements(organization_id,item_batch_id,warehouse_id,movement_type,quantity,source_type,remarks) values(p_organization_id,v_batch,v_warehouse,'opening',v_qty,'file_import',coalesce(nullif(trim(r->>'remarks'),''),'Opening stock import')); end if;
    end if;
    v_count:=v_count+1;
  end loop;
  insert into public.audit_logs(organization_id,entity_type,entity_id,action,after_state,actor_auth_id,actor_email,request_id,metadata) values(p_organization_id,'import',gen_random_uuid(),'completed',jsonb_build_object('type',p_type,'rows',v_count),p_actor_auth_id,p_actor_email,p_request_id,jsonb_build_object('atomic',true));
  return jsonb_build_object('type',p_type,'importedRows',v_count,'records',v_count);
end;
$$;

create or replace function public.erp_close_period(p_organization_id uuid,p_period_id uuid,p_actor_auth_id uuid,p_notes text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_start date; v_end date;
begin
  select starts_on,ends_on into v_start,v_end from public.accounting_periods where id=p_period_id and organization_id=p_organization_id and status='open' for update;
  if not found then raise exception 'Open accounting period was not found.'; end if;
  if exists(select 1 from public.vouchers v left join lateral(select coalesce(sum(debit),0) d,coalesce(sum(credit),0) c from public.voucher_lines where voucher_id=v.id) x on true where v.organization_id=p_organization_id and v.status='posted' and v.voucher_date between v_start and v_end and x.d<>x.c) then raise exception 'The period contains unbalanced vouchers.'; end if;
  update public.accounting_periods set status='closed',closed_at=now(),closed_by_auth_id=p_actor_auth_id,close_notes=p_notes where id=p_period_id;
end;
$$;

create or replace view public.erp_stock_position as
select sm.organization_id, i.id item_id, i.code item_code, i.name item_name, i.schedule_class, i.is_recalled, ib.id item_batch_id, ib.batch_number, ib.expiry_on, w.id warehouse_id, w.name warehouse_name, round(sum(sm.quantity),3) quantity,
  coalesce((select sum(sr.quantity) from public.stock_reservations sr where sr.item_batch_id=ib.id and sr.warehouse_id=w.id and sr.status='active' and (sr.expires_at is null or sr.expires_at>now())),0) reserved_quantity
from public.stock_movements sm join public.item_batches ib on ib.id=sm.item_batch_id join public.items i on i.id=ib.item_id join public.warehouses w on w.id=sm.warehouse_id
group by sm.organization_id,i.id,i.code,i.name,i.schedule_class,i.is_recalled,ib.id,ib.batch_number,ib.expiry_on,w.id,w.name;

create or replace view public.erp_trial_balance as
select v.organization_id,a.id account_id,a.code,a.name,a.account_group,round(sum(vl.debit),2) debit,round(sum(vl.credit),2) credit,round(sum(vl.debit-vl.credit),2) balance
from public.vouchers v join public.voucher_lines vl on vl.voucher_id=v.id join public.chart_of_accounts a on a.id=vl.account_id where v.status='posted' group by v.organization_id,a.id,a.code,a.name,a.account_group;

-- Server-only access. Functions are not callable by browser roles.
alter table public.accounting_periods enable row level security;
alter table public.role_permissions enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_adjustment_lines enable row level security;
alter table public.drug_licenses enable row level security;
alter table public.product_recalls enable row level security;
alter table public.product_recall_batches enable row level security;
alter table public.controlled_drug_register enable row level security;

do $$ declare t text; begin foreach t in array array['accounting_periods','role_permissions','stock_reservations','inventory_adjustments','inventory_adjustment_lines','drug_licenses','product_recalls','product_recall_batches','controlled_drug_register'] loop execute format('drop policy if exists server_only on public.%I',t); execute format('create policy server_only on public.%I for all to service_role using (true) with check (true)',t); execute format('grant select,insert,update,delete on public.%I to service_role',t); end loop; end $$;
grant usage, select on all sequences in schema public to service_role;
grant select on public.erp_stock_position, public.erp_trial_balance to service_role;

revoke execute on function public.erp_assert_open_period(uuid,date) from public,anon,authenticated;
revoke execute on function public.erp_reserve_stock(uuid,uuid,uuid,numeric,text,uuid,timestamptz,uuid) from public,anon,authenticated;
revoke execute on function public.erp_release_reservation(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.erp_post_invoice(text,uuid,uuid,jsonb,uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.erp_import_invoices(text,uuid,uuid,jsonb,uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.erp_import_master(text,uuid,jsonb,uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.erp_close_period(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.erp_assert_open_period(uuid,date), public.erp_reserve_stock(uuid,uuid,uuid,numeric,text,uuid,timestamptz,uuid), public.erp_release_reservation(uuid,uuid,text), public.erp_post_invoice(text,uuid,uuid,jsonb,uuid,text,uuid), public.erp_import_invoices(text,uuid,uuid,jsonb,uuid,text,uuid), public.erp_import_master(text,uuid,jsonb,uuid,text,uuid), public.erp_close_period(uuid,uuid,uuid,text) to service_role;

insert into public.role_permissions(organization_id,role_code,action,allowed)
select o.id,p.role_code,p.action,true from public.organizations o cross join (values
 ('admin','*'),
 ('manager','masters.read'),('manager','masters.write'),('manager','transactions.read'),('manager','transactions.write'),('manager','transactions.cancel'),('manager','inventory.read'),('manager','inventory.adjust'),('manager','accounting.read'),('manager','accounting.write'),('manager','reports.read'),('manager','imports.execute'),('manager','compliance.read'),('manager','compliance.write'),
 ('operator','masters.read'),('operator','transactions.read'),('operator','transactions.write'),('operator','inventory.read'),('operator','accounting.read'),('operator','reports.read'),('operator','compliance.read')
) p(role_code,action) on conflict(organization_id,role_code,action) do update set allowed=excluded.allowed;
