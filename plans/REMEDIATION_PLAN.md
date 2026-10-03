# ERP Security Remediation Plan

**Date:** 2026-09-30
**Sources:** [`plans/SECURITY_AND_BUG_REPORT.md`](plans/SECURITY_AND_BUG_REPORT.md) (43 ID'd findings) + [`plans/security-static-analysis.md`](plans/security-static-analysis.md) (7 additional un-ID'd findings, assigned S-1…S-7)
**Method:** Full read of both reports + spot-check of every referenced file:line. Findings already fixed in code are marked **ALREADY FIXED** and excluded from batches (listed in §5).

## 0. Triage Summary

| Bucket | Count | IDs |
|---|---|---|
| Critical (actionable) | 3 | C-1, C-4, C-5* |
| High (actionable) | 10 | C-2, H-1, H-2, H-3, H-9, H-10, H-11, H-13, H-14, S-4 |
| Medium (actionable) | 15 | M-1, M-2, M-3, M-6, M-7, M-8, M-9, M-10, M-11, M-12, M-13*, M-14, S-1, S-2, S-3 |
| Low (actionable) | 10 | L-2, L-3, L-4, L-5, L-7, L-8, L-9, L-10*, S-5, S-6 |
| Already fixed / false positive (no action) | 11 | C-3, H-4, H-5*, H-6*, H-7, H-8, H-12, M-4, L-1, L-6, S-7 |
| **Total documented findings** | **50** | 43 (audit) + 7 (static analysis) |

\* = needs runtime/ops verification before or during the fix (see §5).
Severity adjustments vs. the audit report: **C-2 downgraded Critical→High** (mock branch now gated behind `ERP_ALLOW_MOCK_AUTH=true` and fails closed in production — [`auth.ts:64-95`](apps/web/lib/auth.ts:64)); **S-4 added as High** (operator over-grant, static-analysis §9a).

---

## 1. Master Table of ALL Findings

Status legend: ✅ valid · ⚠️ partially mitigated · ❌ already fixed / false positive · ❓ needs verification

### Critical

| ID | Sev | File:Line | Description | Recommended Fix | Status |
|----|-----|-----------|-------------|-----------------|--------|
| C-1 | Critical | [`.env.local:2`](.env.local:2), [`.env.production.local:26`](.env.production.local:26) | Production secrets (DATABASE_URL, SUPABASE_SECRET_KEY, ERP_API_KEY) + full plaintext Vercel OIDC JWTs persisted in local env files | Rotate all secrets (treat as exposed); delete both `VERCEL_OIDC_TOKEN` lines (confirmed present, both expired); add gitleaks to CI; confirm no `.env*` is git-tracked | ✅ (OIDC JWTs confirmed in both files; other values masked in audit view — verify liveness) |
| C-4 | Critical | [`database/migrations/001_initial_erp_schema.sql:14`](database/migrations/001_initial_erp_schema.sql:14), [`027:7-32`](database/migrations/027_party_master_details_storage.sql:7) | PII (GSTIN, PAN, phone, email) stored in plaintext; no column-level encryption | pgcrypto encryption with per-org keys on PII columns + backfill migration + encrypt/decrypt in app read/write paths | ✅ |
| C-5 | Critical | [`database/migrations/001_initial_erp_schema.sql:11`](database/migrations/001_initial_erp_schema.sql:11) | No evidence of bcrypt/scrypt/argon2 for `users.password_hash` | Verify whether `users` table is used for auth at all (no app code references it — auth goes through Supabase Auth, which hashes with bcrypt internally); if legacy, drop or mark deprecated; if used, add CHECK constraint on hash format | ❓ likely false positive |

### High

