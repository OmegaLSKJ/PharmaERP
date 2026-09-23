import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('server-only', () => ({}))

describe('Security Hardening Test Suite', () => {
  it('Migration 026 exists and enforces RLS and REVOKE ALL for anon and authenticated', () => {
    const migrationPath = path.resolve(__dirname, '../database/migrations/026_comprehensive_security_lockdown.sql')
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE')
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES')
    expect(sql).toContain('FROM anon, authenticated')
  })

  it('next.config.ts configures defensive HTTP security headers', () => {
    const configPath = path.resolve(__dirname, '../next.config.ts')
    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('X-Frame-Options')
    expect(content).toContain('DENY')
    expect(content).toContain('X-Content-Type-Options')
    expect(content).toContain('nosniff')
    expect(content).toContain('Strict-Transport-Security')
  })

  it('apps/web/lib/auth.ts forbids mock credentials when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalUrl = process.env.SUPABASE_URL
    try {
      // Mock environment
      process.env.NODE_ENV = 'production'
      delete process.env.SUPABASE_URL

      // Dynamically re-import auth to test signIn rejection
      const { signIn, hasRealSupabase } = await import('../apps/web/lib/auth')
      expect(hasRealSupabase()).toBe(false)
      await expect(signIn('admin@borgangdrugdistributors.com', 'admin12345678')).rejects.toThrow(
        /Authentication backend is not configured/
      )
    } finally {
      process.env.NODE_ENV = originalEnv
      if (originalUrl) process.env.SUPABASE_URL = originalUrl
    }
  })

  it('apps/web/lib/api-handler.ts rejects foreign .vercel.app origins', () => {
    const apiHandlerPath = path.resolve(__dirname, '../apps/web/lib/api-handler.ts')
    const content = fs.readFileSync(apiHandlerPath, 'utf-8')
    // Ensure the old permissive wildcard is eradicated
    expect(content).not.toContain("originUrl.hostname.endsWith('.vercel.app')")
  })
})
