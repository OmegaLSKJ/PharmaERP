# PharmaERP production operations

## Ownership and service levels

- Production owner: the designated ERP administrator; database owner: the Supabase project owner.
- Target recovery point (RPO): 24 hours on daily backups; reduce to the enabled PITR interval for organizations that enable Supabase Point-in-Time Recovery.
- Target recovery time (RTO): 4 hours for application rollback, database restore, validation, and DNS/alias recovery.
- Never restore directly over production as the first step. Restore into an isolated project, validate counts and balances, then schedule cutover.

## Release checklist

1. Run `npm ci`, `npm run verify`, and `npm run test:e2e`.
2. Apply forward-only migrations in numeric order. Never edit a migration already applied to production.
3. Run Supabase security and performance advisors after every schema change.
4. Run the rollback-based database assertions for invoice balance, negative stock, atomic imports, and closed periods.
5. Deploy through Vercel, verify `/api/health`, login, dashboard, one read-only report, and server logs.
6. Keep the previous Vercel deployment available for immediate application rollback. A code rollback does not reverse a database migration.

## Backups and restore drill

- Confirm the Supabase backup/PITR status monthly and before a high-risk migration.
- Quarterly, restore the latest backup to an isolated Supabase project.
- Validate organization, party, item, batch, invoice, stock movement, voucher, voucher-line, audit-log, licence and recall counts.
- Assert every posted voucher balances, no stock position is negative, and invoice totals equal line taxable value + tax + rounding.
- Record drill date, backup timestamp, restore duration, validator, discrepancies and corrective actions in the regulatory operations log.

## Monitoring and incident response

- Every API response has `X-Request-Id`; mutation/failure logs are structured JSON. Search Vercel logs by request ID and correlate with `audit_logs.request_id`.
- Alert on HTTP 5xx rate, authentication failures, slow API latency, database connection saturation, negative-stock rejection spikes, expired drug licences, open Class I recalls and failed imports.
- For an incident: freeze affected role/action, capture request IDs, preserve logs, identify the last known-good transaction, and use compensating transactions. Do not delete posted accounting or stock records.
- Rotate the Supabase server secret immediately if it is exposed; store it only as a server-only Vercel environment variable.

## Accounting and inventory controls

- Close an accounting period only after bank/party reconciliation and voucher-balance validation. Closed periods reject edits and postings.
- Corrections to posted invoices use cancellation/reversal, not deletion. A reason is mandatory and stock is reversed atomically.
- Inventory adjustments require a reason and create immutable stock movements plus an audit event.
- Reservations reduce available stock. Negative stock and consumption below active reservations are rejected in PostgreSQL.

## Pharma compliance

- Maintain Schedule class, prescription requirement, cold-chain and controlled-substance flags on each item.
- Schedule H/H1/X/NDPS sales require patient, prescriber and prescription reference data and write the controlled-drug register.
- Open recalled/quarantined batches cannot be sold. Drug-licence expiry and recall closure are administrator/manager responsibilities.
- Regulatory logs and audit records are append-oriented. Export and retain them according to the organization’s applicable jurisdiction and licence conditions.
