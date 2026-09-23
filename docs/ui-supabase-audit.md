# UI to Supabase audit

Audited: 2026-09-23. Scope: every routed ERP screen, its visible data-bearing fields, and the API path used to populate or save it.

## Result

The application does have a shared, authenticated server-side Supabase path: browser pages call `getErp`, the API route calls `apps/web/lib/erp-store.ts`, and that module scopes queries by `organization_id`. The product detail panel has its own live endpoint and polls it every 15 seconds.

This is **not** yet a fully Supabase-backed UI. Some routes contain hard-coded arrays (usually empty), some values are deliberately calculated in the browser, and several server resources silently fall back to `mockStore` / local JSON if the live result is empty or smaller than the mock fixture. A value shown on one of those screens can therefore be non-live even though the page did issue an API request.

## Product, batch, and stock field mapping

| UI field / column | API field | Supabase source | Result |
| --- | --- | --- | --- |
| Item code, name, packing, unit, MRP, sale rate, purchase rate, active status | `items` | `items.code`, `name`, `packing`, `unit`, `mrp`, `sale_rate`, `purchase_rate`, `is_active` | Connected. |
| Manufacturer, salt, HSN, GST | `items` | `manufacturers.name`, `salts.name`, `hsn_codes.code`, `hsn_codes.gst_rate` | Connected by relations; the source data is incomplete. |
| Item stock and batch count | `items` | `item_batches` and their `stock_movements.quantity` | Connected; stock is calculated as the movement sum. |
| Batch, expiry, MRP, cost, purchase price, sale price | `items`, `item-batches` | corresponding `item_batches` columns | Connected. |
| Sales/purchase schemes, received/manufactured dates, supplier, invoice, rack, source value | `items`, `item-batches` | `item_batches.*` plus `parties.legal_name` | Connected. |
| Item Form batch value | browser calculation | `reportedValue`, otherwise `stock * costPrice` | Calculated, with an explicit stored-value fallback. |
| Stock View value | browser calculation | `purchaseRate * stock` | Calculated. |
| Stock View location | browser constant | currently always `Main Warehouse` | **Not connected to the actual warehouse movement location.** |
| Product Description modal | `product-detail` | item, batch, stock movement, HSN, manufacturer/salt data | Connected and live-refreshed when the dialog is open. |
| Pricing scheme overrides | browser `localStorage` | no Supabase table used | **Not connected.** |

### Current data completeness

The live organization has 2,033 items and 3,801 batches. Item master gaps: 2,028 items have no packing, 14 no manufacturer, 1,741 no HSN, 6 no sale rate, and 159 no purchase rate. Batch gaps: 19 have no expiry, 1,675 no supplier invoice number, 1 no MRP, 22 no sale price, and 308 no purchase price. These are source-data gaps; the UI field links above do exist.

## Routed screen audit

`Live` means the screen retrieves or writes through the authenticated ERP API. `Derived` means it calculates the displayed values in the browser from live inputs. `Mock fallback` means the route can return fixture/local JSON data when Supabase is empty or below a fixture threshold. `Not connected` means no retrieval logic exists for the displayed business data.

