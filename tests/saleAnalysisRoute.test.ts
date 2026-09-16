import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ verifyRequest: vi.fn(), hasRealSupabase: vi.fn(), adminClient: vi.fn(), applyRefreshedSession: vi.fn(), loadAnalysisSources: vi.fn() }))
vi.mock('../apps/web/lib/auth', () => mocks)
vi.mock('../src/modules/sale-analysis/server/source', () => ({ loadAnalysisSources: mocks.loadAnalysisSources }))
import { GET } from '../src/modules/sale-analysis/server/route'

describe('sale analysis endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasRealSupabase.mockReturnValue(true)
    mocks.verifyRequest.mockResolvedValue({ user: { id: 'user', app_metadata: { role: 'operator' } } })
    mocks.adminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'org-1', name: 'Test' }, error: null }) }) }) }) })
    mocks.applyRefreshedSession.mockImplementation(response => response)
    mocks.loadAnalysisSources.mockResolvedValue({})
  })
  it('requires a verified session before accessing report tables', async () => {
    mocks.verifyRequest.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/v1/report-sale-analysis'))
    expect(response.status).toBe(401); expect(mocks.adminClient).not.toHaveBeenCalled(); expect(mocks.loadAnalysisSources).not.toHaveBeenCalled()
  })
  it('never substitutes mock data if Supabase is unconfigured', async () => {
    mocks.hasRealSupabase.mockReturnValue(false)
    const response = await GET(new NextRequest('http://localhost/api/v1/report-sale-analysis'))
    expect(response.status).toBe(503); expect(mocks.verifyRequest).not.toHaveBeenCalled()
  })
  it('enforces organization metadata and does not use user-editable role claims', async () => {
    mocks.verifyRequest.mockResolvedValue({ user: { id: 'user', app_metadata: { organization_id: 'other' }, user_metadata: { role: 'admin' } } })
    const response = await GET(new NextRequest('http://localhost/api/v1/report-sale-analysis'))
    expect(response.status).toBe(403); expect(mocks.loadAnalysisSources).not.toHaveBeenCalled()
  })
  it('returns only complete normalized data with private no-store headers', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/report-sale-analysis'))
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie')
    expect((await response.json()).data.organization).toBe('Test')
    expect(mocks.loadAnalysisSources).toHaveBeenCalledWith(expect.anything(), 'org-1')
  })
  it('does not return stale, partial data or secret-bearing errors on a failed query', async () => {
    mocks.loadAnalysisSources.mockRejectedValue(new Error('SUPABASE_SECRET_KEY=private-example'))
    const response = await GET(new NextRequest('http://localhost/api/v1/report-sale-analysis'))
    const body = await response.json()
    expect(response.status).toBe(503); expect(body.data).toBeUndefined(); expect(JSON.stringify(body)).not.toContain('private-example')
  })
})
