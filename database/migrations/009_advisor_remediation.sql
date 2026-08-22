alter view public.erp_stock_position set (security_invoker = true);
alter view public.erp_trial_balance set (security_invoker = true);

create index if not exists idx_controlled_drug_org on public.controlled_drug_register(organization_id);
create index if not exists idx_controlled_drug_invoice on public.controlled_drug_register(sale_invoice_id);
create index if not exists idx_drug_licenses_party on public.drug_licenses(party_id);
create index if not exists idx_adjustment_lines_adjustment on public.inventory_adjustment_lines(adjustment_id);
create index if not exists idx_adjustment_lines_batch on public.inventory_adjustment_lines(item_batch_id);
create index if not exists idx_adjustment_lines_warehouse on public.inventory_adjustment_lines(warehouse_id);
create index if not exists idx_recall_batches_batch on public.product_recall_batches(item_batch_id);
create index if not exists idx_product_recalls_manufacturer on public.product_recalls(manufacturer_id);
create index if not exists idx_reservations_org on public.stock_reservations(organization_id);
create index if not exists idx_reservations_warehouse on public.stock_reservations(warehouse_id);
