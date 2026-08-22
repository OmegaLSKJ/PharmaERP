import { NextResponse } from 'next/server'
import { create, list } from '../../../../lib/erp-store'
export const runtime = 'nodejs'
function authorize(request: Request) {
  const key = process.env.ERP_API_KEY
  if (process.env.NODE_ENV === 'production' && !key) return NextResponse.json({ error: { message: 'API is not configured.' } }, { status: 503 })
  if (key && request.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 401 })
  return null
}
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) { const denied = authorize(request); if (denied) return denied; const { resource } = await params; const party = new URL(request.url).searchParams.get('party') ?? undefined; return NextResponse.json({ data: await list(resource, party) }) }
export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) { const denied = authorize(request); if (denied) return denied; try { const { resource } = await params; const body = await request.json(); if (!body || typeof body !== 'object') throw new Error('A JSON object is required.'); const data = await create(resource, body); return NextResponse.json({ data }, { status: 201 }) } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Invalid request' } }, { status: 422 }) } }
