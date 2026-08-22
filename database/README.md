# PostgreSQL backend

Set `DATABASE_URL` to a PostgreSQL 15+ database, then apply `migrations/001_initial_erp_schema.sql` using your migration runner. The schema models the ERP relationship chain:

`Organization → Party / Item / Warehouse → Batch → Stock movement`

`Party → Sales invoice → Invoice line → Batch` and `Sales invoice → Voucher → Voucher line → Chart of accounts`.

`Party → Delivery challan → Challan line → Batch`, while receipts and payments reference their accounting voucher. Every mutable business document has a status and audit-log target.
