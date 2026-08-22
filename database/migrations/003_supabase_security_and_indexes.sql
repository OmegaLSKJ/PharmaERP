-- Make the server-only access model explicit and cover every foreign key.
-- The service role is used only by protected server routes; browser roles have
-- no grants and therefore cannot read or modify ERP data directly.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'roles', 'users', 'financial_years',
    'parties', 'party_addresses', 'manufacturers', 'salts', 'hsn_codes',
    'items', 'warehouses', 'item_batches', 'stock_movements',
    'chart_of_accounts', 'vouchers', 'voucher_lines',
    'sales_invoices', 'sales_invoice_lines', 'delivery_challans',
    'delivery_challan_lines', 'receipts_payments', 'gst_returns', 'audit_logs'
  ]
  LOOP
    EXECUTE format('CREATE POLICY server_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;

DO $$
DECLARE foreign_key record;
BEGIN
  FOR foreign_key IN
    SELECT conrelid::regclass::text AS table_name, conname,
           array_to_string(ARRAY(SELECT attname FROM unnest(conkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k.attnum ORDER BY ord), ', ') AS columns
    FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
      'idx_' || replace(foreign_key.table_name, 'public.', '') || '_' || foreign_key.conname,
      foreign_key.table_name, foreign_key.columns);
  END LOOP;
END $$;
