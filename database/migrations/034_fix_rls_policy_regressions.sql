-- Migration 034: Fix RLS policy regressions (H-5, H-6)
--
-- Problem 1 (H-5): Migration 018 created account_groups_org_isolation policy using
--   auth.uid() which allows anon/authenticated roles to query the table directly if
--   they supply a valid JWT. All ERP data must flow through the server-only service_role
--   path exclusively. This migration drops that policy and replaces it with the correct
--   service_role-only pattern consistent with every other ERP table.
--
-- Problem 2 (H-6): Although migration 026 revokes all table/sequence/function
--   permissions from anon and authenticated, it does not revoke USAGE on schema public
--   itself. Without that revoke, those roles can still enumerate table names and call
--   public functions even with no table grants. This migration closes that gap.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix account_groups RLS policy (H-5)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

-- Strip all direct-role access from anon / authenticated
REVOKE ALL ON TABLE public.account_groups FROM anon, authenticated;

-- Grant only service_role (the server-side API key) full access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_groups TO service_role;

-- Drop the broken policy that used auth.uid() (allows authenticated role access)
DROP POLICY IF EXISTS account_groups_org_isolation ON public.account_groups;

-- Create the correct server_only policy, consistent with every other ERP table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'account_groups' AND policyname = 'server_only'
  ) THEN
    CREATE POLICY server_only ON public.account_groups
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Revoke schema-level USAGE from anon / authenticated (H-6)
-- ─────────────────────────────────────────────────────────────────────────────
-- Without this, anon/authenticated roles can still enumerate objects in the
-- public schema even though they have no table grants. Revoking USAGE on the
-- schema prevents that.

REVOKE USAGE ON SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM authenticated;

-- Ensure service_role retains full schema access
GRANT USAGE ON SCHEMA public TO service_role;

-- Lock down default privileges so future tables/sequences/functions
-- created in this schema are also inaccessible to client roles by default.
-- (migration 026 already set this, but repeated here for explicit intent)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES  FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (run manually in Supabase SQL editor after applying):
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY table_name, grantee;
-- Expected: 0 rows
