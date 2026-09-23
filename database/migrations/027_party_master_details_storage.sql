-- Persist every Party Master field in a normalized, server-only data model.

alter table public.party_addresses
  add column if not exists line2 text,
  add column if not exists country text;

create table if not exists public.party_details (
  party_id uuid primary key references public.parties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  station text,
  balancing_method text not null default 'On Account',
  opening_type text not null default 'Dr' check (opening_type in ('Dr', 'Cr')),
  mail_to text,
  country text,
  contact_person text,
  designation text,
  mobile text,
  phone_office text,
  phone_residence text,
  fax text,
  website text,
  freeze_upto date,
  narco_schedule_h boolean not null default false,
  gst_heading text,
  gst_registration_date date,
  pan text,
  ledger_category text,
  ledger_type text,
  credit_days integer not null default 0 check (credit_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_party_details_organization on public.party_details(organization_id);
create index if not exists idx_party_addresses_default on public.party_addresses(party_id) where is_default;
create index if not exists idx_drug_licenses_party_type on public.drug_licenses(party_id, license_type);

-- Party details are accessed only through protected server routes, consistent
-- with the rest of the ERP master data model.
alter table public.party_details enable row level security;
revoke all on table public.party_details from anon, authenticated;
grant select, insert, update, delete on table public.party_details to service_role;
drop policy if exists server_only on public.party_details;
create policy server_only on public.party_details
  for all to service_role using (true) with check (true);
