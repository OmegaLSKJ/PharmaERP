import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient, applyRefreshedSession, hasRealSupabase, verifyRequest } from '../../../../apps/web/lib/auth'
import { canAccess, userRole } from '../../../../apps/web/lib/permissions'
import { loadAnalysisSources } from './source'
import { normalizeSources } from '../normalize'

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  const fail = (message: string, status: number) => NextResponse.json({ error: { message } }, { status, headers })
  // Never turn absent credentials into business reports based on mock data.
  if (!hasRealSupabase()) return fail('The live Supabase connection is not configured for this environment.', 503)
  try {
    const auth = await verifyRequest(request)
    if (!auth) return fail('Please sign in to view reports.', 401)
    const role = userRole(auth.user.app_metadata?.role)
    if (!canAccess(role, 'GET', 'report-sale-analysis')) return fail('You do not have permission to read reports.', 403)
    const client = adminClient()
    // Match the existing ERP organization configuration, without its context() write side effects.
    const name = process.env.ERP_ORGANIZATION_NAME ?? 'Borgang Drug Distributors'
    const { data: organization, error } = await client.from('organizations').select('id,name').eq('name', name).maybeSingle()
    if (error || !organization) return fail('The configured reporting organization could not be found.', 503)
    const assignedOrganization = auth.user.app_metadata?.organization_id
    if (assignedOrganization && assignedOrganization !== organization.id) return fail('This session belongs to another organization.', 403)
    const source = await loadAnalysisSources(client, organization.id)
    const data = normalizeSources(source, organization.name)
    return applyRefreshedSession(NextResponse.json({ data }, { headers }), auth)
  } catch {
    return fail('Live report data could not be loaded completely. Please refresh or check the Supabase connection.', 503)
  }
}
