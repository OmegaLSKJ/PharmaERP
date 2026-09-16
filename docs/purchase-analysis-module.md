# Purchase Analysis reporting module

Open **Reports → Purchase Analytics**. It replaces the former generic Purchase Analytics screen with the report choices shown in the supplied reference: consolidated and item-level purchase books, returns, miscellaneous purchase activity, item/company/party summaries, discounts, monthly summaries, and purchase adjustments.

The authenticated GET-only endpoint `/api/v1/report-purchase-analysis` reuses the existing server Supabase credentials, session verification, and `reports.read` permission. It reads only the configured organization and returns `Cache-Control: private, no-store`. No browser receives a service credential, and missing credentials or an incomplete query return an error instead of demo data.

Sources are the existing `purchase_invoices`, `purchase_invoice_lines`, `business_documents`, filtered purchase-amendment `audit_logs`, and item, batch, manufacturer, and party masters. Each source is read in verified, deterministic pages. Purchase headers are authoritative: bill values not represented by lines remain as **Unallocated bill values**, so they are not assigned to an invented item or company. Cancelled and draft bills are excluded; posted or processed returns reverse values. Amendments are informational and do not create another purchase value.

The label in the source image ending in `### on Bills` is partly obscured. The module presents it as **P/R, Breakage / Expiry & Bill Adjustments**, and lists only explicit source documents. Empty report views reflect the current source data; no returns, adjustments, or amendments are inferred.

Every view supports date, supplier, company, and item filters; search; sorting; pagination; CSV export; and printing. Exports include all filtered rows and escape spreadsheet formulas. Unknown source fields are blank and make affected totals unavailable.