| ID | Sev | File:Line | Description | Recommended Fix | Status |
|----|-----|-----------|-------------|-----------------|--------|
| C-2 | High (was Critical) | [`apps/web/lib/auth.ts:70-94`](apps/web/lib/auth.ts:70), `:104-126`, `:145-165` | Hardcoded mock admin credentials & token bypass (default dev email `admin@borgangdrugdistributors.com`, any password ≥8 chars accepted in mock mode) | Remove hardcoded default email (require explicit `ERP_MOCK_ADMIN_EMAIL`); consider deleting the mock branch entirely; keep fail-closed in production | ⚠️ gated by `ERP_ALLOW_MOCK_AUTH` + prod fail-closed |
| H-1 | High | [`apps/web/next.config.ts:9-16`](apps/web/next.config.ts:9) | No Content-Security-Policy header | Add CSP in `Content-Security-Policy-Report-Only` first, then enforce | ✅ |
| H-2 | High | [`src/pages/transactions/SaleEntry.tsx:65`](src/pages/transactions/SaleEntry.tsx:65) | Party PII persisted in `localStorage` (`pharma_erp_custom_parties`) | Persist custom parties server-side (parties resource); stop writing PII to localStorage | ✅ |
| H-3 | High | [`src/lib/erpCache.ts:10`](src/lib/erpCache.ts:10) | Entire ERP dataset cached in plaintext IndexedDB with 24 h TTL | Shorten TTL, exclude sensitive resources (parties, ledgers, vouchers) from IndexedDB, clear cache on logout | ✅ |
| H-9 | High | [`apps/web/lib/erp-store.ts:4049`](apps/web/lib/erp-store.ts:4049) (breakage), `:4266-4273` (transfer) | Stock availability check-then-write with no transaction or row lock → oversell/over-break | Single Postgres transaction + row lock on batch/warehouse, or DB `CHECK`/trigger rejecting negative stock | ✅ |
| H-10 | High | [`apps/web/lib/erp-store.ts:1434`](apps/web/lib/erp-store.ts:1434) | `db()` uses service-role key (bypasses RLS); all authorization rests on in-app `canAccess` | Per-user (anon/user-scoped) client for user-scoped reads; reserve service key for server-only jobs; add deny-by-default permission tests | ✅ |
| H-11 | High | [`apps/web/lib/erp-store.ts:4702-4763`](apps/web/lib/erp-store.ts:4702) (voucher), `:4410-4445` (fallback invoice lines swallowed as "non-fatal"), `:3988+` (party creation) | Multi-step financial writes lack transaction boundaries; crash between steps leaves orphans | Wrap each multi-step op in one Postgres transaction (or move into RPCs); never swallow line-insert errors on a posted invoice | ✅ |
| H-13 | High | [`apps/mobile/package-lock.json:3817`](apps/mobile/package-lock.json:3817) | `brace-expansion@5.0.9` stack-exhaustion DoS (transitive) | `overrides` to `>=5.0.12` in `apps/mobile/package.json` | ✅ |
| H-14 | High | [`apps/mobile/package-lock.json:5418`](apps/mobile/package-lock.json:5418) | `js-yaml@4.3.1` CPU DoS via merge keys (transitive) | `overrides` to `>=4.3.2` in `apps/mobile/package.json` | ✅ |
| S-4 | High | [`apps/web/lib/permissions.ts:34-37`](apps/web/lib/permissions.ts:34) | `operator` role granted `masters.write`, `transactions.write`, `accounting.write` — broad grant for least-privileged role | Remove `accounting.write` from operator; re-review full grant list; add deny-by-default tests | ✅ |

### Medium

