# PharmaERP — Agent Summary

## Objective
Build and maintain a production-quality pharmaceutical distribution ERP for **Borgang Drug Distributors**.
Live deployment: [pharama-erp.vercel.app](https://pharama-erp.vercel.app)

## Project Root
`C:\Users\SCL\Downloads\ERP` — all code, migrations, tests, and documentation live here.

## Technology Stack
- **Frontend:** React 19 + Vite + TypeScript (SPA in `src/`)
- **Server/API:** Next.js 16 App Router (`apps/web/`, API routes at `src/app/api/`)
- **Database:** Supabase PostgreSQL with Row-Level Security and server-only access
- **State:** Zustand (`src/store/authStore.ts`, `src/store/uiStore.ts`)
- **Styling:** Tailwind CSS + shadcn-style component library
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Deployment:** GitHub → Vercel CI/CD

## Repository Layout

| Path | Purpose |
|------|---------|
| `src/` | Vite SPA — all UI, pages, components, modules, lib |
| `src/app/api/` | Next.js API routes (`/api/v1/[resource]`, `/api/auth/`, `/api/health/`) |
| `apps/web/` | Next.js host, auth middleware, API handler, erp-store |
| `apps/mobile/` | Expo starter — field operations (in progress) |
| `packages/domain/` | Shared ERP contracts and API types |
| `packages/design-tokens/` | Platform-neutral visual tokens |
| `database/migrations/` | 34 sequential PL/pgSQL migrations (Supabase) |
| `tests/` | 29 test files — 149 unit + integration tests |
| `plans/` | Architecture decisions, security reports, roadmaps |
| `docs/` | Developer documentation |

## ERP Modules

### Masters
- Parties (suppliers & customers with Party360 view)
- Items, Batches, Manufacturers, Salts, HSN/SAC codes
- Ledgers, Locations, Series, Communication Blocking, Item Mapping

### Transactions
- Sales: entry, register, return, counter-sale, challan
- Purchases: entry, register, return, orders
- Breakage, Replacements, Price Difference, Claim Settlement
- CSV / Server import pipelines, Pending management

### Inventory
- Live stock, batch-level stock, stock ageing & expiry tracking
- Stock movement, negative stock, dump stock, hold/ban stock
- Reservations, inventory adjustments

### Accounting
- Voucher entry, Day Book, Ledger View, Selected Book
- Debit Notes, Credit Notes, Item Day Book

### GST & Compliance
- GSTR-1, GSTR-3B, GSTR-Summary, GSTR-9, GSTR Reconciliation
- e-Invoice, TDS/TCS
- Drug Licenses, Product Recalls, Controlled Drug Register

### Reports
- Sales Analytics, Sale Analysis, Purchase Analysis, Fast/Slow Moving
- Trial Balance, P&L, Balance Sheet, Cash Flow, Ratio Analysis, Accounts Reports

### Operational
- Delivery Management, Pricing Schemes, Settings, Role-Based Admin

## Key Library Files

| File | Purpose |
|------|---------|
| `src/lib/erpApi.ts` | Two-tier cache (memory + IndexedDB), SWR revalidation, cross-tab BroadcastChannel sync |
| `src/lib/erpCache.ts` | IndexedDB persistence layer, stale check, TTL management |
| `src/lib/erpPreloader.ts` | Background preload of critical ERP resources on startup |
| `src/lib/invoiceCalculations.ts` | Discount-before-tax invoice math with rounding adjustment |
| `src/lib/hsnUtils.ts` | HSN/SAC master cache with DB bootstrap |
| `src/lib/printUtils.ts` | Invoice / challan print rendering |
| `src/lib/seriesUtils.ts` | Document series management and cascade |
| `src/lib/similarity.ts` | Fuzzy item/party search |
| `src/lib/download.ts` | CSV / Excel export utilities |
| `src/lib/financialData.ts` | Financial report data transformations |

## Database Schema Highlights
- **34 migrations** covering: initial schema, RLS policies, security indexes, operational modules, hardening, period guards, cancellation workflows, note posting, invoice amendments, stock import, and comprehensive security lockdown.
- Row-Level Security enforced on all tables via `organization_id`.
- Accounting period guard prevents mutations to closed periods.
- Audit logs capture `actor_email`, `ip_address`, `request_id`, and `metadata`.
- Drug schedule class constraint: `OTC | H | H1 | X | NDPS`.
- Stock reservation lifecycle: `active → released → consumed → expired`.
- Seeded master data: HSN codes, 2016+ items catalog, manufacturers, accounting groups.

## Test Suite

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| Vitest (unit/integration) | 28 passed, 1 skipped | 149 passed, 1 skipped | ✅ All green |
| Playwright E2E | chromium + mobile | 6 passed | ✅ All green |

Key test areas: invoice calculations, RBAC permissions, full CRUD lifecycle, HSN mapping (100% coverage), series cascade, sale/purchase analysis, cache/preloader, party dual-role, print utilities, security hardening, company settings reflection.

## Security Posture
See [`plans/SECURITY_AND_BUG_REPORT.md`](plans/SECURITY_AND_BUG_REPORT.md) for the full audit.
Overall rating: **C+ (Medium-High Risk)** — strong architectural foundation, several critical operational gaps to address.

Top priorities:
1. Rotate hardcoded secrets in `.env.local` / `.env.production.local`
2. Remove mock admin credentials in `apps/web/lib/auth.ts`
3. Upgrade `next` to `^16.3.7` (2 critical RCE advisories)
4. Add PII column-level encryption (pgcrypto)
5. Fix race conditions in document numbering and stock writes

## Work State

### Completed
- Full ERP feature set across all modules (see Module list above)
- 34-migration production DB schema with hardening, RLS, and audit trails
- Dual-runtime architecture (Vite SPA + Next.js API/SSR)
- Comprehensive test suite (149 unit + 6 E2E tests, all passing)
- GitHub → Vercel CI/CD pipeline active
- Seeded master data (HSN, items, manufacturers, accounting groups)
- Security & bug audit report written to `plans/SECURITY_AND_BUG_REPORT.md`

### Active / In Progress
- Addressing security findings from audit (see remediation roadmap in report)
- Mobile app (`apps/mobile/`) field-operations features (Expo starter)

### Blocked
- None critical

## Next Steps
1. **Immediate:** Rotate secrets, remove mock auth, upgrade Next.js (C-1, C-2, C-3)
2. **This sprint:** CSP header, rate limiting, race condition fixes, RLS hardening (H-1 through H-11)
3. **Next sprint:** CSV formula injection fix, QR local generation, MFA, coverage reporting
4. **Ongoing:** Component-level React tests, mobile app build-out, audit log partitioning
