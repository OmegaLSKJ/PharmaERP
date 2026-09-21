-- Persist operational settings that were previously held only in a browser.
-- All access is mediated by the application's server-side Supabase client.

create table if not exists public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.item_pricing_schemes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  scheme_type text not null default 'none' check (scheme_type in ('free_goods', 'discount', 'none')),
  deal_quantity numeric(14,3) not null default 0 check (deal_quantity >= 0),
  free_quantity numeric(14,3) not null default 0 check (free_quantity >= 0),
  discount_percent numeric(7,4) not null default 0 check (discount_percent between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, item_id)
);

create table if not exists public.inventory_restrictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  packing text,
  batch_number text not null,
  expiry_on text,
  quantity numeric(14,3) not null check (quantity > 0),
  mrp numeric(14,2) not null default 0 check (mrp >= 0),
  purchase_rate numeric(14,2) not null default 0 check (purchase_rate >= 0),
  reason text not null,
  reference_number text,
  restriction_type text not null check (restriction_type in ('hold', 'ban')),
  status text not null default 'active' check (status in ('active', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.inventory_reconciliation_marks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_key text not null,
  item_id uuid references public.items(id) on delete set null,
  batch_number text,
  adjustment_id uuid references public.inventory_adjustments(id) on delete set null,
  reconciled_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

create index if not exists item_pricing_schemes_organization_item_idx on public.item_pricing_schemes (organization_id, item_id);
create index if not exists inventory_restrictions_organization_status_idx on public.inventory_restrictions (organization_id, status);
create index if not exists inventory_reconciliation_marks_organization_source_idx on public.inventory_reconciliation_marks (organization_id, source_key);

alter table public.organization_profiles enable row level security;
alter table public.item_pricing_schemes enable row level security;
alter table public.inventory_restrictions enable row level security;
alter table public.inventory_reconciliation_marks enable row level security;

drop policy if exists server_only on public.organization_profiles;
create policy server_only on public.organization_profiles for all to service_role using (true) with check (true);
drop policy if exists server_only on public.item_pricing_schemes;
create policy server_only on public.item_pricing_schemes for all to service_role using (true) with check (true);
drop policy if exists server_only on public.inventory_restrictions;
create policy server_only on public.inventory_restrictions for all to service_role using (true) with check (true);
drop policy if exists server_only on public.inventory_reconciliation_marks;
create policy server_only on public.inventory_reconciliation_marks for all to service_role using (true) with check (true);