| ID | Sev | File:Line | Description | Recommended Fix | Status |
|----|-----|-----------|-------------|-----------------|--------|
| M-1 | Medium | [`src/pages/masters/PartyList.tsx:642`](src/pages/masters/PartyList.tsx:642) | Party CSV export built without formula-injection sanitization (`=`, `+`, `-`, `@` cells) | Reuse `sanitizeCsvValue` from [`src/lib/download.ts:16`](src/lib/download.ts:16) (already fixed there) | ⚠️ download.ts fixed; PartyList.tsx not |
| M-2 | Medium | [`src/pages/auth/LoginPage.tsx:19-26`](src/pages/auth/LoginPage.tsx:19) | Auth tokens passed via URL fragment (invite/recovery) | One-time code exchange: fragment carries opaque code, server exchanges for session | ✅ |
| M-3 | Medium | [`src/pages/transactions/CounterSale.tsx:999`](src/pages/transactions/CounterSale.tsx:999) | Third-party `api.qrserver.com` receives UPI transaction data (amount, payee) in query string | Generate UPI QR locally (client-side QR lib) | ✅ |
| M-6 | Medium | [`apps/web/lib/auth.ts`](apps/web/lib/auth.ts) | No MFA/2FA support | Implement TOTP (or WebAuthn) via Supabase Auth factors | ✅ |
| M-7 | Medium | [`apps/web/lib/auth.ts:191`](apps/web/lib/auth.ts:191) | Session timeout hardcoded (30-day refresh cookie), not configurable | Make maxAge configurable via env | ✅ |
| M-8 | Medium | [`apps/web/lib/permissions.ts:29-37`](apps/web/lib/permissions.ts:29) | Hardcoded permission sets; `role_permissions` table exists ([`006:50`](database/migrations/006_erp_hardening.sql:50)) but is unused | Load permissions from `role_permissions` with hardcoded fallback | ✅ |
| M-9 | Medium | [`database/migrations/006_erp_hardening.sql:31`](database/migrations/006_erp_hardening.sql:31) | `audit_logs.request_id` nullable, no default | New migration: `SET NOT NULL` + default (backfill first) | ✅ |
| M-10 | Medium | [`database/migrations/001_initial_erp_schema.sql:34`](database/migrations/001_initial_erp_schema.sql:34) | No `audit_logs` partitioning (unbounded table) | Time-based (monthly) partitioning + retention policy | ✅ |
| M-11 | Medium | [`apps/web/lib/api-handler.ts:107`](apps/web/lib/api-handler.ts:107), [`erp-store.ts`](apps/web/lib/erp-store.ts) | No range/bound validation on financial values; no `Array.isArray` guard on `body.lines`; no date-format validation | Small validation helper (finite number, ≥0, max bound, ISO-date, array guard) applied at top of each create/update handler | ✅ |
| M-12 | Medium | [`apps/web/lib/erp-store.ts`](apps/web/lib/erp-store.ts) (sales/purchases create) | No idempotency key on invoice posting; retried POST can double-post | Accept client idempotency key; `erp_post_invoice` already atomic + `UNIQUE(organization_id, financial_year_id, invoice_number)` guards same-number retries — add explicit key column for cross-number dedupe | ⚠️ partially mitigated by unique constraint |
| M-13 | Medium | [`apps/mobile/package.json`](apps/mobile/package.json) | 13 moderate mobile dependency vulnerabilities | Run `npm audit` in `apps/mobile`; track Expo SDK 55.x patches | ❓ verify with npm audit |
| M-14 | Medium | [`vitest.config.ts:3`](vitest.config.ts:3) | No coverage report available | Add `@vitest/coverage-v8` + coverage thresholds | ✅ |
| S-1 | Medium | [`apps/web/lib/erp-store.ts:1535`](apps/web/lib/erp-store.ts:1535) (`party`), `:1543` (`account`), `:1733` (`stock`) | Item/batch/account get-or-create select-then-insert race; loser gets unhandled constraint error | Use `.upsert(..., { onConflict })` instead of select-then-insert | ✅ |
| S-2 | Medium | [`apps/web/lib/erp-store.ts:4729`](apps/web/lib/erp-store.ts:4729) | Voucher-number retry suffix built from `Date.now()` + `Math.random()` | Drive voucher numbers from the atomic `document_series` increment (already fixed in H-7) and drop the random suffix | ✅ |
| S-3 | Medium | [`apps/web/lib/erp-store.ts:3442-3456`](apps/web/lib/erp-store.ts:3442) (mock) vs `:3983` (DB `erp_cancel_invoice`) | Mock cancellation only flips `status`; DB path reverses stock/vouchers — behavior diverges between mock and live | Make mock path mirror DB path or remove mock branch in production builds | ✅ |

### Low

