-- Migration 026: Comprehensive Supabase Security Lockdown
-- Guarantees that public client roles (anon, authenticated) have NO direct access
-- to any existing or future tables, sequences, or functions in schema 'public'.
-- All ERP operations must flow through server-side authenticated Next.js API routes
-- utilizing the elevated service_role key.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Enable RLS on every table in public schema
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', r.tablename);
  END LOOP;

  -- 2. Revoke permissions on sequences from anon and authenticated
  FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public')
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated;', r.sequencename);
  END LOOP;

  -- 3. Revoke execution privileges on routines from anon and authenticated
  FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM anon, authenticated;', r.routine_name);
  END LOOP;
END $$;

-- 4. Set default privileges to prevent auto-granting access on newly created tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
