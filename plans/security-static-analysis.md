# ERP Project — Static Security Analysis

Scope: `c:/Users/SCL/Downloads/ERP` (Next.js web app in `apps/web`, Vite SPA in `src/`, Supabase/Postgres backend, dev scripts in `scripts/`).
Method: manual static review of the key files listed in the task plus pattern searches (SQL keywords, `Math.random`, `eval`/`child_process`, secret literals, `JSON.parse`, log statements).

---

## Executive Summary

| # | Category | Result | Highest Risk |
|---|----------|--------|--------------|
| 1 | SQL Injection | No raw-SQL concatenation in app code (Supabase PostgREST + parameterized RPCs) | Low |
| 2 | Command Injection | No `child_process`/`exec`/`spawn` anywhere | None |
| 3 | Path Traversal | No user-controlled server file paths | None |
| 4 | Insecure Deserialization | No `eval`/`new Function`/YAML; `JSON.parse` only on local/trusted data | Low |
| 5 | Hardcoded Secrets | **Production secrets present in `.env.local` / `.env.production.local`** | **Critical** |
| 6 | Insecure Randomness | `Math.random` only for business doc numbers, never for auth/tokens | Low |
| 7 | Missing Input Validation | Basic checks present; no range/bound checks on financial values | Medium |
| 8 | Race Conditions | TOCTOU on doc-number generation and stock availability | **High** |
| 9 | Business Logic Flaws | Service-role key bypasses RLS; no transaction boundaries; weak idempotency | **High** |
| 10 | Log Injection | `JSON.stringify` mitigates newline forging | Low |

The application is structurally sound against the classic injection classes (1–4, 6, 10). The material risks are **secret hygiene (5)**, **concurrency/atomicity in financial & inventory writes (8, 9)**, and **authorization depth (9)**.

---

## 1. SQL Injection — Low

All data access goes through the Supabase JS client (PostgREST) using parameterized filters (`.eq`, `.in`, `.or`, `.ilike`) or named RPCs. No raw SQL string is built from user input in `apps/web/lib/erp-store.ts` or `apps/web/lib/api-handler.ts`.

- Table names are never taken from user input. The `resource` path param is only used as a key into fixed maps:
  - [`documentResources`](apps/web/lib/erp-store.ts:3028), [`managedCrud`](apps/web/lib/erp-store.ts:11), [`masterTables`](apps/web/lib/erp-store.ts:5512).
- RPCs pass structured objects, not interpolated strings: [`erp_post_invoice`](apps/web/lib/erp-store.ts:4364), [`erp_cancel_invoice`](apps/web/lib/erp-store.ts:3967), [`erp_import_master`](apps/web/lib/erp-store.ts:3287), [`erp_import_invoices`](apps/web/lib/erp-store.ts:3330), [`erp_amend_invoice`](apps/web/lib/erp-store.ts:5157).

**Residual note (dev tooling, not runtime):** the SQL seed generators interpolate values into generated `.sql` files with only single-quote escaping:
- [`generate_hsn_sql.js`](scripts/generate_hsn_sql.js:17) — `h.code.replace(/'/g, "''")`
- [`generate_items_sql.js`](scripts/generate_items_sql.js:20) — also interpolates into a `REGEXP_REPLACE` pattern
- [`generate_catalog_manufacturers.mjs`](scripts/generate_catalog_manufacturers.mjs:51)

These run locally against trusted `mock-stock-data.json`, so risk is low, but the escaping is incomplete (no handling of backslashes / `E''` edge cases).

**Remediation:** none required for runtime. For the generators, prefer `pg`-style quoting or parameterized seeding when the scripts are ever pointed at a live DB.

---

## 2. Command Injection — None

No `child_process`, `exec`, `execSync`, `spawn`, `spawnSync`, or `execFile` in `scripts/` or `src/`. Scripts use `node:fs`, `node:path`, `pandas`, and `urllib` only. The single `$eval` hit in [`verify_phase2.mjs`](verify_phase2.mjs:17) is Playwright's `page.$eval` (DOM evaluation), not JS `eval`.

**Remediation:** none.

---

## 3. Path Traversal — None

- [`src/lib/download.ts`](src/lib/download.ts:3) is entirely client-side (Blob + `URL.createObjectURL` + `<a download>`). No server filesystem access.
- [`ServerUpload.tsx`](src/pages/transactions/ServerUpload.tsx:7) is a read-only "Supabase Sync Status" page — it performs **no** file upload despite its name.
- [`TransactionImport.tsx`](src/pages/transactions/TransactionImport.tsx:60) parses CSV/XLSX in the browser (PapaParse / read-excel-file) and POSTs JSON; the server never touches a file path.
- Server-side writes in [`erp-store.ts`](apps/web/lib/erp-store.ts:1250) use hardcoded `path.resolve(process.cwd(), '...')` targets with no user input in the path.