| ID | Sev | File:Line | Description | Recommended Fix | Status |
|----|-----|-----------|-------------|-----------------|--------|
| L-2 | Low | [`src/pages/transactions/SaleEntry.tsx:839-841`](src/pages/transactions/SaleEntry.tsx:839), [`PurchaseEntry.tsx:716-718`](src/pages/transactions/PurchaseEntry.tsx:716) | React Router `Link target="_blank"` without `rel` | Add `rel="noopener noreferrer"` | ✅ |
| L-3 | Low | [`src/app/api/auth/login/route.page.ts:14-18`](src/app/api/auth/login/route.page.ts:14) | Login rate limiter keyed on client-spoofable `x-forwarded-for`/`x-real-ip` (also per-instance in-memory state) | Trust only proxy-set headers; consider shared (Upstash) state | ✅ |
| L-4 | Low | [`src/lib/erpApi.ts:25`](src/lib/erpApi.ts:25) | SSR API fallback uses plaintext `http://127.0.0.1:3000` | Prefer https / configurable base URL | ✅ |
| L-5 | Low | [`src/lib/erpApi.ts:51-65`](src/lib/erpApi.ts:51) | BroadcastChannel cache-invalidation DoS (unbounded invalidation fan-out) | Bounded impact; add rate cap / monitor | ✅ |
| L-7 | Low | [`apps/web/lib/erp-store.ts:327`](apps/web/lib/erp-store.ts:327), [`api-handler.ts:33`](apps/web/lib/api-handler.ts:33), multiple | `console.warn/error` of error objects in production | Gate behind debug flag / structured logger | ✅ |
| L-8 | Low | [`vitest.config.ts:3`](vitest.config.ts:3) | Windows drive-letter case mismatch breaks tests from lowercase paths | Document uppercase-path requirement (or normalize in config) | ✅ |
| L-9 | Low | [`tests/`](tests/) | No component-rendering tests; `src/pages/**` essentially untested | Add Testing Library tests for critical pages | ✅ |
| L-10 | Low | [`package.json`](package.json) (root) | 24 packages behind latest (no CVEs) | Bump opportunistically | ❓ verify with npm outdated |
| S-5 | Low | [`scripts/import_stock.py:70`](scripts/import_stock.py:70) | Ops script reads `.env.production.local` and calls Supabase REST with the service-role key | Least-privilege scoped key or short-lived token for scripts | ✅ |
| S-6 | Low | [`scripts/generate_hsn_sql.js:17`](scripts/generate_hsn_sql.js:17), [`generate_items_sql.js:20`](scripts/generate_items_sql.js:20), [`generate_catalog_manufacturers.mjs:51`](scripts/generate_catalog_manufacturers.mjs:51) | SQL seed generators interpolate values with only single-quote escaping | Proper `pg`-style quoting / parameterized seeding if ever pointed at a live DB | ✅ |

### Already Fixed / False Positive (no action — see §5 for details)

| ID | Sev (reported) | File:Line | Why no action |
|----|----------------|-----------|---------------|
| C-3 | Critical | [`apps/web/package.json:12`](apps/web/package.json:12) | `next` already `^16.3.7`; lockfile confirms installed `16.3.7` |
| H-4 | High | [`apps/web/middleware.ts:19-54`](apps/web/middleware.ts:19) | Upstash rate limiters already implemented (auth 10/15m, mutations 120/m, global 600/m), explicitly labeled "H-4" |
| H-5 | High | [`database/migrations/034_fix_rls_policy_regressions.sql:28-42`](database/migrations/034_fix_rls_policy_regressions.sql:28) | `account_groups` `auth.uid()` policy dropped, `server_only` created; `party_details` already `server_only` in [`027:40-45`](database/migrations/027_party_master_details_storage.sql:40) |
| H-6 | High | [`database/migrations/034_fix_rls_policy_regressions.sql:51-52`](database/migrations/034_fix_rls_policy_regressions.sql:51) | `REVOKE USAGE ON SCHEMA public FROM anon, authenticated` added in 034 |
| H-7 | High | [`apps/web/lib/erp-store.ts:343-364`](apps/web/lib/erp-store.ts:343) | `getNextSeriesNumberDb` now uses atomic `UPDATE ... next_number + 1 ... RETURNING` |
| H-8 | High | [`apps/web/lib/erp-store.ts:23`](apps/web/lib/erp-store.ts:23) | `number()` now uses `crypto.randomUUID()` slice, not `Date.now()` tail |
| H-12 | High | [`apps/web/package-lock.json:909`](apps/web/package-lock.json:909) | `sharp` already at `0.35.5` (≥ 0.35.4) |
| M-4 | Medium | [`apps/web/lib/api-handler.ts:48-57`](apps/web/lib/api-handler.ts:48) | `x-forwarded-host` explicitly excluded from origin check with comment |
| L-1 | Low | [`src/lib/windowUtils.ts:72-77`](src/lib/windowUtils.ts:72) | `noopener,noreferrer` always appended ("L-1 fix") |
| L-6 | Low | [`src/components/common/ErrorBoundary.tsx:57-59`](src/components/common/ErrorBoundary.tsx:57) | Generic user-facing message; no raw `error.message` |
| S-7 | Low | [`src/lib/invoiceCalculations.ts:2`](src/lib/invoiceCalculations.ts:2), [`financialData.ts:113`](src/lib/financialData.ts:113) | False positive: no realistic IEEE-754 overflow below 2^53; real risk (absurd inputs) covered by M-11 |

