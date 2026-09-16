import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeSources } from '../src/modules/sale-analysis/normalize'
import { buildAnalysisReport } from '../src/modules/sale-analysis/engine'
import { REPORTS } from '../src/modules/sale-analysis/catalog'
import type { SourceData } from '../src/modules/sale-analysis/types'

// Explicit opt-in; extracts must be local/ignored, never fixtures committed to Git.
const path = process.env.SALE_ANALYSIS_LIVE_FIXTURE
describe.skipIf(!path)('live source reconciliation (read-only snapshot)', () => {
  it('reconciles every posted invoice, all report views, and stock movement totals', () => {
    const raw = JSON.parse(readFileSync(path!, 'utf8')) as SourceData
    const data = normalizeSources(raw, 'Borgang Drug Distributors')
    const filters = { from: '', to: '', party: '', company: '', item: '', search: '' }
    const posted = raw.sales_invoices.filter(r => r.status === 'posted')
    const total = Math.round(posted.reduce((s, r) => s + Number(r.grand_total), 0) * 100) / 100
    expect(buildAnalysisReport('sales', data, filters).totals.total).toBe(total)
    const consolidated = buildAnalysisReport('consolidated', data, filters)
    for (const invoice of posted) expect(consolidated.rows.find(r => r.documentId === `invoice:${invoice.id}`)?.total).toBe(Number(invoice.grand_total))
    for (const id of ['monthly', 'item', 'company', 'party'] as const) expect(buildAnalysisReport(id, data, filters).totals.total).toBe(consolidated.totals.total)
    expect(buildAnalysisReport('stock', data, filters).totals.quantity).toBe(Math.round(raw.stock_movements.reduce((s, m) => s + Number(m.quantity), 0) * 1000) / 1000)
    for (const report of REPORTS) expect(buildAnalysisReport(report.id, data, filters).columns.length).toBeGreaterThan(0)
    console.log(JSON.stringify({ sourceCounts: data.counts, postedInvoices: posted.length, recordedSalesTotal: total, reportRows: Object.fromEntries(REPORTS.map(r => [r.id, buildAnalysisReport(r.id, data, filters).rows.length])), warnings: data.warnings }))
    const output = process.env.SALE_ANALYSIS_PREVIEW_DATA
    if (output) writeFileSync(output, JSON.stringify(data))
  })
})
