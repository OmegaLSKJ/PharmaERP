-- Supabase hardening: the web application accesses ERP data through
-- server-side API routes only. The public API roles have no table access.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'roles', 'users', 'financial_years',
    'parties', 'party_addresses', 'manufacturers', 'salts', 'hsn_codes',
    'items', 'warehouses', 'item_batches', 'stock_movements',
    'chart_of_accounts', 'vouchers', 'voucher_lines',
    'sales_invoices', 'sales_invoice_lines',
    'delivery_challans', 'delivery_challan_lines', 'receipts_payments',
    'gst_returns', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END $$;
