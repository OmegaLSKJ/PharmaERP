import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({
  verifyRequest: vi.fn(),
  hasRealSupabase: vi.fn(),
  adminClient: vi.fn(),
  applyRefreshedSession: vi.fn(),
}))
vi.mock('../apps/web/lib/auth', () => mocks)
import { GET } from '../src/modules/party-detail/server/route'

const organizationQuery = {
  select: () => ({
    eq: () => ({
      maybeSingle: async () => ({ data: { id: 'org-1' }, error: null }),
    }),
  }),
}

const partyRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'PTY-001',
  legal_name: 'Test Healthcare Pharmacy',
  party_type: 'customer',
  phone: '9876543210',
  credit_limit: 100000,
  party_addresses: [{ line1: 'Main Street', city: 'Tezpur', state_code: 'AS', is_default: true }],
  party_details: [{ station: 'Tezpur Station', credit_days: 30, pan: 'ABCDE1234F' }],
  drug_licenses: [{ license_number: 'DL-12345', license_type: 'drug_license' }],
}

const partyQuery = {
  select: () => ({
    eq: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: partyRecord, error: null }),
      }),
      or: () => ({
        limit: async () => ({ data: [partyRecord], error: null }),
      }),
    }),
  }),
}

const accountsQuery = {
  select: () => ({
    eq: () => ({
      or: () => ({
        maybeSingle: async () => ({
          data: {
            id: 'acc-1',
            opening_balance: 5000,
            account_group: 'Sundry Debtors',
            voucher_lines: [
              {
                id: 'vl-1',
                debit: 2000,
                credit: 0,
                vouchers: { voucher_number: 'VCH-1', voucher_date: '2026-01-01', voucher_type: 'Sales' },
              },
            ],
          },
          error: null,
        }),
      }),
    }),
  }),
}

const salesQuery = {
  select: () => ({
    eq: () => ({
      eq: () => ({
        neq: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  id: 's-1',
                  invoice_number: 'INV-101',
                  invoice_date: '2026-02-01',
                  grand_total: 15000,
                  sales_invoice_lines: [
                    {
                      id: 'sl-1',
                      quantity: 10,
                      line_total: 15000,
                      items: { name: 'Paracetamol 500mg', code: 'PCM500' },
                      item_batches: { batch_number: 'B1', expiry_on: '2027-12-01' },
                    },
                  ],
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}

const purchaseQuery = {
  select: () => ({
    eq: () => ({
      eq: () => ({
        neq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}

describe('party detail endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasRealSupabase.mockReturnValue(true)
    mocks.verifyRequest.mockResolvedValue({
      user: { id: 'user-1', app_metadata: { role: 'operator' } },
    })
    mocks.applyRefreshedSession.mockImplementation((res) => res)
    mocks.adminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'organizations') return organizationQuery
        if (table === 'parties') return partyQuery
        if (table === 'chart_of_accounts') return accountsQuery
        if (table === 'sales_invoices') return salesQuery
        if (table === 'purchase_invoices') return purchaseQuery
        return { select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }
      },
    })
  })

  it('requires a party identifier or name', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/party-detail'))
    expect(response.status).toBe(400)
    expect(mocks.verifyRequest).not.toHaveBeenCalled()
  })

  it('requires a verified session', async () => {
    mocks.verifyRequest.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/v1/party-detail?partyId=11111111-1111-4111-8111-111111111111'))
    expect(response.status).toBe(401)
  })

  it('returns focused party details with 200 and private no-store headers', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/v1/party-detail?partyId=11111111-1111-4111-8111-111111111111')
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie')
    const json = await response.json()
    expect(json.data).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test Healthcare Pharmacy',
      city: 'Tezpur',
      dlNo: 'DL-12345',
    })
    expect(Array.isArray(json.data.recentTxns)).toBe(true)
    expect(Array.isArray(json.data.trendData)).toBe(true)
  })
})
