import { describe, expect, it } from 'vitest'
import { REPORTS } from '../src/modules/purchase-analysis/catalog'
import { buildPurchaseReport, csvReport } from '../src/modules/purchase-analysis/engine'
import { normalizePurchaseSources } from '../src/modules/purchase-analysis/normalize'
import { loadPurchaseSources, readEveryPage, SOURCE_QUERIES } from '../src/modules/purchase-analysis/server/source'
import type { Filters, SourceData } from '../src/modules/purchase-analysis/types'

const filters: Filters = { from: '', to: '', supplier: '', company: '', item: '', search: '' }
const fixture = (): SourceData => ({
  parties: [{ id: 's1', legal_name: 'Example Supplier' }], manufacturers: [{ id: 'm1', name: 'Example Pharma' }], items: [{ id: 'i1', code: 'ITEM-1', name: 'Example Item', manufacturer_id: 'm1' }], item_batches: [{ id: 'b1', item_id: 'i1', batch_number: 'B1' }],
  purchase_invoices: [{ id: 'p1', party_id: 's1', invoice_number: 'PB-1', supplier_invoice_number: 'S-1', invoice_date: '2026-09-01', status: 'posted', subtotal: 1000, discount_total: 100, tax_total: 45, rounding_adjustment: 0, grand_total: 945 }, { id: 'p2', party_id: 's1', invoice_number: 'PB-2', invoice_date: '2026-09-02', status: 'posted', subtotal: 500, discount_total: 0, tax_total: 0, grand_total: 500 }, { id: 'p3', party_id: 's1', invoice_number: 'CANCELLED', invoice_date: '2026-09-03', status: 'cancelled', grand_total: 10000 }],
  purchase_invoice_lines: [{ id: 'l1', invoice_id: 'p1', item_id: 'i1', item_batch_id: 'b1', quantity: 10, free_quantity: 1, rate: 100, discount_percent: 10, gst_rate: 5, line_total: 945 }],
  business_documents: [{ id: 'r1', document_type: 'purchase_return', document_number: 'PR-1', document_date: '2026-09-04', party_id: 's1', status: 'posted', total: 189, details: { origInvoice: 'PB-1', lines: [{ name: 'Example Item', batch: 'B1', qty: 2, rate: 100, discount: 10, gstRate: 5 }] } }, { id: 'b1', document_type: 'breakage', document_number: 'BR-1', document_date: '2026-09-05', party_id: 's1', status: 'posted', total: 60, details: { lines: [{ name: 'Example Item', batch: 'B1', qty: 1, rate: 60 }] } }], audit_logs: [],
})
describe('purchase analysis', () => {
  it('reconciles posted bills, header-only bills, returns, and all report views', () => {
    const data = normalizePurchaseSources(fixture(), 'Test'), consolidated = buildPurchaseReport('consolidated', data, filters)
    expect(REPORTS).toHaveLength(13); expect(consolidated.totals).toMatchObject({ gross: 1300, discount: 80, net: 1220, tax: 36, total: 1256 })
    expect(data.records.find(row => row.document === 'PB-2')).toMatchObject({ item: 'Unallocated bill values', quantity: null, total: 500 })
    expect(buildPurchaseReport('returns', data, filters).totals.total).toBe(-189)
    expect(buildPurchaseReport('item-percent', data, filters).rows.find(row => row.item === 'Example Item')?.purchasePercent).toBe(60.19)
    for (const [id] of REPORTS) expect(buildPurchaseReport(id, data, filters).columns.length).toBeGreaterThan(0)
  })
  it('keeps amendments informational and makes unsafe export cells literal text', () => {
    const raw = fixture(); raw.audit_logs = [{ id: 'a1', entity_type: 'purchases', entity_id: 'p3', action: 'amended', before_state: { number: 'CANCELLED' }, after_state: { id: 'PB-2', total: 500 }, occurred_at: '2026-09-02T10:00:00Z' }]
    const result = buildPurchaseReport('summary', normalizePurchaseSources(raw, 'Test'), filters)
    expect(result.totals.total).toBe(1256)
    expect(csvReport([{ supplier: '=DANGER' }], [{ key: 'supplier', label: 'Supplier' }])).toContain("'=DANGER")
  })
  it('resolves unlinked item manufacturers from catalog and labels round-off adjustments cleanly', () => {
    const raw: SourceData = {
      parties: [{ id: 's1', legal_name: 'Borgang Drug Suppliers' }],
      manufacturers: [{ id: 'm-dwd', name: 'DWD' }],
      items: [
        { id: 'i-kido', code: '13862', name: 'KIDODENT 60GM', manufacturer_id: null },
        { id: 'i-cypon', code: 'A002_2583', name: 'CYPON SYP 200ML', manufacturer_id: null },
        { id: 'i-funspro', code: 'AF613', name: 'FUNSPRO DUSTING 100GM', manufacturer_id: null },
        { id: 'i-drep', code: 'o0733', name: 'DREP WAX DROPS 10ML', manufacturer_id: 'm-dwd' },
      ],
      item_batches: [],
      purchase_invoices: [
        {
          id: 'p-round',
          party_id: 's1',
          invoice_number: 'PB-ROUND-1',
          invoice_date: '2026-09-01',
          status: 'posted',
          subtotal: 1000,
          discount_total: 0,
          tax_total: 50,
          rounding_adjustment: 0.48,
          grand_total: 1050.48,
        },
      ],
      purchase_invoice_lines: [
        {
          id: 'l-kido',
          invoice_id: 'p-round',
          item_id: 'i-kido',
          quantity: 10,
          rate: 100,
          discount_percent: 0,
          gst_rate: 5,
          line_total: 1050,
        },
      ],
      business_documents: [],
      audit_logs: [],
    }
    const data = normalizePurchaseSources(raw, 'Test Org')
    const kidoLine = data.records.find(r => r.item === 'KIDODENT 60GM')
    expect(kidoLine?.company).toBe('TORRENT')

    const roundLine = data.records.find(r => r.id === 'purchase:p-round:reconciliation')
    expect(roundLine).toBeDefined()
    expect(roundLine?.item).toBe('Bill Round-off')
    expect(roundLine?.company).toBe('TORRENT')
    expect(roundLine?.total).toBe(0.48)

    expect(data.options.companies.some(c => c.name === 'TORRENT')).toBe(true)
  })
})
describe('purchase source reader', () => {
  it('loads every page and scopes every table to the organization', async () => {
    const rows = await readEveryPage(async from => ({ data: Array.from({ length: Math.min(23, 777 - from) }, (_, offset) => ({ id: String(from + offset) })), count: 777, error: null }), 'purchases')
    expect(rows).toHaveLength(777)
    const scopes: Array<[string, string, string]> = []; const client = { from: (table: string) => { const query = { select: () => query, eq: (key: string, value: string) => { scopes.push([table, key, value]); return query }, order: () => query, range: async () => ({ data: [], count: 0, error: null }) }; return query } }
    await loadPurchaseSources(client as any, 'org-1')
    expect(scopes.filter(([, key, value]) => key.endsWith('organization_id') && value === 'org-1')).toHaveLength(SOURCE_QUERIES.length)
    expect(scopes.filter(([table]) => table === 'audit_logs')).toEqual([['audit_logs', 'organization_id', 'org-1'], ['audit_logs', 'entity_type', 'purchases'], ['audit_logs', 'action', 'amended']])
  })
})
