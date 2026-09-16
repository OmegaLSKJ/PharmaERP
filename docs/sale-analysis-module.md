# Sale Analysis reporting module

Open **Reports → Sale Analysis Reports**, or `/reports/sale-analysis` after signing in. The existing Sales Analytics screen is unchanged.

## Integration boundary

The only additions to existing application files are one import and one route in `src/App.tsx`, plus one menu entry in `src/components/layout/Sidebar.tsx`. Everything else is new and isolated under `src/modules/sale-analysis`, two dedicated API route files, documentation, and tests. No existing transaction, stock, accounting, authentication or database code is changed. No dependencies, package versions, environment configuration, database objects, RLS policies or business records are modified.

The authenticated, GET-only endpoint is `/api/v1/report-sale-analysis`. Both the root Next.js application and the `apps/web` entry point expose it. It reuses existing server credentials (`SUPABASE_URL` and `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`), session verification and `reports.read` permissions. Only trusted app metadata is considered for role/organization checks. The configured organization matches the ERP's existing `ERP_ORGANIZATION_NAME`, defaulting to `Borgang Drug Distributors`.

The existing Supabase tables are server-only. The report uses that established access model with an organization filter on every query, including child-table joins. No service credential reaches the browser. Responses use `Cache-Control: private, no-store`; missing credentials, authentication failure or a partial query produce an error, never demo data. It does not call the ERP store's `context()` function because that helper writes financial-year and series defaults even during reads.

## Source coverage

All pages of the relevant organization data are fetched using deterministic ID ordering and exact counts. Responses below the requested page size are handled correctly; changed counts, duplicate IDs and incomplete reads fail the request. Tables queried:

- `sales_invoices` and `sales_invoice_lines`
- `business_documents` for sale returns, orders, claims/incentives, replacements, breakages, amendments and legacy receipts
- `items`, `item_batches`, `manufacturers`, `parties`, `warehouses`
- `stock_movements`
- `delivery_challans` and `delivery_challan_lines`
- `vouchers`, `voucher_lines`, `chart_of_accounts`, `receipts_payments`
- `audit_logs`, restricted to sales invoice amendment events
- `inventory_adjustments` and `inventory_adjustment_lines`

No contact fields, authentication records or prescription registers are copied into reports. Raw business-document details remain server-side; only normalized report fields are returned. Loading source tables is not a single database transaction: the report shows its load time and can be refreshed after concurrent edits.

## Report definitions

The module implements the 16 visible Sale Analysis entries from the supplied image. The complete names and individual definitions live in `catalog.ts` and are shown in each report's **Report basis** section. Hidden submenus are not claimed as implemented. Misc.Sale uses a proposed salesperson summary; the partly unreadable S/R entry is explicitly described as provisional.

- Invoice/header values are authoritative. Cancelled and draft sales are excluded. Processed/posted returns reverse values. Missing invoice lines remain visible as **Unallocated invoice values**, with quantities/costs unavailable.
- Differences between header and line amounts, including invoice rounding, are explicit reconciliation rows. They are never assigned to invented items or companies. Filtering by item/company excludes unallocated amounts. Item and party groupings use IDs, so similar names and reused document numbers do not collapse distinct records.
- Unknown values are rendered as a dash and exported blank; affected totals also stay unavailable. Missing batch cost is not silently treated as a zero-cost acquisition. Item margin uses **current recorded cost**, not historical COGS.
- Stock uses signed movements through the selected To date in India local time, grouped by batch and warehouse. It includes negative balances; zero balances are omitted. The From date and party filter do not apply. Valuation uses current batch cost, batch purchase price, or item purchase rate in that order, choosing the first positive recorded value. Historical cost and bank certification are not implied.
- Receipt allocations take precedence over their linked receipt voucher party lines to prevent double counting. Matching legacy voucher documents can recover missing receipt lines; unmatched legacy receipts remain visible. Receipt vouchers without known amounts stay blank. Receipt/payment rows without a matching voucher are flagged and excluded because direction cannot be established safely.
- Claims, orders and adjustments use explicit source documents. Purchase orders are excluded. Claims are not inferred or seeded. Orders and dispatches are not summed as if they were distinct stock issues.
- Audited invoice replacements appear as informational amendments with the original invoice reference. Their replacement value is separate from sales totals; cancelled originals are excluded from sales. Amendments do not repost or alter invoices.
- Posted inventory adjustments show the quantity, direction, warehouse and current cost valuation. Unknown costs remain blank; stock balances still come only from stock movements, preventing double counting.

## Features

Date, party, manufacturer/company and item filters; search; sorting; pagination; source counts and data-quality notes; explicit refresh; CSV export of every filtered row; print / Save as PDF with all filtered rows. CSV text is escaped against spreadsheet formula injection. Export and print include source, date, filter and calculation context. No transaction data is persisted in browser storage or committed to Git.

## Validation

Run `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`. The module tests cover reconciliation, missing lines, return signs, free goods, unknown costs/tax, stock dates/warehouses, receipt deduplication, pagination beyond 1,000 rows, incomplete reads, authorization, organization scoping and error redaction.

Live source reconciliation is performed separately against the configured Supabase organization. Any temporary reconciliation extracts must stay in ignored `scratch/` and must never be staged or published.
