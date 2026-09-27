-- Migration 030: Expand purchase invoice status constraint to support order receipt lifecycle
-- Supports statuses: 'posted', 'draft', 'cancelled', 'received', 'pending', 'partial'

do $$
begin
  -- Drop existing status check on purchase_invoices if present
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'purchase_invoices_status_check'
      and table_name = 'purchase_invoices'
  ) then
    alter table public.purchase_invoices drop constraint purchase_invoices_status_check;
  end if;

  -- Add updated check constraint allowing order receipt statuses
  alter table public.purchase_invoices
    add constraint purchase_invoices_status_check
    check (status in ('draft', 'posted', 'cancelled', 'received', 'pending', 'partial'));
exception when others then
  raise notice 'Could not alter status check constraint: %', sqlerrm;
end $$;