---

## 2. Batch 1 — Critical + High (13 findings)

**Findings:** C-1, C-4, C-5, C-2, H-1, H-2, H-3, H-9, H-10, H-11, H-13, H-14, S-4
**Held pending verification:** H-5, H-6 (fixed in code by migration 034 — confirm 034 is applied to the live DB before H-10 work; if not applied, they re-enter this batch as a DB task)

### Files to touch

| File | Findings | Change |
|------|----------|--------|
| `.env.local`, `.env.production.local` | C-1 | Delete `VERCEL_OIDC_TOKEN` lines; replace secrets with rotated values (rotation itself is out-of-band ops) |
| `.github/` (CI workflow) | C-1 | Add gitleaks secret scan + `.env*` guard; add `git ls-files` check |
| `apps/web/lib/auth.ts` | C-2, (M-7 is Batch 2) | Remove hardcoded default dev email; require explicit `ERP_MOCK_ADMIN_EMAIL`; keep prod fail-closed |
| `database/migrations/035_pii_encryption.sql` (new) | C-4 | pgcrypto per-org key; encrypt PII columns (`parties.gstin/phone/email`, `party_details.pan/mobile/phone_*`, `organizations.gstin`); backfill |
| `apps/web/lib/erp-store.ts` (party read/write paths) | C-4 | Encrypt on write, decrypt on read for PII fields |
| `database/migrations/035` or `036` (new) | C-5 | Only if `users` table is confirmed in use: CHECK constraint on `password_hash` format; otherwise document as legacy |
| `apps/web/next.config.ts` | H-1 | Add `Content-Security-Policy-Report-Only` header |
| `src/pages/transactions/SaleEntry.tsx` | H-2 | Stop reading/writing `pharma_erp_custom_parties` in localStorage; use server parties |
| `src/lib/erpCache.ts`, `src/lib/erpApi.ts` | H-3 | Shorten TTL; exclude sensitive resources from IndexedDB; clear cache on logout |
| `apps/web/lib/erp-store.ts` (breakage `:4044-4053`, transfer `:4256-4275`, voucher `:4694-4765`, fallback invoice `:4410-4445`, party creation `:3988+`) | H-9, H-11 | Wrap multi-step writes in single Postgres transactions; row-lock batch/warehouse for availability checks; stop swallowing line errors |
| `database/migrations/036_stock_integrity.sql` (new) | H-9 | `CHECK`/trigger preventing negative computed stock (defense in depth) |
| `apps/web/lib/erp-store.ts` (`db()` `:1434`) + new per-user client | H-10 | User-scoped client for reads; service key only for server-only jobs; deny-by-default tests |
| `apps/web/lib/permissions.ts` | S-4 | Remove `accounting.write` from operator set |
| `apps/mobile/package.json` + lockfile | H-13, H-14 | `overrides`: `brace-expansion >=5.0.12`, `js-yaml >=4.3.2`; reinstall |

### Ordering constraints (within batch)

1. **C-1 first** — rotate secrets before any other work; the new migrations (C-4, H-9) will run with the new service-role key.
2. **Verify H-5/H-6 (migration 034 applied to live DB)** before starting H-10 — per-user RLS is only meaningful if the schema-level revokes are live.
3. **H-9 DB constraint (036) before or alongside H-9/H-11 app transaction wrapping** — the constraint is the safety net if a transaction is missed.
4. **C-4 last in the batch** — it changes data format and every PII read/write path; do it after the transaction work so PII backfill runs on stable code.
5. S-4 is independent; pair it with the deny-by-default permission tests from H-10.

