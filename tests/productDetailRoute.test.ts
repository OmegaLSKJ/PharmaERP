import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ verifyRequest: vi.fn(), hasRealSupabase: vi.fn(), adminClient: vi.fn(), applyRefreshedSession: vi.fn() }))
vi.mock('../apps/web/lib/auth', () => mocks)
import { GET } from '../src/modules/product-detail/server/route'

const organizationQuery = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'org-1' }, error: null }) }) }) }
const item = { id: 'item-1', name: 'Sample product', mrp: 100, sale_rate: 80, purchase_rate: 70, manufacturers: { name: 'Maker' }, hsn_codes: { code: '3004', gst_rate: 12 }, salts: { composition: 'Sample composition' } }
const itemQuery = { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: item, error: null }), limit: async () => ({ data: [item], error: null }) }) }) }) }
const batchQuery = {
  select: () => ({
    eq: () => ({
      eq: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'batch-1', batch_number: 'B-1', expiry_on: '2028-12-01', mrp: 110, cost_price: 72, purchase_price: 75, sale_price: 90, rack_number: 'A-1', stock_movements: [{ quantity: 4 }, { quantity: -1 }] }], error: null }) }) }),
      order: () => ({ limit: async () => ({ data: [{ id: 'batch-1', batch_number: 'B-1', stock_movements: [] }], error: null }) }),
    }),
  }),
}

describe('product detail endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasRealSupabase.mockReturnValue(true)
    mocks.verifyRequest.mockResolvedValue({ user: { id: 'user', app_metadata: { role: 'operator' } } })
    mocks.applyRefreshedSession.mockImplementation(response => response)
    mocks.adminClient.mockReturnValue({ from: (table: string) => table === 'organizations' ? organizationQuery : table === 'items' ? itemQuery : batchQuery })
  })

  it('requires an item identifier or product name', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/product-detail'))
    expect(response.status).toBe(400)
    expect(mocks.verifyRequest).not.toHaveBeenCalled()
  })

  it('requires a verified session and never falls back to mock records', async () => {
    mocks.verifyRequest.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/v1/product-detail?itemId=11111111-1111-4111-8111-111111111111'))
    expect(response.status).toBe(401)
    expect(mocks.adminClient).not.toHaveBeenCalled()
  })

  it('uses live product and batch data with private no-store headers', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/product-detail?itemId=11111111-1111-4111-8111-111111111111&batchId=22222222-2222-4222-8222-222222222222'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie')
    expect(await response.json()).toMatchObject({ data: { id: 'item-1', batchId: 'batch-1', hsn: '3004', gstRate: 12, stock: 3, costPrice: 72, location: 'A-1' } })
  })

  it('falls back to the product name when a legacy screen sends a non-UUID item ID', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/product-detail?itemId=local-item-12&itemName=Sample%20product&batchNumber=B-1'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { id: 'item-1', batch: 'B-1' } })
  })

  it('rejects a Supabase configuration that is not available', async () => {
    mocks.hasRealSupabase.mockReturnValue(false)
    const response = await GET(new NextRequest('http://localhost/api/v1/product-detail?itemName=Sample%20product'))
    expect(response.status).toBe(503)
    expect(mocks.verifyRequest).not.toHaveBeenCalled()
  })
})
