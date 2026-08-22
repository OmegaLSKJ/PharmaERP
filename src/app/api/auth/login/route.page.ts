import { NextRequest, NextResponse } from 'next/server'
import { publicUser, setSessionCookies, signIn } from '../../../../../apps/web/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) throw new Error('Email and password are required.')
    const { user, session } = await signIn(email, password)
    return setSessionCookies(NextResponse.json({ data: publicUser(user) }), session)
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Unable to sign in.' } }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

