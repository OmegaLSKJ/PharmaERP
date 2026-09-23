import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSession, clearSessionCookies, verifyRequest, type AuthenticatedRequest } from './auth'
import { create, list, remove, update } from './erp-store'
import { canAccess, userRole, type ErpMethod } from './permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authenticate(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth) return { response: clearSessionCookies(NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 })) }
  return { auth }
}
function success(data: unknown, auth: AuthenticatedRequest, requestId: string, status = 200) { const response = NextResponse.json({ data }, { status }); response.headers.set('X-Request-Id', requestId); return applyRefreshedSession(response, auth) }
function failure(error: unknown, requestId: string, status = 422) {
  let raw = 'Invalid request.'
  if (error instanceof Error) {
    raw = error.message
  } else if (error && typeof error === 'object') {
    const errObj = error as any
    raw = errObj.message || errObj.error_description || errObj.details || errObj.hint || JSON.stringify(error)
  } else if (typeof error === 'string') {
    raw = error
  }
  const message = raw.length <= 300 && !/SUPABASE_SECRET|service_role|postgres:\/\//i.test(raw) ? raw : 'The operation could not be completed.'
  console.error(JSON.stringify({ level: 'error', event: 'erp_api_failure', requestId, message: raw, errorDetail: error }))
  return NextResponse.json({ error: { message, requestId } }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } })
}
function mutationOriginAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const nextUrl = request.nextUrl;
    
    // 1. Direct same-origin match
    if (origin === nextUrl.origin || originUrl.hostname === nextUrl.hostname) {
      return true;
    }

    // 2. Reverse proxy / forwarded host match
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0].trim().toLowerCase();
      if (originUrl.hostname.toLowerCase() === cleanHost) {
        return true;
      }
    }

    // 3. Custom configured allowed origin
    const configuredOrigin = process.env.ALLOWED_ORIGIN;
    if (configuredOrigin && (origin === configuredOrigin || originUrl.hostname === configuredOrigin)) {
      return true;
    }

    // 4. Localhost allowed ONLY during development / testing
    if (process.env.NODE_ENV !== 'production') {
      const isLocal = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
      if (isLocal(originUrl.hostname)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
async function access(request: NextRequest, method: ErpMethod, resource: string) { const authenticated = await authenticate(request); if (authenticated.response) return authenticated; const role = userRole(authenticated.auth!.user.app_metadata?.role, authenticated.auth!.user.user_metadata?.role); if (!canAccess(role, method, resource)) return { response: NextResponse.json({ error: { message: 'Forbidden.' } }, { status: 403 }) }; if (method !== 'GET' && !mutationOriginAllowed(request)) return { response: NextResponse.json({ error: { message: 'Invalid request origin.' } }, { status: 403 }) }; return authenticated }

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) { const requestId = crypto.randomUUID(); const { resource } = await params; const granted = await access(request, 'GET', resource); if (granted.response) return granted.response; try { const party = request.nextUrl.searchParams.get('party') ?? undefined; const manufacturer = request.nextUrl.searchParams.get('manufacturer') ?? undefined; const manufacturerId = request.nextUrl.searchParams.get('manufacturerId') ?? undefined; return success(await list(resource, party, { manufacturer, manufacturerId }), granted.auth!, requestId) } catch (error) { return failure(error, requestId) } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) { const requestId = crypto.randomUUID(); const { resource } = await params; const granted = await access(request, 'POST', resource); if (granted.response) return granted.response; try { const body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A JSON object is required.'); const actor = { id: granted.auth!.user.id, email: granted.auth!.user.email, requestId }; const data = await create(resource, body, actor); console.info(JSON.stringify({ level: 'info', event: 'erp_mutation', requestId, resource, method: 'POST', actorId: actor.id })); return success(data, granted.auth!, requestId, 201) } catch (error) { return failure(error, requestId) } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) { const requestId = crypto.randomUUID(); const { resource } = await params; const granted = await access(request, 'PATCH', resource); if (granted.response) return granted.response; try { const id = request.nextUrl.searchParams.get('id'); if (!id) throw new Error('Record id is required.'); const actor = { id: granted.auth!.user.id, email: granted.auth!.user.email, requestId }; return success(await update(resource, id, await request.json(), actor), granted.auth!, requestId) } catch (error) { return failure(error, requestId) } }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) { const requestId = crypto.randomUUID(); const { resource } = await params; const granted = await access(request, 'DELETE', resource); if (granted.response) return granted.response; try { const id = request.nextUrl.searchParams.get('id'); if (!id) throw new Error('Record id is required.'); const actor = { id: granted.auth!.user.id, email: granted.auth!.user.email, requestId }; return success(await remove(resource, id, actor), granted.auth!, requestId) } catch (error) { return failure(error, requestId) } }
