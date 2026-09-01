import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRefreshedSession, clearSessionCookies, verifyRequest, type AuthenticatedRequest } from '../../../../../apps/web/lib/auth'
import { inviteManagedUser, listManagedUsers, removeManagedUser, updateManagedUser } from '../../../../../apps/web/lib/user-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const inviteSchema = z.object({ email: z.string().trim().email().max(254), name: z.string().trim().min(2).max(100), role: z.enum(['admin','manager','operator']) })
const updateSchema = z.object({ id: z.string().uuid(), role: z.enum(['admin','manager','operator']).optional(), active: z.boolean().optional() }).refine((value) => value.role !== undefined || value.active !== undefined)

async function authorize(request: NextRequest) {
  const auth = await verifyRequest(request)
  if (!auth) return { response: clearSessionCookies(NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 })) }
  if (auth.user.app_metadata?.role !== 'admin') return { response: NextResponse.json({ error: { message: 'Administrator access is required.' } }, { status: 403 }) }
  const origin = request.headers.get('origin')
  if (request.method !== 'GET' && origin) {
    try {
      const originUrl = new URL(origin)
      const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host')
      const isAllowed = (hostHeader && originUrl.hostname === hostHeader.split(':')[0]) ||
        originUrl.hostname.endsWith('.vercel.app') ||
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1' ||
        origin === request.nextUrl.origin
      if (!isAllowed) return { response: NextResponse.json({ error: { message: 'Invalid request origin.' } }, { status: 403 }) }
    } catch {
      return { response: NextResponse.json({ error: { message: 'Invalid request origin.' } }, { status: 403 }) }
    }
  }
  return { auth }
}
function success(data: unknown, auth: AuthenticatedRequest, status=200) { return applyRefreshedSession(NextResponse.json({ data }, { status, headers: { 'Cache-Control':'private, no-store' } }),auth) }
function failure(error: unknown) { const message=error instanceof Error ? error.message : 'The operation could not be completed.'; return NextResponse.json({error:{message}},{status:422,headers:{'Cache-Control':'private, no-store'}}) }

export async function GET(request:NextRequest) { const access=await authorize(request);if(access.response)return access.response;try{return success(await listManagedUsers(),access.auth!)}catch(error){return failure(error)} }
export async function POST(request:NextRequest) { const access=await authorize(request);if(access.response)return access.response;try{const body=inviteSchema.parse(await request.json());return success(await inviteManagedUser({...body,redirectTo:`${request.nextUrl.origin}/login`}),access.auth!,201)}catch(error){return failure(error)} }
export async function PATCH(request:NextRequest) { const access=await authorize(request);if(access.response)return access.response;try{const body=updateSchema.parse(await request.json());return success(await updateManagedUser(body.id,{role:body.role,active:body.active},access.auth!.user.id),access.auth!)}catch(error){return failure(error)} }
export async function DELETE(request:NextRequest) { const access=await authorize(request);if(access.response)return access.response;try{const id=request.nextUrl.searchParams.get('id');if(!id||!z.string().uuid().safeParse(id).success)throw new Error('A valid user id is required.');await removeManagedUser(id,access.auth!.user.id);return success({id},access.auth!)}catch(error){return failure(error)} }