### Risk notes

- **C-4 (highest risk in batch):** changes DB schema + API-visible data (party PII fields). Requires backfill of existing rows, key management, and coordinated app changes — a half-migration leaves PII unreadable. Mitigate: encrypt into new columns first, dual-read, then cutover.
- **H-10:** changes the auth model for all API routes. A wrong RLS policy silently breaks reads or (worse) over-grants. Mitigate: deny-by-default tests + staged rollout (reads first).
- **H-9/H-11:** changes financial/inventory write behavior. Risk of breaking posting under load. Mitigate: regression tests for breakage/transfer/voucher/fallback paths; keep compensating deletes until transactions are proven.
- **H-2/H-3:** client cache behavior changes — risk of UX regression (offline mode, multi-tab sync). Mitigate: keep in-memory cache, only restrict IndexedDB persistence.
- **H-13/H-14:** mobile `overrides` — low risk, but verify Expo SDK 55 compatibility after reinstall.
- **H-1:** CSP report-only is safe; enforcement (later) can break inline scripts — keep report-only in this batch.

---

## 3. Batch 2 — Medium (15 findings)

**Findings:** M-1, M-2, M-3, M-6, M-7, M-8, M-9, M-10, M-11, M-12, M-13, M-14, S-1, S-2, S-3

### Files to touch

| File | Findings | Change |
|------|----------|--------|
| `src/pages/masters/PartyList.tsx` | M-1 | Route CSV cells through `sanitizeCsvValue` (export it from `src/lib/download.ts`) |
| `src/pages/auth/LoginPage.tsx` + `apps/web/app/api/auth/*` | M-2 | One-time code exchange for invite/recovery tokens |
| `src/pages/transactions/CounterSale.tsx` | M-3 | Replace `api.qrserver.com` with local QR generation (e.g. `qrcode` npm package, client-side) |
| `apps/web/lib/auth.ts` | M-6, M-7 | TOTP/WebAuthn support; session maxAge from env |
| `apps/web/lib/permissions.ts` + new migration | M-8 | Load from `role_permissions` table (created in 006:50), seed defaults, keep hardcoded fallback |
| `database/migrations/037_audit_hardening.sql` (new) | M-9, M-10 | `request_id` NOT NULL + default (backfill first); monthly partitioning of `audit_logs` + retention |
| `apps/web/lib/api-handler.ts`, `apps/web/lib/erp-store.ts` | M-11 | Validation helper (finite/bounded numbers, ISO dates, `Array.isArray` on lines) at handler entry |
| `apps/web/lib/erp-store.ts` + `database/migrations/006` RPC | M-12 | Idempotency key column on invoices; RPC upsert on natural key |
| `apps/mobile/package.json` + lockfile | M-13 | `npm audit` triage; patch or override moderate vulns |
| `vitest.config.ts` | M-14 | Add `@vitest/coverage-v8` + thresholds |
| `apps/web/lib/erp-store.ts` (`party` `:1535`, `account` `:1543`, `stock` `:1733`) | S-1 | Replace select-then-insert with `.upsert(..., { onConflict })` |
| `apps/web/lib/erp-store.ts` (voucher `:4694-4735`) | S-2 | Voucher numbers from atomic `document_series` increment; drop `Date.now()`+`Math.random` suffix |
| `apps/web/lib/erp-store.ts` (mock cancellations `:3442-3456`) | S-3 | Mirror DB cancellation semantics (reverse stock/voucher) or remove mock branch in prod builds |

### Ordering constraints (within batch)

1. **M-11 before M-12** — validation at handler entry should land first so idempotency keys are validated like any other input.
2. **M-8 before S-4 follow-ups** — DB-driven permissions make the operator grant review (Batch 1 S-4) durable; seed `role_permissions` with the corrected operator set.
3. **S-2 depends on H-7's atomic series increment** (already fixed) — no new dependency, but test voucher numbering end-to-end.
4. **M-9 before M-10** — `request_id` NOT NULL must be backfilled before partitioning rewrites the table.
5. M-6 (MFA) is the largest feature in this batch; it touches `auth.ts` which M-7 also touches — do M-7 first (small), then M-6.

### Risk notes

