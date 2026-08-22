import 'server-only'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_COOKIE = 'pharmaerp-access-token'
const REFRESH_COOKIE = 'pharmaerp-refresh-token'

function supabaseUrl() {
  const value = process.env.SUPABASE_URL
  if (!value) throw new Error('SUPABASE_URL is not configured.')
  return value
}

function publishableKey() {
  const value = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!value) throw new Error('SUPABASE_PUBLISHABLE_KEY is not configured.')
  return value
}

function authClient() {
  return createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured.')
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
  const client = authClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) throw new Error('Invalid email or password.')
  return { user: data.user, session: data.session }
}

export async function verifyRequest(request: NextRequest): Promise<AuthenticatedRequest | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!accessToken && !refreshToken) return null

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
    role: role === 'manager' || role === 'operator' ? role : 'admin',
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
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value
  if (!accessToken) return
  await adminClient().auth.admin.signOut(accessToken, 'local')
}

