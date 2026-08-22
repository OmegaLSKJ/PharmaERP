# Production deployment checklist

1. Provision PostgreSQL 16+, create a separate migration role and application role.
2. Set `DATABASE_URL` and a strong `ERP_API_KEY` in the deployment secret manager.
3. Apply `database/migrations/001_initial_erp_schema.sql` using the migration role.
4. Replace the local JSON adapter in `apps/web/lib/erp-store.ts` with a parameterized PostgreSQL repository before accepting production data.
5. Deploy `apps/web` using `npm run build` then `npm start`; confirm `/api/health` returns `status: ok` and `databaseConfigured: true`.
6. Run backup/restore, role-permission, sales-to-ledger, and challan-to-stock tests in staging before launch.

Do not deploy with the sample Docker database password or the JSON adapter.
# Supabase on Vercel

Set these **Production** environment variables in the Vercel project before deploying:

```text
SUPABASE_URL=https://twdmtlfybwjdzpxivmze.supabase.co
SUPABASE_SECRET_KEY=<Supabase secret key from Project Settings → API Keys>
ERP_API_KEY=<long random server API key>
```

`SUPABASE_SECRET_KEY` is deliberately server-only. Do not use a `NEXT_PUBLIC_` name,
do not add it to source control, and do not expose it to the browser.