| Area | Routes | Data source and result |
| --- | --- | --- |
| Dashboard | `/` | `dashboard` is live from invoices, items and stock position. Mock fallback contains fabricated charts, alerts and invoice rows. |
| Party masters | `/masters/parties`, `/masters/parties/:id` | `parties`, `ledgers`; live, but party balances and last sale are returned as placeholders and parties are merged with mock rows. |
| Item masters | `/masters/items`, `/inventory/items`, `/masters/items/new`, `/masters/items/:id` | `items`, HSN, salts and manufacturers; live fields listed above. The item endpoint returns mock items whenever the live row count is smaller than the local fixture. |
| Batch master | `/masters/batches` | `items`, `item-batches`; live CRUD and live movement totals. Falls back only when no batches are returned. |
| Other masters | manufacturer, HSN, salt, location, mapping, series, communication routes | Live CRUD against their corresponding tables. Manufacturers, mappings, accounts, and parties have mock fallbacks/merges; the others return live rows. |
| Sale and purchase entries/registers | sale, counter sale, sale return, purchase, purchase return routes | Live parties/items/invoices and document CRUD. Rate, tax and totals are browser calculations from loaded item and line fields. All inherit any `items`/`parties` fallback. |
| Orders, breakage, replacement, challan | respective transaction routes | Live `business_documents`, invoices, and stock updates. Some list values are derived from document JSON details. |
| Pending, price difference | `/transactions/pendings`, `/transactions/pricediff` | **Not connected.** Both use empty constants, so all summaries and table cells are empty/non-live. |
| Claim settlement | `/transactions/claims` | **Not connected.** Uses an empty `CLAIMS` constant. |
| Manual server upload | `/transactions/upload` | **Not connected.** Uses empty upload lists; Sync Now only changes local button state. |
| Transaction import | `/transactions/import` | Live `bulk-import` write path. File preview and session history are browser-only by design. |
| Voucher, day book, ledger, selected book, notes, item day book | accounting routes | Live resources, mostly derived from vouchers and invoices. Their fallback implementations use mock transactions. |
| Stock, ageing, movement, negative, dump, hold/ban | inventory routes | Live items, stock position, warehouses and adjustment endpoints. Stock View has the fixed location limitation above; Dump Stock and movement metrics are browser calculations. |
| Reservations and adjustments | inventory CRUD routes | Live managed CRUD tables. |
| GST and e-invoice | GST routes | Live sales, purchases, parties, and ledgers; GST figures are browser calculations. |
| Sale analysis and purchase analysis | `/reports/sale-analysis`, `/reports/purchases` | Dedicated authenticated Supabase report endpoints. Filters, sorting, paging, and totals are browser-side views of live report rows. |
| Sales analytics and purchase analytics | `/reports/sales`, legacy `/reports/purchases` implementation | `report-sales` and `report-purchases`; live invoice data, but dates on the legacy analytics pages are currently UI-only and do not alter the server query. |
| Fast/slow moving | `/reports/fastslow` | Live items and sales; velocity and stock value are browser-derived. |
| Trial balance, P&L, balance sheet, ratio, cash flow, financial reports | report routes | `fetchLiveFinancialData` uses live accounts, parties, sales, purchases, items and vouchers, then calculates statements in the browser. It assumes 12% GST and uses estimated cost where invoice lines lack purchase cost, so it is linked but not accounting-authoritative. |
| Accounts reports | `/reports/accounts` | Live accounts, vouchers, invoices and series. |
| Delivery management | `/delivery` | **Not connected.** Fixed `DATA` array. |
| Pricing | `/pricing` | Items/rates are live; custom schemes are stored only in browser local storage. |
| Settings | `/settings` | User administration is live through the admin API. Company/statutory profile fields save only to the UI store and are **not** persisted to Supabase. |
| Login | `/login` | Connected to the authentication invite endpoint; it is not a business-data screen. |

## Server resource risks found

1. `items`, `manufacturers`, `parties`, `item-mappings`, `accounts`, and reporting resources can emit `mockStore` data. This is the main reason a screen can look connected while showing values that are not from Supabase.
2. `list('parties')` deletes duplicate party rows during a read. A data retrieval endpoint must not mutate production data.
3. The application cache lasts up to two minutes for normal reads. Product Detail is an exception because it forces a refresh every 15 seconds. Other pages need explicit refresh/revalidation if immediate updates are required.
4. Financial report labels describe live ledgers, but the displayed statements are reconstructed with assumptions and fallbacks rather than queried from a finalized accounting view.

## Repair order

1. Remove mock/JSON fallbacks for authenticated production requests and show an explicit empty/error state instead.
2. Connect Pending, Price Difference, Claims, Delivery, Server Upload, pricing schemes, and company profile to tables or document queries.
3. Change Stock View to use each `stock_movements.warehouses.name` value rather than the hard-coded Main Warehouse label.
4. Complete master/batch data for packing, HSN, pricing, and supplier references, then make the financial reports query finalized accounting values.
