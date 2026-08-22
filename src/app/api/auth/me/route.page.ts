import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSession, clearSessionCookies, publicUser, verifyRequest } from '../../../../../apps/web/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth) return clearSessionCookies(NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 }))
  return applyRefreshedSession(NextResponse.json({ data: publicUser(auth.user) }), auth)
}

