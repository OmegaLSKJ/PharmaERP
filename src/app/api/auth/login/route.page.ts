import { NextRequest, NextResponse } from 'next/server'
import { publicUser, setSessionCookies, signIn } from '../../../../../apps/web/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-memory sliding-window rate limiter for brute-force protection
type AttemptRecord = { count: number; firstAttempt: number; lockedUntil?: number }
const attempts = new Map<string, AttemptRecord>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes lockout

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown-client'
}

function cleanStaleAttempts() {
  const now = Date.now()
  for (const [ip, record] of attempts.entries()) {
    if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      attempts.delete(ip)
    }
  }
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const now = Date.now()
  
  if (attempts.size > 1000) cleanStaleAttempts()

  const record = attempts.get(clientIp)
  if (record?.lockedUntil && now < record.lockedUntil) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000)
    return NextResponse.json(
      { error: { message: `Too many failed login attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s).` } },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'Cache-Control': 'private, no-store',
        },
      }
    )
  }

  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) throw new Error('Email and password are required.')
    
    const { user, session } = await signIn(email, password)
    
    // Successful login: reset failed attempts
    attempts.delete(clientIp)
    return setSessionCookies(NextResponse.json({ data: publicUser(user) }), session)
  } catch (error) {
    // Record failed attempt
    const existing = attempts.get(clientIp)
    if (!existing || now - existing.firstAttempt > WINDOW_MS) {
      attempts.set(clientIp, { count: 1, firstAttempt: now })
    } else {
      existing.count += 1
      if (existing.count >= MAX_FAILED_ATTEMPTS) {
        existing.lockedUntil = now + LOCKOUT_MS
      }
    }

    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Unable to sign in.' } },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}

