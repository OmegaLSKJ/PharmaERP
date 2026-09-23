import { describe, expect, it } from 'vitest'
import { REPORTS } from '../src/modules/sale-analysis/catalog'
import { normalizeSources, localDate } from '../src/modules/sale-analysis/normalize'
import { buildAnalysisReport, csvReport } from '../src/modules/sale-analysis/engine'
import { loadAnalysisSources, readEveryPage, SOURCE_QUERIES } from '../src/modules/sale-analysis/server/source'
import type { Filters, SourceData } from '../src/modules/sale-analysis/types'

const filters: Filters = { from: '', to: '', party: '', company: '', item: '', search: '' }
function fixture(): SourceData {
  return {
    parties: [{ id: 'p1', legal_name: 'Example Pharmacy' }],
    manufacturers: [{ id: 'm1', name: 'Example Pharma' }],
    items: [{ id: 'i1', code: 'ITEM-1', name: 'Example Item', manufacturer_id: 'm1', purchase_rate: 60 }],
    item_batches: [{ id: 'b1', item_id: 'i1', batch_number: 'B1', cost_price: 60 }],
    warehouses: [{ id: 'w1', name: 'Warehouse 1' }, { id: 'w2', name: 'Warehouse 2' }],
    sales_invoices: [
      { id: 's1', party_id: 'p1', invoice_number: 'SI-1', invoice_date: '2026-09-01', status: 'posted', subtotal: 1000, discount_total: 100, tax_total: 45, grand_total: 945, rounding_adjustment: 0 },
      { id: 's2', party_id: 'p1', invoice_number: 'SI-2', invoice_date: '2026-09-02', status: 'posted', subtotal: 500, discount_total: 0, tax_total: 0, grand_total: 500 },
      { id: 's3', party_id: 'p1', invoice_number: 'CANCELLED', invoice_date: '2026-09-03', status: 'cancelled', subtotal: 10000, grand_total: 10000 },
      { id: 's4', party_id: 'p1', invoice_number: 'DRAFT', invoice_date: '2026-09-03', status: 'draft', subtotal: 20000, grand_total: 20000 },
    ],
    sales_invoice_lines: [{ id: 'l1', invoice_id: 's1', item_id: 'i1', item_batch_id: 'b1', quantity: 10, free_quantity: 1, rate: 100, discount_percent: 10, gst_rate: 5, line_total: 945 }],
    business_documents: [
      { id: 'r1', document_type: 'sale_return', document_number: 'SR-1', document_date: '2026-09-04', party_id: 'p1', status: 'posted', total: 189, details: { origInvoice: 'SI-1', lines: [{ name: 'Example Item', batch: 'B1', qty: 2, freeQty: 0, rate: 100, discount: 10, gstRate: 5 }] } },
      { id: 'c1', document_type: 'claim', document_number: 'CL-1', document_date: '2026-09-05', party_id: 'p1', status: 'pending', total: 75, details: {} },
      { id: 'o1', document_type: 'order', document_number: 'SO-1', document_date: '2026-09-05', party_id: 'p1', status: 'pending', total: 500, details: { type: 'Sale' } },
      { id: 'o2', document_type: 'order', document_number: 'PO-1', document_date: '2026-09-05', status: 'pending', total: 999, details: { type: 'Purchase' } },
      { id: 'a1', document_type: 'breakage', document_number: 'BR-1', document_date: '2026-09-05', status: 'posted', total: 60, details: { lines: [{ name: 'Example Item', batch: 'B1', qty: 1, rate: 60 }] } },
    ],
    stock_movements: [
      { id: 'st1', item_batch_id: 'b1', warehouse_id: 'w1', occurred_at: '2026-08-01T12:00:00Z', quantity: 100 },
      { id: 'st2', item_batch_id: 'b1', warehouse_id: 'w1', occurred_at: '2026-09-02T12:00:00Z', quantity: -11 },
      { id: 'st3', item_batch_id: 'b1', warehouse_id: 'w2', occurred_at: '2026-09-03T12:00:00Z', quantity: 5 },
      { id: 'st4', item_batch_id: 'b1', warehouse_id: 'w1', occurred_at: '2026-09-10T12:00:00Z', quantity: 2 },
    ],
    vouchers: [{ id: 'v1', voucher_type: 'receipt', voucher_number: 'RC-1', voucher_date: '2026-09-05', status: 'posted' }],
    voucher_lines: [{ id: 'vl1', voucher_id: 'v1', account_id: 'cash', debit: 100, credit: 0 }, { id: 'vl2', voucher_id: 'v1', account_id: 'pa1', debit: 0, credit: 100 }],
    chart_of_accounts: [{ id: 'cash', name: 'Cash', account_type: 'general' }, { id: 'pa1', name: 'Example Pharmacy', account_type: 'party', party_id: 'p1' }],
    receipts_payments: [], delivery_challans: [], delivery_challan_lines: [],
  }
}
describe('sale analysis against existing ERP records', () => {
  it('preserves all posted invoice totals, header-only invoices and negative return credits', () => {
    const data = normalizeSources(fixture(), 'Test')
    const report = buildAnalysisReport('consolidated', data, filters)
    expect(report.rows).toHaveLength(3)
    expect(report.totals).toMatchObject({ gross: 1300, discount: 80, net: 1220, tax: 36, total: 1256 })
    expect(data.records.find(r => r.document === 'SI-2')).toMatchObject({ item: 'Unallocated invoice values', quantity: null, total: 500, cost: null })
    expect(data.warnings.join(' ')).toContain('1 posted invoice(s) have no item lines')
    expect(data.records.some(r => ['CANCELLED', 'DRAFT'].includes(r.document))).toBe(false)
  })
  it('reconciles company/item/party/month summaries and does not invent item allocations', () => {
    const data = normalizeSources(fixture(), 'Test')
    for (const id of ['company', 'item', 'party', 'monthly', 'misc'] as const) expect(buildAnalysisReport(id, data, filters).totals.total).toBe(1256)
    expect(buildAnalysisReport('sales', data, { ...filters, company: 'm1' }).totals.total).toBe(945)
    expect(buildAnalysisReport('sales', data, { ...filters, item: 'i1' }).rows).toHaveLength(1)
    expect(buildAnalysisReport('item-analysis', data, filters).totals.margin).toBeNull()
    expect(buildAnalysisReport('item-analysis', data, { ...filters, item: 'i1' }).totals.margin).toBe(180)
  })
  it('preserves round-off without making known quantities/costs unavailable', () => {
    const raw = fixture(); raw.sales_invoices = [raw.sales_invoices[0]]
    raw.sales_invoices[0].grand_total = 945.5
    const data = normalizeSources(raw, 'Test')
    expect(buildAnalysisReport('sales', data, filters).totals).toMatchObject({ quantity: 10, freeQuantity: 1, total: 945.5, rounding: .5 })
    expect(buildAnalysisReport('item-analysis', data, filters).totals.margin).toBe(180)
  })
  it('uses real dates, search matches and return reversals for schemes and discounts', () => {
    const data = normalizeSources(fixture(), 'Test')
    expect(buildAnalysisReport('sales', data, { ...filters, from: '2026-09-02', to: '2026-09-02' }).totals.total).toBe(500)
    expect(buildAnalysisReport('company', data, { ...filters, search: 'Unallocated' }).totals.total).toBe(500)
    expect(buildAnalysisReport('free', data, filters).totals).toMatchObject({ freeQuantity: 1, freeCost: 60 })
    expect(buildAnalysisReport('discount', data, filters).totals.discount).toBe(80)
    expect(buildAnalysisReport('returns', data, filters).totals.total).toBe(-189)
  })
  it('calculates stock by warehouse from signed movements as of the selected date', () => {
    const data = normalizeSources(fixture(), 'Test')
    const r = buildAnalysisReport('stock', data, { ...filters, from: '2026-09-04', to: '2026-09-05', party: 'irrelevant' })
    expect(r.rows).toHaveLength(2); expect(r.totals).toMatchObject({ quantity: 94, valuation: 5640 })
    expect(buildAnalysisReport('stock', data, filters).totals.quantity).toBe(96)
    expect(localDate('2026-09-01T20:00:00Z')).toBe('2026-09-02')
  })
  it('does not fabricate costs from zero defaults or tax from total-only return notes', () => {
    const raw = fixture(); raw.item_batches[0].cost_price = 0; raw.items[0].purchase_rate = 0
    raw.business_documents[0].details = {}
    const data = normalizeSources(raw, 'Test')
    expect(buildAnalysisReport('stock', data, filters).totals.valuation).toBeNull()
    expect(buildAnalysisReport('returns', data, filters).totals).toMatchObject({ net: null, tax: null, total: -189 })
  })
  it('uses receipt allocations once and excludes cancelled receipts and purchase orders', () => {
    const raw = fixture()
    raw.receipts_payments.push({ id: 'rp1', voucher_id: 'v1', party_id: 'p1', amount: 100 })
    raw.business_documents.push({ id: 'legacy1', document_type: 'voucher', document_number: 'RC-1', document_date: '2026-09-05', status: 'posted', details: { type: 'Receipt', lines: [{ ledger: 'Example Pharmacy', credit: 100 }] } })
    raw.vouchers.push({ id: 'v2', voucher_type: 'receipt', voucher_number: 'RC-2', status: 'cancelled' })
    const data = normalizeSources(raw, 'Test')
    expect(buildAnalysisReport('collection', data, filters).totals.paidAmount).toBe(100)
    expect(buildAnalysisReport('dispatch', data, filters).rows.map(r => r.document)).toEqual(['SO-1'])
    expect(buildAnalysisReport('claims', data, filters).totals.claimAmount).toBe(75)
  })
  it('retains unknown receipt amounts and recovers a matching legacy receipt when possible', () => {
    const raw = fixture(); raw.voucher_lines = []
    expect(buildAnalysisReport('collection', normalizeSources(raw, 'Test'), filters).totals.paidAmount).toBeNull()
    raw.business_documents.push({ id: 'legacy1', document_type: 'voucher', document_number: 'RC-1', document_date: '2026-09-05', status: 'posted', details: { type: 'Receipt', lines: [{ ledger: 'Example Pharmacy', credit: 100 }] } })
    const result = buildAnalysisReport('collection', normalizeSources(raw, 'Test'), filters)
    expect(result.totals.paidAmount).toBe(100)
    expect(result.rows.filter(r => r.type === 'COLLECTION')).toHaveLength(1)
  })
  it('supports all 16 reports and exports complete filtered data safely', () => {
    const data = normalizeSources(fixture(), 'Test')
    expect(REPORTS).toHaveLength(16)
    for (const r of REPORTS) expect(buildAnalysisReport(r.id, data, filters).columns.length).toBeGreaterThan(0)
    const csv = csvReport([{ party: '=WEBSERVICE("x")', total: -189, tax: null }], [{ key: 'party', label: 'Party' }, { key: 'total', label: 'Total' }, { key: 'tax', label: 'Tax' }])
    expect(csv).toContain('"\'=WEBSERVICE(""x"")",-189,')
  })
  it('shows audited amendments without adding their replacement value to sales', () => {
    const raw = fixture()
    raw.audit_logs = [{ id: 'audit1', entity_type: 'sales', entity_id: 's3', action: 'amended', before_state: { number: 'CANCELLED' }, after_state: { id: 'SI-2', total: 500 }, occurred_at: '2026-09-02T10:00:00Z' }]
    const report = buildAnalysisReport('collection', normalizeSources(raw, 'Test'), filters)
    expect(report.totals).toMatchObject({ salesValue: 1256, amendmentValue: 500, paidAmount: 100 })
    expect(report.rows.find(r => r.type === 'AMENDMENT')).toMatchObject({ reference: 'CANCELLED', party: 'Example Pharmacy' })
    raw.audit_logs[0].after_state = {}
    expect(buildAnalysisReport('collection', normalizeSources(raw, 'Test'), filters).totals.amendmentValue).toBeNull()
  })
  it('reports posted inventory adjustments with direction and preserves unknown valuation', () => {
    const raw = fixture()
    raw.inventory_adjustments = [{ id: 'a1', adjustment_number: 'ADJ-1', adjustment_date: '2026-09-06', status: 'posted', reason: 'Damaged' }, { id: 'a2', status: 'draft' }]
    raw.inventory_adjustment_lines = [{ id: 'al1', adjustment_id: 'a1', item_batch_id: 'b1', warehouse_id: 'w1', quantity_delta: -3 }]
    const rows = buildAnalysisReport('adjustments', normalizeSources(raw, 'Test'), filters).rows
    expect(rows.find(r => r.document === 'ADJ-1')).toMatchObject({ quantity: 3, activityValue: 180, reference: 'Damaged' })
    expect(rows.find(r => r.document === 'ADJ-1')?.detail).toContain('stock decrease')
    raw.item_batches[0].cost_price = 0; raw.items[0].purchase_rate = 0
    expect(buildAnalysisReport('adjustments', normalizeSources(raw, 'Test'), filters).totals.activityValue).toBeNull()
  })
  it('attributes multi-company invoice round-off to Round-off / Adjustments instead of Multiple', () => {
    const raw = fixture()
    raw.manufacturers.push({ id: 'm2', name: 'Second Pharma' })
    raw.items.push({ id: 'i2', code: 'ITEM-2', name: 'Second Item', manufacturer_id: 'm2', purchase_rate: 40 })
    raw.item_batches.push({ id: 'b2', item_id: 'i2', batch_number: 'B2', cost_price: 40 })
    raw.sales_invoices = [
      { id: 's1', party_id: 'p1', invoice_number: 'SI-MULTI', invoice_date: '2026-09-01', status: 'posted', subtotal: 1000, discount_total: 0, tax_total: 0, grand_total: 999.14, rounding_adjustment: -0.86 }
    ]
    raw.sales_invoice_lines = [
      { id: 'l1', invoice_id: 's1', item_id: 'i1', item_batch_id: 'b1', quantity: 5, free_quantity: 0, rate: 100, discount_percent: 0, gst_rate: 0, line_total: 500 },
      { id: 'l2', invoice_id: 's1', item_id: 'i2', item_batch_id: 'b2', quantity: 5, free_quantity: 0, rate: 100, discount_percent: 0, gst_rate: 0, line_total: 500 }
    ]
    raw.business_documents = []
    const data = normalizeSources(raw, 'Test')
    const companyReport = buildAnalysisReport('company', data, filters)
    const roundRow = companyReport.rows.find(r => r.company === 'Round-off / Adjustments')
    expect(roundRow).toBeDefined()
    expect(roundRow?.rounding).toBe(-0.86)
    expect(companyReport.rows.some(r => r.company === 'Multiple')).toBe(false)
  })
})
describe('read-only source loading', () => {
  it('reads beyond 1,000 rows even when the server caps responses below the requested page size', async () => {
    const data = Array.from({ length: 1203 }, (_, i) => ({ id: String(i) }))
    const rows = await readEveryPage(async from => ({ data: data.slice(from, from + 73), count: data.length, error: null }), 'items')
    expect(rows).toHaveLength(1203); expect(rows.at(-1)?.id).toBe('1202')
  })
  it('fails closed on partial queries, duplicate pages or counts changing during pagination', async () => {
    await expect(readEveryPage(async () => ({ data: null, count: null, error: new Error('denied') }), 'items')).rejects.toThrow('Unable to read')
    await expect(readEveryPage(async () => ({ data: [], count: 1, error: null }), 'items')).rejects.toThrow('Incomplete')
    await expect(readEveryPage(async () => ({ data: [{ id: '1' }], count: 3, error: null }), 'items')).rejects.toThrow('changed')
    await expect(readEveryPage(async from => ({ data: [{ id: String(from) }], count: from ? 3 : 2, error: null }), 'items')).rejects.toThrow('changed')
  })
  it('scopes every query to the configured organization and only calls read methods', async () => {
    const scopes: Array<[string, string, string]> = []
    const client = { from: (table: string) => { const query = { select: () => query, eq: (key: string, value: string) => { scopes.push([table, key, value]); return query }, order: () => query, range: async () => ({ data: [], error: null, count: 0 }) }; return query } }
    await loadAnalysisSources(client as any, 'org-1')
    expect(scopes.filter(([, key, value]) => key.endsWith('organization_id') && value === 'org-1')).toHaveLength(SOURCE_QUERIES.length)
    expect(scopes.filter(([table]) => table === 'audit_logs')).toEqual([['audit_logs', 'organization_id', 'org-1'], ['audit_logs', 'entity_type', 'sales'], ['audit_logs', 'action', 'amended']])
  })
})