- **M-2 changes the invite/recovery API contract** (fragment now carries a code, not tokens) — coordinate frontend + API route in one change; old links break (acceptable: they're short-lived).
- **M-8 changes authz behavior at runtime** — a bad seed can lock out operators; keep the hardcoded fallback until the DB path is proven.
- **M-10 (partitioning)** is a schema rewrite of `audit_logs` — run in a maintenance window; verify the `idx_audit_entity` index carries over.
- **M-12** changes the `erp_post_invoice` RPC signature/behavior — all callers (including `erp_import_invoices` and amendment RPCs in 020/029) must be updated together.
- **M-3** changes print/PDF-adjacent output (QR image source) — verify QR still scans with UPI apps after switching to local generation.
- **S-3** changes mock-mode behavior — dev-only impact, but keep mock and live semantics aligned to avoid testing blind spots.

---

## 4. Batch 3 — Low / Hardening (10 findings)

**Findings:** L-2, L-3, L-4, L-5, L-7, L-8, L-9, L-10, S-5, S-6

### Files to touch

| File | Findings | Change |
|------|----------|--------|
| `src/pages/transactions/SaleEntry.tsx`, `src/pages/transactions/PurchaseEntry.tsx` | L-2 | Add `rel="noopener noreferrer"` to `target="_blank"` Links |
| `src/app/api/auth/login/route.page.ts`, `apps/web/middleware.ts` | L-3 | Trust only proxy-set headers for client IP (or shared Upstash state for the login limiter) |
| `src/lib/erpApi.ts` | L-4, L-5 | https-preferred SSR base URL; cap/monitor BroadcastChannel invalidation fan-out |
| `apps/web/lib/erp-store.ts`, `apps/web/lib/api-handler.ts`, others | L-7 | Gate `console.warn/error` behind a debug flag / structured logger |
| `vitest.config.ts` + docs | L-8 | Document uppercase Windows path requirement (or normalize paths in config) |
| `tests/` | L-9 | Add Testing Library component tests for critical pages (SaleEntry, PurchaseEntry, PartyList, Login) |
| Root `package.json` + lockfile | L-10 | Opportunistic non-CVE package bumps (after `npm outdated` verification) |
| `scripts/import_stock.py` | S-5 | Use least-privilege scoped key / short-lived token instead of the service-role key from `.env.production.local` |
| `scripts/generate_hsn_sql.js`, `scripts/generate_items_sql.js`, `scripts/generate_catalog_manufacturers.mjs` | S-6 | Proper SQL quoting (escape backslashes / use `E''` or parameterized seeding) |

### Ordering constraints (within batch)

- No hard dependencies. L-3 should reuse the same trusted-IP logic as `middleware.ts` (single helper). L-10 should run last (after all other dependency work settles the lockfiles).

### Risk notes

- **L-3:** tightening IP trust can break rate limiting behind misconfigured proxies — test with the actual Vercel/proxy header set first.
- **L-9:** new component tests may surface existing UI bugs; treat failures as findings, not blockers.
- **S-5/S-6:** dev/ops tooling only — no runtime impact, but S-6 matters if scripts are ever pointed at a live DB.

---

## 5. Verify Before Fixing

Findings that look like false positives, are already mitigated elsewhere, or need runtime verification before a code change:

1. **C-3 (next RCE) — ALREADY FIXED.** [`apps/web/package.json:12`](apps/web/package.json:12) is `^16.3.7` and [`apps/web/package-lock.json:783`](apps/web/package-lock.json:783) confirms installed `16.3.7`. No action.
2. **H-4 (rate limiting) — ALREADY FIXED.** [`apps/web/middleware.ts`](apps/web/middleware.ts) implements three Upstash limiters, explicitly labeled "H-4". **Verify:** `UPSTASH_REDIS_REST_URL`/`TOKEN` are set in production — otherwise the middleware is a no-op (lines 23-26).
3. **H-7 (doc-number race) — ALREADY FIXED.** [`getNextSeriesNumberDb`](apps/web/lib/erp-store.ts:343) now does an atomic `UPDATE ... next_number + 1 ... RETURNING` (lines 345-354).
4. **H-8 (Date.now() doc numbers) — ALREADY FIXED.** [`number()`](apps/web/lib/erp-store.ts:23) now uses a `crypto.randomUUID()` slice.
5. **H-12 (sharp) — ALREADY FIXED.** Lockfile shows `sharp@0.35.5` (≥ 0.35.4).
6. **M-4 (x-forwarded-host bypass) — ALREADY FIXED.** [`mutationOriginAllowed`](apps/web/lib/api-handler.ts:48) explicitly excludes `x-forwarded-host` with a comment.
7. **L-1 (window.open) — ALREADY FIXED.** [`openTransactionWindow`](src/lib/windowUtils.ts:72) always appends `noopener,noreferrer`.
8. **L-6 (raw error.message) — ALREADY FIXED.** [`ErrorBoundary`](src/components/common/ErrorBoundary.tsx:57) shows a generic message.
9. **H-5 / H-6 (RLS regressions) — FIXED IN CODE, VERIFY LIVE DB.** [`migration 034`](database/migrations/034_fix_rls_policy_regressions.sql) drops the `account_groups` `auth.uid()` policy and revokes schema USAGE. **Verify:** run 034's verification query (`information_schema.role_table_grants` for anon/authenticated → expect 0 rows) against the live Supabase DB. If 034 was never applied, these re-enter Batch 1 as a DB task.
10. **C-5 (password hashing) — LIKELY FALSE POSITIVE.** No app code references the `users` table or `password_hash` (searched `apps/web`); authentication goes through Supabase Auth (`signInWithPassword`), which hashes passwords with bcrypt server-side. **Verify:** confirm the `users` table is unused/legacy; if so, close C-5 (optionally drop the table or mark it deprecated). Only add the CHECK constraint if the table is actually in use.
11. **M-5 (hardcoded fallback PII in print data) — LIKELY MISCHARACTERIZED.** [`PurchaseEntry.tsx:572-589`](src/pages/transactions/PurchaseEntry.tsx:572) is a hardcoded **demo item** ("CUTIROSE 50ML", batch "CT251459") used when no lines exist — not PII. The real (lower-severity) issue: demo data could leak into a printed document if a user submits with empty lines. **Recommendation:** re-scope to Low — replace the fallback with a neutral placeholder or block submission when lines are empty.
12. **M-13 (13 moderate mobile vulns) — VERIFY WITH `npm audit`.** The lockfile confirms the transitive deps exist, but the exact moderate list should be re-verified in `apps/mobile` before choosing overrides.
13. **L-10 (24 packages behind latest) — VERIFY WITH `npm outdated`.** No CVEs claimed; confirm before bumping.
14. **C-1 (secret liveness) — PARTIALLY VERIFIED.** The `VERCEL_OIDC_TOKEN` lines are confirmed present in both env files (both JWTs expired). The other values (DATABASE_URL, SUPABASE_SECRET_KEY, ERP_API_KEY) are masked in the audit view — **verify** they are live production values, then rotate regardless.
15. **M-12 (idempotency) — PARTIALLY MITIGATED.** `erp_post_invoice` ([`006:249`](database/migrations/006_erp_hardening.sql:249)) is a single atomic RPC and `sales_invoices`/`purchase_invoices` have `UNIQUE(organization_id, financial_year_id, invoice_number)`, so same-number retries are rejected. Residual risk: a retried POST with a *new* number double-posts. Fix scope is therefore an explicit idempotency key, not a rewrite.

---

## 6. Batch Quick Reference

| Batch | Findings (IDs) | Count |
|-------|----------------|-------|
| **1 — Critical + High** | C-1, C-4, C-5, C-2, H-1, H-2, H-3, H-9, H-10, H-11, H-13, H-14, S-4 (+ H-5, H-6 held pending live-DB verification) | 13 (+2 held) |
| **2 — Medium** | M-1, M-2, M-3, M-6, M-7, M-8, M-9, M-10, M-11, M-12, M-13, M-14, S-1, S-2, S-3 | 15 |
| **3 — Low / Hardening** | L-2, L-3, L-4, L-5, L-7, L-8, L-9, L-10, S-5, S-6 | 10 |
| No action (already fixed / FP) | C-3, H-4, H-7, H-8, H-12, M-4, L-1, L-6, S-7 | 9 |
