import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSession, clearSessionCookies, verifyRequest, type AuthenticatedRequest } from '../../../../../apps/web/lib/auth'
import { create, list, remove, update } from '../../../../../apps/web/lib/erp-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authenticate(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth) return { response: clearSessionCookies(NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 })) }
  return { auth }
}

function success(data: unknown, auth: AuthenticatedRequest, status = 200) {
  return applyRefreshedSession(NextResponse.json({ data }, { status }), auth)
}

function failure(error: unknown) {
  return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Invalid request.' } }, { status: 422, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const access = await authenticate(request)
  if (access.response) return access.response
  try { const { resource } = await params; return success(await list(resource, request.nextUrl.searchParams.get('party') ?? undefined), access.auth) } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const access = await authenticate(request)
  if (access.response) return access.response
  try { const { resource } = await params; const body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A JSON object is required.'); return success(await create(resource, body), access.auth, 201) } catch (error) { return failure(error) }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const access = await authenticate(request)
  if (access.response) return access.response
  try { const { resource } = await params; const id = request.nextUrl.searchParams.get('id'); if (!id) throw new Error('Record id is required.'); return success(await update(resource, id, await request.json()), access.auth) } catch (error) { return failure(error) }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const access = await authenticate(request)
  if (access.response) return access.response
  try { const { resource } = await params; const id = request.nextUrl.searchParams.get('id'); if (!id) throw new Error('Record id is required.'); return success(await remove(resource, id), access.auth) } catch (error) { return failure(error) }
}
