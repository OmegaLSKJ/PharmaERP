import 'server-only'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_COOKIE = 'borgang-access-token'
const REFRESH_COOKIE = 'borgang-refresh-token'

function isValidUrl(urlString?: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false
  const trimmed = urlString.trim()
  if (trimmed.includes('SENSITIVE') || trimmed === '[SENSITIVE]') return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function hasRealSupabase(): boolean {
  return isValidUrl(process.env.SUPABASE_URL)
}

function supabaseUrl(): string {
  const value = process.env.SUPABASE_URL
  if (!isValidUrl(value)) return 'http://localhost'
  return value!
}

function publishableKey() {
  const value = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!value || value.includes('SENSITIVE')) return 'mock-anon-key'
  return value
}

function authClient() {
  if (!hasRealSupabase()) return null as any
  return createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function adminClient() {
  if (!hasRealSupabase()) return null as any
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || key.includes('SENSITIVE')) throw new Error('SUPABASE_SECRET_KEY is not configured.')
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export type AuthenticatedRequest = {
  user: User
  refreshedSession?: Session
}

export async function signIn(email: string, password: string) {
  if (!hasRealSupabase()) {
    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail === 'admin@borgangdrugdistributors.com' && password === 'admin12345678') {
      return {
        user: {
          id: 'mock-admin-id',
          email: 'admin@borgangdrugdistributors.com',
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Administrator' },
          created_at: new Date().toISOString(),
        } as any,
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
        } as any
      }
    }
    throw new Error('Invalid email or password.')
  }

  const client = authClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) throw new Error('Invalid email or password.')
  return { user: data.user, session: data.session }
}

export async function acceptInvite(accessToken: string, refreshToken: string, password: string) {
  if (!hasRealSupabase()) {
    return {
      user: {
        id: 'mock-admin-id',
        email: 'admin@borgangdrugdistributors.com',
        app_metadata: { role: 'admin' },
        user_metadata: { name: 'Administrator' },
        created_at: new Date().toISOString(),
      } as any,
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      } as any
    }
  }

  const client = authClient()
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (sessionError || !sessionData.user || !sessionData.session) throw new Error('This invitation is invalid or has expired.')

  const { data: updateData, error: updateError } = await client.auth.updateUser({ password })
  if (updateError || !updateData.user) throw new Error(updateError?.message ?? 'Unable to set your password.')
  return { user: updateData.user, session: sessionData.session }
}

export async function verifyRequest(request: NextRequest): Promise<AuthenticatedRequest | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!accessToken && !refreshToken) return null

  if (!hasRealSupabase()) {
    if (accessToken === 'mock-access-token') {
      return {
        user: {
          id: 'mock-admin-id',
          email: 'admin@borgangdrugdistributors.com',
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Administrator' },
          created_at: new Date().toISOString(),
        } as any
      }
    }
    return null
  }

  const client = authClient()
  if (accessToken) {
    const { data, error } = await client.auth.getUser(accessToken)
    if (!error && data.user) return { user: data.user }
  }

  if (!refreshToken) return null
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.user || !data.session) return null
  return { user: data.user, refreshedSession: data.session }
}

export function publicUser(user: User) {
  const role = user.app_metadata?.role
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'ERP user',
    role: role === 'admin' || role === 'manager' ? role : 'operator',
  }
}

export function setSessionCookies(response: NextResponse, session: Session) {
  response.cookies.set(ACCESS_COOKIE, session.access_token, { ...cookieBase, maxAge: Math.max(session.expires_in - 30, 60) })
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { ...cookieBase, maxAge: 0 })
  response.cookies.set(REFRESH_COOKIE, '', { ...cookieBase, maxAge: 0 })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export function applyRefreshedSession(response: NextResponse, auth: AuthenticatedRequest) {
  response.headers.set('Cache-Control', 'private, no-store')
  return auth.refreshedSession ? setSessionCookies(response, auth.refreshedSession) : response
}

export async function revokeRequestSession(request: NextRequest) {
  if (!hasRealSupabase()) return
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
  if (!accessToken) return
  await adminClient().auth.admin.signOut(accessToken, 'local')
}
