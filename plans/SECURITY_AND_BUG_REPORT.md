# ERP Security & Bug Audit Report
**Date:** 2026-09-30
**Project:** Pharma ERP (Borgang Pharma)
**Scope:** Full-stack security audit + bug test

## 1. Executive Summary

**Overall Security Posture: C+ (Medium-High Risk)**

The ERP system has a strong architectural foundation (Supabase RLS, server-only access model, HttpOnly cookies, RBAC) but is undermined by several critical operational gaps:

| # | Critical Finding | Location | Impact |
|---|-----------------|----------|--------|
| 1 | Hardcoded production secrets in .env files | .env.local, .env.production.local | Full DB access if leaked |
| 2 | Hardcoded mock admin credentials | apps/web/lib/auth.ts:70 | Full admin access in non-prod |
| 3 | next@16.3.2 has 2 critical RCE vulnerabilities | apps/web/package.json | Unauthenticated RCE |
| 4 | No column-level encryption for PII | database/migrations/001 | GDPR/HIPAA non-compliance |
| 5 | Race conditions in document numbering & stock | apps/web/lib/erp-store.ts:343,23 | Duplicate invoices, overselling |

**Test Results:** 148/149 unit tests passed, 6/6 E2E tests passed. 0 failures. 1 deterministic environment bug (Windows drive-letter case).

## 2. Risk Matrix

### CRITICAL (Fix Immediately)

| ID | Finding | Location | Remediation |
|----|---------|----------|-------------|
| C-1 | Hardcoded production secrets (DATABASE_URL, SUPABASE_SECRET_KEY, ERP_API_KEY, Vercel OIDC JWT) | .env.local:2, .env.production.local:26 | Rotate all secrets, delete persisted tokens, add gitleaks to CI |
| C-2 | Hardcoded mock admin credentials & token bypass | apps/web/lib/auth.ts:70,137,96-114 | Remove mock branches, fail closed when Supabase unconfigured |
| C-3 | next@16.3.2: 2 critical RCE advisories | apps/web/package.json | Upgrade to next@^16.3.7 |
| C-4 | No column-level encryption for PII (GSTIN, PAN, phone, email) | database/migrations/001, 027 | Implement pgcrypto encryption with per-org keys |
| C-5 | No evidence of bcrypt/scrypt/argon2 for password_hash | database/migrations/001:11 | Verify app uses bcrypt cost>=12, add CHECK constraint |

### HIGH (Fix This Sprint)

| ID | Finding | Location | Remediation |
|----|---------|----------|-------------|
| H-1 | No Content-Security-Policy header | next.config.ts:6 | Add CSP in report-only mode first |
| H-2 | Party PII in localStorage | src/pages/transactions/SaleEntry.tsx:64 | Persist custom parties server-side |
| H-3 | Entire ERP dataset in plaintext IndexedDB | src/lib/erpCache.ts:7 | Shorten TTL, exclude sensitive resources, clear on logout |
| H-4 | No global rate limiting on API routes | apps/web/lib/api-handler.ts | Add middleware rate limiter |
| H-5 | party_details & account_groups policies use auth.uid() | database/migrations/027:26, 018:22 | Change to server_only for service_role |
| H-6 | No REVOKE USAGE ON SCHEMA public | database/migrations/026 | Add schema-level revoke |
| H-7 | Race condition: document series read-then-increment | apps/web/lib/erp-store.ts:343 | Atomic UPDATE |
| H-8 | Race condition: Date.now() tail for doc numbers | apps/web/lib/erp-store.ts:23 | Use DB sequence or atomic counter |
| H-9 | Stock availability check-then-write without transaction | apps/web/lib/erp-store.ts:4032,4250 | Single Postgres transaction + row lock |
| H-10 | service-role key bypasses RLS | apps/web/lib/erp-store.ts:1424 | Enforce RLS for user-scoped access |
| H-11 | Multi-step financial writes lack transaction boundaries | apps/web/lib/erp-store.ts:4734,4427,3977 | Wrap in Postgres transactions |
| H-12 | sharp@0.35.3: libheif heap buffer overflow | apps/web (transitive) | Upgrade to sharp@>=0.35.4 |
| H-13 | brace-expansion@5.0.9: stack-exhaustion DoS | apps/mobile (transitive) | Override to >=5.0.12 |
| H-14 | js-yaml@4.3.1: CPU DoS via merge keys | apps/mobile (transitive) | Override to >=4.3.2 |

### MEDIUM (Next Sprint)

| ID | Finding | Location | Remediation |
|----|---------|----------|-------------|
| M-1 | CSV formula injection | src/lib/download.ts:14, PartyList.tsx:642 | Prefix dangerous cells with ' |
| M-2 | Auth tokens in URL fragment | src/pages/auth/LoginPage.tsx:19 | One-time code exchange |
| M-3 | Third-party QR service receives transaction data | src/pages/transactions/CounterSale.tsx:999 | Generate QR locally |
| M-4 | Origin check bypass via x-forwarded-host | apps/web/lib/api-handler.ts:49 | Strip header at proxy |
| M-5 | Hardcoded fallback PII in print data | src/pages/transactions/PurchaseEntry.tsx:572 | Replace with neutral placeholders |
| M-6 | No MFA/2FA support | apps/web/lib/auth.ts | Implement TOTP/WebAuthn |
| M-7 | Session timeout not configurable | apps/web/lib/auth.ts:174-175 | Make configurable via env |
| M-8 | Hardcoded permission sets | apps/web/lib/permissions.ts | Move to DB role_permissions table |
| M-9 | audit_logs.request_id is nullable | database/migrations/006:31 | Add NOT NULL + default |
| M-10 | No audit_logs partitioning | database/migrations/001:34 | Implement time-based partitioning |
| M-11 | Missing input validation | apps/web/lib/api-handler.ts | Add bounded validation |
| M-12 | No idempotency key on invoice posting | apps/web/lib/erp-store.ts | Add natural-key upsert |
| M-13 | 13 moderate mobile dependency vulnerabilities | apps/mobile | Track Expo SDK 55.x patches |
| M-14 | No coverage report available | vitest.config.ts | Add @vitest/coverage-v8 |

