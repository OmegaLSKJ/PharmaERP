-- Preserve source-stock details that are not represented in the original ERP schema.
alter table public.items
  add column if not exists unit text;

alter table public.item_batches
  add column if not exists received_on date,
  add column if not exists manufactured_on date,
  add column if not exists cost_price numeric,
  add column if not exists purchase_price numeric,
  add column if not exists sale_price numeric,
  add column if not exists sales_scheme_deal numeric not null default 0,
  add column if not exists sales_scheme_free numeric not null default 0,
  add column if not exists purchase_scheme_deal numeric not null default 0,
  add column if not exists purchase_scheme_free numeric not null default 0,
  add column if not exists supplier_id uuid references public.parties(id),
  add column if not exists supplier_invoice_number text,
  add column if not exists supplier_invoice_date date,
  add column if not exists rack_number text,
  add column if not exists source_report_value numeric;

create index if not exists idx_item_batches_supplier_id on public.item_batches(supplier_id);

create table if not exists public.stock_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  source_file text not null,
  source_row integer not null,
  item_code text,
  product_name text,
  unit text,
  current_stock numeric not null default 0,
  sales_scheme_deal numeric not null default 0,
  sales_scheme_free numeric not null default 0,
  purchase_scheme_deal numeric not null default 0,
  purchase_scheme_free numeric not null default 0,
  cost_price numeric,
  reported_value numeric,
  mrp numeric,
  purchase_price numeric,
  sale_price numeric,
  company text,
  manufacturer text,
  received_on date,
  batch_number text,
  manufactured_on date,
  expiry_on date,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  rack_number text,
  raw_payload jsonb not null default '{}'::jsonb,
  item_id uuid references public.items(id),
  item_batch_id uuid references public.item_batches(id),
  stock_movement_id uuid references public.stock_movements(id),
  imported_at timestamptz not null default now(),
  unique (organization_id, source_file, source_row)
);

create index if not exists idx_stock_import_rows_org_file on public.stock_import_rows(organization_id, source_file);
create index if not exists idx_stock_import_rows_item_batch on public.stock_import_rows(item_batch_id);

alter table public.stock_import_rows enable row level security;
drop policy if exists server_only on public.stock_import_rows;
create policy server_only on public.stock_import_rows
  for all to service_role using (true) with check (true);
