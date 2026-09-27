import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import {
  extractDocSequence,
  formatDocNumber,
  applySeriesToDocNumber,
  formatBillWithActiveSeries,
  mapDocTypeToSeriesName
} from '../src/lib/seriesUtils'
import { list, update, create } from '../apps/web/lib/erp-store'

describe('Series Number Formatting and Suffix Cascade', () => {
  describe('extractDocSequence and formatDocNumber', () => {
    it('correctly extracts sequence number from simple and padded numbers', () => {
      expect(extractDocSequence('G0001').sequence).toBe(1)
      expect(extractDocSequence('SI-0005').sequence).toBe(5)
      expect(extractDocSequence('PB-0086').sequence).toBe(86)
      expect(extractDocSequence('CH-0003').sequence).toBe(3)
    })

    it('correctly strips existing suffixes when extracting sequence', () => {
      expect(extractDocSequence('G0001/25-26', 'G', '/25-26').sequence).toBe(1)
      expect(extractDocSequence('G0002/26-27').sequence).toBe(2)
      expect(extractDocSequence('INV-0010-FY26').sequence).toBe(10)
    })

    it('correctly formats document numbers with padding, prefix, and suffix', () => {
      expect(formatDocNumber(1, 'G', '/26-27', 4)).toBe('G0001/26-27')
      expect(formatDocNumber(42, 'PB-', '-2026', 4)).toBe('PB-0042-2026')
      expect(formatDocNumber(5, 'CH-', '', 4)).toBe('CH-0005')
      expect(formatDocNumber(3, 'CN-', '/BDD', 3)).toBe('CN-003/BDD')
    })

    it('re-formats existing bill numbers cleanly and idempotently', () => {
      const series = { prefix: 'G', suffix: '/26-27', padding: 4 }
      expect(applySeriesToDocNumber('G0001', series)).toBe('G0001/26-27')
      expect(applySeriesToDocNumber('G0001/26-27', series)).toBe('G0001/26-27')
      expect(applySeriesToDocNumber('SI-2026-0002', series)).toBe('G0002/26-27')
      expect(applySeriesToDocNumber('G0003/25-26', series)).toBe('G0003/26-27')
    })
  })

  describe('formatBillWithActiveSeries for viewing and printing', () => {
    const seriesList = [
      { id: '1', doc: 'Sale Invoice', prefix: 'G', suffix: '/26-27', nextNo: 1, padding: 4, fyReset: true, active: true },
      { id: '2', doc: 'Purchase Bill', prefix: 'PB-', suffix: '-2026', nextNo: 1, padding: 4, fyReset: true, active: true }
    ]

    it('applies active suffix to unsuffixed invoice numbers', () => {
      expect(formatBillWithActiveSeries('G0001', 'Sale Invoice', seriesList)).toBe('G0001/26-27')
      expect(formatBillWithActiveSeries('PB-0001', 'Purchase Bill', seriesList)).toBe('PB-0001-2026')
    })

    it('normalizes alias document types', () => {
      expect(mapDocTypeToSeriesName('sales')).toBe('Sale Invoice')
      expect(mapDocTypeToSeriesName('purchases')).toBe('Purchase Bill')
      expect(mapDocTypeToSeriesName('challans')).toBe('Challan')
      expect(formatBillWithActiveSeries('G0005', 'sales', seriesList)).toBe('G0005/26-27')
    })

    it('leaves already properly formatted bill numbers intact', () => {
      expect(formatBillWithActiveSeries('G0001/26-27', 'Sale Invoice', seriesList)).toBe('G0001/26-27')
      expect(formatBillWithActiveSeries('PB-0001-2026', 'Purchase Bill', seriesList)).toBe('PB-0001-2026')
    })
  })

  describe('Store-level Series Master Cascade', () => {
    it('updates all sales invoices, ledgers, and vouchers when Sale Invoice series is updated', async () => {
      // 1. Fetch current series
      const seriesRows: any = await list('series')
      const saleSeries = seriesRows.find((s: any) => s.doc === 'Sale Invoice')
      expect(saleSeries).toBeDefined()

      // 2. Update series with a new suffix: /26-27
      await update('series', saleSeries.id, {
        doc: 'Sale Invoice',
        prefix: 'G',
        suffix: '/26-27',
        nextNo: 10,
        padding: 4,
        fyReset: true,
        active: true
      })

      // 3. Check that sales bills now reflect prefix 'G' and suffix '/26-27'
      const sales: any = await list('sales')
      expect(sales.length).toBeGreaterThan(0)
      for (const sale of sales) {
        expect(sale.number || sale.invoiceNo).toContain('/26-27')
        expect((sale.number || sale.invoiceNo).startsWith('G')).toBe(true)
      }

      // 4. Check that related ledgers were updated to reference the new bill number
      const ledgers: any = await list('ledgers')
      const relatedLedger = ledgers.find((l: any) => (l.vNo || '').includes('/26-27'))
      expect(relatedLedger).toBeDefined()
    })

    it('updates purchase bills when Purchase Bill series suffix is updated', async () => {
      const seriesRows: any = await list('series')
      const purchaseSeries = seriesRows.find((s: any) => s.doc === 'Purchase Bill')
      expect(purchaseSeries).toBeDefined()

      await update('series', purchaseSeries.id, {
        doc: 'Purchase Bill',
        prefix: 'PB-',
        suffix: '/ASSAM-26',
        nextNo: 5,
        padding: 4,
        fyReset: true,
        active: true
      })

      const purchases: any = await list('purchases')
      expect(purchases.length).toBeGreaterThan(0)
      for (const p of purchases) {
        expect(p.number || p.invoiceNo).toContain('/ASSAM-26')
      }
    })
  })
})
