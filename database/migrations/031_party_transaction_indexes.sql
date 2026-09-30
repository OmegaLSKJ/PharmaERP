-- Phase 2 Performance: High-speed indexes for party-scoped queries
- Ensure composite indexes exist on transaction tables to accelerate sub-50ms Supabase lookups

create index if not exists idx_sales_invoices_org_party on public.sales_invoices(organization_id, party_id, invoice_date desc);
create index if not exists idx_purchase_invoices_org_party on public.purchase_invoices(organization_id, party_id, invoice_date desc);
create index if not exists idx_coa_org_party on public.chart_of_accounts(organization_id, party_id);
create index if not exists idx_voucher_lines_account_debit_credit on public.voucher_lines(account_id, debit, credit);
