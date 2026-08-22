import { NextRequest, NextResponse } from 'next/server'
import { acceptInvite, publicUser, setSessionCookies } from '../../../../../apps/web/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : ''
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!accessToken || !refreshToken) throw new Error('This invitation is invalid or incomplete.')
    if (password.length < 12) throw new Error('Use a password with at least 12 characters.')

    const { user, session } = await acceptInvite(accessToken, refreshToken, password)
    return setSessionCookies(NextResponse.json({ data: publicUser(user) }), session)
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Unable to accept invitation.' } },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