### LOW (Backlog)

| ID | Finding | Location | Remediation |
|----|---------|----------|-------------|
| L-1 | window.open without noopener | src/lib/windowUtils.ts:72 | Add noopener |
| L-2 | React Router Link target=_blank without rel | SaleEntry.tsx:839, PurchaseEntry.tsx:716 | Add rel="noopener noreferrer" |
| L-3 | Login rate limiter keyed on spoofable IP | src/app/api/auth/login/route.page.ts:14 | Trust only proxy-set headers |
| L-4 | SSR API fallback uses plaintext http:// | src/lib/erpApi.ts:25 | Prefer https |
| L-5 | BroadcastChannel cache invalidation DoS | src/lib/erpApi.ts:51 | Bounded impact, monitor |
| L-6 | Raw error.message shown to users | src/components/common/ErrorBoundary.tsx:59 | Generic message + request ID |
| L-7 | console.warn/error of error objects | Multiple files | Gate behind debug flag |
| L-8 | Windows drive-letter case bug breaks tests | vitest.config.ts | Document uppercase path requirement |
| L-9 | No component-rendering tests | tests/ | Add Testing Library tests |
| L-10 | 24 packages behind latest (no CVEs) | Root package.json | Bump opportunistically |

## 3. Test Results

### Vitest (Unit/Integration)
- **Files:** 28 passed, 1 skipped (29 total)
- **Tests:** 148 passed, 1 skipped (149 total)
- **Failures:** 0
- **Duration:** 5.10s
- **Skipped:** tests/saleAnalysis.live.test.ts (opt-in live test)

### Playwright E2E
- **Tests:** 6 passed, 0 failed
- **Duration:** 27.5s
- **Projects:** chromium + mobile/Pixel 7

### Coverage Gaps
- No coverage provider configured
- No component-rendering tests
- src/pages/** UI essentially untested
- apps/mobile entirely untested

### Environment Bug
- **Windows drive-letter case mismatch** causes 100% test failure from lowercase paths
- **Workaround:** `cd /d C:\Users\SCL\Downloads\ERP && npx vitest run`

## 4. Dependency Audit

| Workspace | Vulns | Critical | High | Moderate | Low |
|-----------|-------|----------|------|----------|-----|
| Root | 0 | 0 | 0 | 0 | 0 |
| apps/web | 2 | 1 | 1 | 0 | 0 |
| apps/mobile | 15 | 0 | 2 | 13 | 0 |

**Urgent Fix:** `cd apps/web && npm install next@^16.3.7`

## 5. Remediation Roadmap

### Immediate (Critical - Fix Now)
1. Rotate & purge secrets in .env files (C-1)
2. Remove mock auth branches in auth.ts (C-2)
3. Upgrade next to ^16.3.7 in apps/web (C-3)
4. Implement PII column encryption (C-4)
5. Verify password hashing algorithm (C-5)

### This Sprint (High)
6. Add CSP header (H-1)
7. Eliminate localStorage PII (H-2)
8. Tighten IndexedDB cache (H-3)
9. Add global rate limiting (H-4)
10. Fix RLS policy regressions (H-5, H-6)
11. Fix race conditions in doc numbering & stock (H-7, H-8, H-9)
12. Enforce RLS for user-scoped access (H-10)
13. Add transaction boundaries (H-11)
14. Fix mobile dependency overrides (H-13, H-14)

### Next Sprint (Medium)
15. Neutralize CSV formula injection (M-1)
16. Replace third-party QR API (M-3)
17. Strip x-forwarded-host at proxy (M-4)
18. Implement MFA (M-6)
19. Add input validation (M-11)
20. Add idempotency keys (M-12)
21. Add coverage provider (M-14)

### Backlog (Low)
22. Add noopener to window.open (L-1)
23. Add component tests (L-9)
24. Fix Windows path case bug (L-8)
25. Bump outdated packages (L-10)

## 6. Compliance Notes

| Standard | Status | Gaps |
|----------|--------|------|
| GDPR | Partial | No encryption at rest for PII; no right-to-erasure automation |
| PCI DSS | Non-compliant | No encryption for PAN; no tokenization |
| HIPAA | Partial | Audit logs good; no encryption for health data |
| SOX | Strong | Immutable audit trail, period controls, voucher balance enforcement |

## 7. Long-Term Recommendations

1. **Security Architecture:** Move from service-role-only to hybrid RLS + app-level auth
2. **Testing:** Add component tests, integration tests for API routes, load testing
3. **Monitoring:** Add structured logging, request tracing, anomaly detection
4. **CI/CD:** Add gitleaks, dependency scanning, security headers testing
5. **Data Protection:** Implement data classification, encryption at rest, data masking
6. **Access Control:** Implement MFA, session management, privilege escalation detection
7. **Incident Response:** Add audit log retention, alerting on suspicious activity

---
*Report generated by automated security audit. All findings should be verified before remediation.*
