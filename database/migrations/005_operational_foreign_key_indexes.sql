create index if not exists idx_purchase_invoices_financial_year on public.purchase_invoices(financial_year_id);
create index if not exists idx_purchase_invoices_party on public.purchase_invoices(party_id);
create index if not exists idx_purchase_invoices_voucher on public.purchase_invoices(voucher_id) where voucher_id is not null;
create index if not exists idx_purchase_invoice_lines_item on public.purchase_invoice_lines(item_id);
create index if not exists idx_purchase_invoice_lines_batch on public.purchase_invoice_lines(item_batch_id);
create index if not exists idx_business_documents_party on public.business_documents(party_id) where party_id is not null;
