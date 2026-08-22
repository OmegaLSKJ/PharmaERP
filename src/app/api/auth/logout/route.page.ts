import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookies, revokeRequestSession } from '../../../../../apps/web/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  await revokeRequestSession(request).catch(() => undefined)
  return clearSessionCookies(NextResponse.json({ data: { signedOut: true } }))
}

