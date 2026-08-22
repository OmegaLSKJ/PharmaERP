alter table public.manufacturers add column if not exists code text;
alter table public.manufacturers add column if not exists is_active boolean not null default true;
alter table public.salts add column if not exists code text;
alter table public.salts add column if not exists composition text;
alter table public.salts add column if not exists category text;
alter table public.warehouses add column if not exists warehouse_type text not null default 'Store Room';
alter table public.warehouses add column if not exists address text;
alter table public.warehouses add column if not exists capacity numeric(14,3) not null default 0 check (capacity >= 0);
alter table public.warehouses add column if not exists is_active boolean not null default true;
alter table public.chart_of_accounts add column if not exists account_group text not null default 'General';
alter table public.chart_of_accounts add column if not exists opening_balance numeric(14,2) not null default 0;

create table if not exists public.document_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  prefix text not null default '',
  suffix text not null default '',
  next_number bigint not null default 1 check (next_number > 0),
  padding smallint not null default 4 check (padding between 1 and 12),
  financial_year_reset boolean not null default true,
  is_active boolean not null default true,
  unique (organization_id, document_type)
);

create table if not exists public.communication_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  destination text not null,
  reason text,
  blocked_on date not null default current_date,
  unique (organization_id, channel, destination)
);

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  financial_year_id uuid not null references public.financial_years(id),
  party_id uuid not null references public.parties(id),
  invoice_number text not null,
  supplier_invoice_number text,
  invoice_date date not null,
  due_date date,
  status text not null default 'posted' check (status in ('draft','posted','cancelled')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  voucher_id uuid references public.vouchers(id),
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  item_id uuid not null references public.items(id),
  item_batch_id uuid not null references public.item_batches(id),
  quantity numeric(14,3) not null check (quantity > 0),
  free_quantity numeric(14,3) not null default 0 check (free_quantity >= 0),
  rate numeric(14,2) not null check (rate >= 0),
  discount_percent numeric(7,4) not null default 0,
  gst_rate numeric(7,4) not null default 0,
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  document_number text not null,
  document_date date not null default current_date,
  party_id uuid references public.parties(id),
  status text not null default 'draft',
  total numeric(14,2) not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_type, document_number)
);

create index if not exists idx_purchase_invoices_org_date on public.purchase_invoices(organization_id, invoice_date desc);
create index if not exists idx_purchase_lines_invoice on public.purchase_invoice_lines(invoice_id);
create index if not exists idx_business_documents_org_type_date on public.business_documents(organization_id, document_type, document_date desc);
create index if not exists idx_communication_blocks_org on public.communication_blocks(organization_id, channel);

alter table public.document_series enable row level security;
alter table public.communication_blocks enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_lines enable row level security;
alter table public.business_documents enable row level security;

drop policy if exists server_only on public.document_series;
create policy server_only on public.document_series for all to service_role using (true) with check (true);
drop policy if exists server_only on public.communication_blocks;
create policy server_only on public.communication_blocks for all to service_role using (true) with check (true);
drop policy if exists server_only on public.purchase_invoices;
create policy server_only on public.purchase_invoices for all to service_role using (true) with check (true);
drop policy if exists server_only on public.purchase_invoice_lines;
create policy server_only on public.purchase_invoice_lines for all to service_role using (true) with check (true);
drop policy if exists server_only on public.business_documents;
create policy server_only on public.business_documents for all to service_role using (true) with check (true);

insert into public.document_series (organization_id, document_type, prefix, next_number, padding)
select o.id, seed.document_type, seed.prefix, 1, seed.padding
from public.organizations o
cross join (values
  ('Sale Invoice','SI-',4), ('Sale Return','SR-',3), ('Purchase Bill','PB-',4),
  ('Purchase Return','PR-',3), ('Challan','CH-',4), ('Credit Note','CN-',3),
  ('Debit Note','DN-',3), ('Sales Order','SO-',3), ('Purchase Order','PO-',3)
) as seed(document_type, prefix, padding)
on conflict (organization_id, document_type) do nothing;