**Remediation:** none.

---

## 4. Insecure Deserialization — Low

- No `eval(`, `new Function(`, or YAML parsing anywhere in `src/`, `apps/`, or `scripts/`.
- `JSON.parse` on untrusted-ish input is limited to:
  - [`erpApi.ts:70`](src/lib/erpApi.ts:70) — `JSON.parse(event.newValue)` from a `localStorage` storage event (same-origin, low risk).
  - Dev scripts reading local JSON files (e.g. [`import_hsn_master.js:36`](scripts/import_hsn_master.js:36)).
- API bodies are parsed by the framework (`await request.json()` in [`api-handler.ts:105`](apps/web/lib/api-handler.ts:105)) and then shape-checked.

**Remediation:** none material. Optionally wrap the `localStorage` parse in a schema check (it is already in a `try/catch`).

---

## 5. Hardcoded Secrets — **Critical**

### 5a. Production secrets in local env files (Critical)
[`.env.local`](.env.local:2) and [`.env.production.local`](.env.production.local:26) contain live production values:
- `DATABASE_URL` (Postgres/Supabase connection string)
- `ERP_API_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (service-role key → full DB access, bypasses RLS)
- `SUPABASE_URL`
- `VERCEL_OIDC_TOKEN` — a **full JWT in plaintext** (both files, line 26)

Mitigating factor: [`.gitignore:28`](.gitignore:28) lists `.env*`, so these should not be committed. **However**, they sit in the working tree and will leak via any zip/share/sync of the folder, and the OIDC JWT is not masked by any secret-scanner pattern.

**Remediation (priority order):**
1. Rotate the Supabase service-role key, `DATABASE_URL` credentials, and `ERP_API_KEY` immediately (treat as exposed).
2. Delete the `VERCEL_OIDC_TOKEN` lines (it is a short-lived deployment token; do not persist it).
3. Add a pre-commit/CI secret scan (gitleaks/trufflehog) and a `.env*` guard.
4. Confirm with `git ls-files | grep -i env` that no `.env*` is tracked; if any is, purge history (`git filter-repo`).

### 5b. Hardcoded mock admin credentials (Medium)
[`auth.ts:70`](apps/web/lib/auth.ts:70) — `admin@borgangdrugdistributors.com` / `admin12345678` and the mock tokens at [`auth.ts:80`](apps/web/lib/auth.ts:80) / [`auth.ts:110`](apps/web/lib/auth.ts:110). Gated by `!hasRealSupabase()` and `NODE_ENV !== 'production'`, so they are dev-only, but a weak, guessable admin password in source is a bad default.

**Remediation:** move the dev fallback to a clearly-named local-only file that is gitignored, or require an explicit `ENABLE_MOCK_AUTH=1` flag; never ship a default admin password.

### 5c. Service-role key used outside the app (Low)
[`import_stock.py:70`](scripts/import_stock.py:70) reads `.env.production.local` and calls the Supabase REST API with the service key. Acceptable for an ops script, but it widens the blast radius of the key.

**Remediation:** use a least-privilege scoped key or a short-lived token for scripts.

---

## 6. Insecure Randomness — Low

`Math.random()` appears only for **business document numbers / mock IDs**, never for auth tokens, session IDs, or CSRF:
- [`erp-store.ts:1313`](apps/web/lib/erp-store.ts:1313), [`:1351`](apps/web/lib/erp-store.ts:1351) — mock item/batch IDs
- [`erp-store.ts:1536`](apps/web/lib/erp-store.ts:1536) — account code
- [`erp-store.ts:4713`](apps/web/lib/erp-store.ts:4713) — voucher-number collision retry suffix
- Test files only

Auth/session identifiers come from Supabase (`crypto.randomUUID()` for request IDs in [`api-handler.ts:79`](apps/web/lib/api-handler.ts:79)).

**Remediation:** none for security. (Uniqueness concerns are covered under §8.)

---

## 7. Missing Input Validation — Medium

Present and good:
- Body shape check in [`api-handler.ts:106`](apps/web/lib/api-handler.ts:106); `id` required for PATCH/DELETE ([`:123`](apps/web/lib/api-handler.ts:123), [`:139`](apps/web/lib/api-handler.ts:139)).
- Import validation: required columns, 5,000-row cap, enum check on `party_type` ([`erp-store.ts:3277`](apps/web/lib/erp-store.ts:3277)); NaN-safe [`importNumber`](apps/web/lib/erp-store.ts:3272).
- Voucher balance check (`|debit − credit| ≤ 0.001`) at [`erp-store.ts:4677`](apps/web/lib/erp-store.ts:4677).
- Stock-availability and transfer sanity checks ([`:4033`](apps/web/lib/erp-store.ts:4033), [`:4244`](apps/web/lib/erp-store.ts:4244)).

Gaps:
- **No range/bound validation on financial values.** Many handlers cast with `Number(...)` and store the result unchecked, e.g. `Number(body.total || 0)`, `Number(body.capacity || 0)`, `Number(body.openingBalance || 0)`. A client can post absurdly large or negative totals/quantities; only the voucher path enforces balance.
- **No array-type guard on `body.lines`** in several create paths (sales/purchases/challans assume `Array.isArray(body.lines)`).
- **No date-format validation** on most `body.date` fields (only expiry is normalized via [`normalizeExpiryDate`](apps/web/lib/erp-store.ts:26)).

**Remediation:** add a small validation helper (finite number, `>= 0` where applicable, max bound, ISO-date regex, `Array.isArray`) and apply it at the top of each `create`/`update` handler.

---

## 8. Race Conditions (TOCTOU) — **High**

### 8a. Document-number generation (High)
- [`getNextSeriesNumberDb`](apps/web/lib/erp-store.ts:343) reads `next_number`, formats it, then `update({ next_number: nextNo + 1 })`. Two concurrent requests read the same value → **duplicate invoice/challan numbers**. No row lock, no atomic `update ... set next_number = next_number + 1 ... returning`.
- Fallback [`number()`](apps/web/lib/erp-store.ts:23) = `PREFIX-YYYY-<last 6 digits of Date.now()>`. The 6-digit millisecond tail **wraps every ~16.7 minutes**, so collisions are guaranteed under load, not just at the same millisecond. Used for `TRF`, `CH`, `VCH`, `BRK`, `SI`, `PB` (see [`:4255`](apps/web/lib/erp-store.ts:4255), [`:4633`](apps/web/lib/erp-store.ts:4633), [`:4678`](apps/web/lib/erp-store.ts:4678)).

**Remediation:** make the increment atomic in Postgres — `update document_series set next_number = next_number + 1 where id = ... returning next_number` (single round-trip), or a `select ... for update` inside a transaction. Replace the `Date.now()`-tail scheme with the series table everywhere.

### 8b. Stock availability check-then-write (High)
Breakage ([`:4032`](apps/web/lib/erp-store.ts:4032)) and stock transfer ([`:4250`](apps/web/lib/erp-store.ts:4250)) read available quantity, validate, then insert a negative movement — **no transaction and no lock**. Two concurrent operations can both pass the check and drive stock negative (oversell / over-break).

**Remediation:** perform the availability check and the movement insert inside a single Postgres transaction with a row lock on the batch/warehouse, or enforce a `CHECK (quantity >= 0)`-style constraint / trigger so the DB rejects the oversell.

### 8c. Item/batch get-or-create (Medium)
[`stock()`](apps/web/lib/erp-store.ts:1723) and [`party()`](apps/web/lib/erp-store.ts:1525) do select-then-insert. Unique constraints (`organization_id,code` / `item_id,batch_number`) prevent true duplicates, but the loser of the race gets a constraint error that is not always handled cleanly.

**Remediation:** use `upsert` (`.upsert(..., { onConflict })`) instead of select-then-insert.

### 8d. Voucher number (Medium, partially mitigated)
Voucher insert has a 5-attempt retry that regenerates the number on `23505` duplicate-key ([`:4685`](apps/web/lib/erp-store.ts:4685)–[`:4717`](apps/web/lib/erp-store.ts:4717)). This is a good pattern but still relies on `Math.random` for the retry suffix and on catching the constraint error.

**Remediation:** drive voucher numbers from the atomic series increment (§8a) and drop the random suffix.

---

## 9. Business Logic Flaws — **High**

### 9a. Authorization depth / RLS bypass (High)
[`db()`](apps/web/lib/erp-store.ts:1424) builds the client with the **service-role key**, which bypasses Row-Level Security. Consequently, **all** authorization rests on the in-app `canAccess` check in [`api-handler.ts:76`](apps/web/lib/api-handler.ts:76) + [`permissions.ts`](apps/web/lib/permissions.ts:39). A single missed route or a mis-mapped resource silently grants full-DB access. The DB migrations include RLS policies (`database/migrations/002_supabase_rls.sql`), but they are ineffective for the service-role path.

Additionally, the `operator` role is granted `masters.write`, `transactions.write`, and `accounting.write` ([`permissions.ts:34`](apps/web/lib/permissions.ts:34)) — a broad grant for the least-privileged role.

**Remediation:**
- Enforce RLS at the database for the hot tables and use a **per-user** (anon/user-scoped) client for reads, reserving the service key for genuinely server-only jobs.
- Add a deny-by-default test that asserts every resource in `erp-store.ts` is reachable only by the intended roles.
- Re-review the operator grant list; consider removing `accounting.write` from operators.

### 9b. Missing transaction boundaries in multi-step writes (High)
Several financial/inventory operations perform multiple writes with **no atomicity**:
- Voucher: insert voucher → insert lines → set `posted`; on line failure it compensates by deleting the voucher ([`:4734`](apps/web/lib/erp-store.ts:4734)) — a crash between steps leaves an orphan draft.
- Sales/purchases **fallback** path: insert invoice → insert lines → insert stock movements, with line errors swallowed as "non-fatal" ([`:4427`](apps/web/lib/erp-store.ts:4427)) — can leave a posted invoice with missing lines/stock.
- Party creation: party → address → details → chart-of-accounts ([`:3977`](apps/web/lib/erp-store.ts:3977)).
- Stock transfer: document → movements ([`:4255`](apps/web/lib/erp-store.ts:4255)).

The primary invoice path uses the `erp_post_invoice` RPC (likely transactional server-side), but the **fallback** and the voucher/party/transfer paths are not.

**Remediation:** wrap each multi-step operation in a single Postgres transaction (Supabase `rpc` or a `pg` transaction), or move the logic into RPCs that already transact. Never swallow line-insert errors on a posted invoice.

### 9c. Weak idempotency (Medium)
No idempotency key / duplicate-invoice guard is visible in the `create` path for sales/purchases; uniqueness depends on the RPC and on the (racy) number generation. A retried POST can double-post.

**Remediation:** accept a client-generated idempotency key (or use `invoice_number` as a natural key with `onConflict`), and make the RPC `SELECT ... FOR UPDATE` on the number before posting.

### 9d. Inconsistent cancellation semantics (Medium)
The mock `cancellations` handler only flips `status` and does **not** reverse stock/vouchers ([`:3426`](apps/web/lib/erp-store.ts:3426)), whereas the DB path calls `erp_cancel_invoice` ([`:3960`](apps/web/lib/erp-store.ts:3960)). Behavior diverges between mock and live modes.

**Remediation:** make the mock path mirror the DB path (reverse stock + voucher) or remove the mock branch in production builds.

### 9e. Integer overflow in financial calculations (Low)
[`invoiceCalculations.ts`](src/lib/invoiceCalculations.ts:2) and [`financialData.ts`](src/lib/financialData.ts:113) use `Math.round`/`Number.EPSILON` on IEEE-754 doubles; no realistic overflow below 2^53. Negative/absurd inputs are the real risk (see §7), not overflow.

**Remediation:** none for overflow; add the input bounds from §7.

---

## 10. Log Injection — Low

- [`api-handler.ts:33`](apps/web/lib/api-handler.ts:33) logs `message: raw` (which can echo user-influenced error text) but via `JSON.stringify`, which escapes `\n`/`\r`, so newline-based log forging is mitigated.
- Numerous `console.warn(..., err)` in [`erp-store.ts`](apps/web/lib/erp-store.ts:327) log error objects, not raw user strings.

**Remediation:** keep logging through `JSON.stringify` (or a structured logger); avoid interpolating user input into plain-text log lines.

---

## Prioritized Remediation Plan

1. **Rotate & purge secrets** (Critical, §5a): rotate Supabase service key / DB creds / ERP_API_KEY; delete persisted `VERCEL_OIDC_TOKEN`; add secret scanning; verify no `.env*` is git-tracked.
2. **Fix document-number races** (High, §8a): atomic `next_number` increment in Postgres; retire the `Date.now()`-tail `number()`.
3. **Make stock & financial writes atomic** (High, §8b/§9b): wrap multi-step operations in transactions; add a DB constraint/trigger preventing negative stock.
4. **Deepen authorization** (High, §9a): enforce RLS for user-scoped access, add deny-by-default permission tests, re-review operator grants.
5. **Harden input validation** (Medium, §7): finite/bounded number + date + array guards at handler entry.
6. **Add idempotency** (Medium, §9c): idempotency key / natural-key upsert on invoice posting.
7. **Remove default mock admin password** (Medium, §5b): gate behind an explicit flag / gitignored local file.
8. **Align mock vs live cancellation** (Medium, §9d).
9. **Harden SQL generators** (Low, §1): proper quoting if ever run against a live DB.
