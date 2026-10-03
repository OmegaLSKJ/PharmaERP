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

  describe('Strict 9 Document Numbering and Consistent Ordering', () => {
    it('creates bills with exact series numbering matching Series Master screenshot', async () => {
      // 1. Reset Series Master to exact user screenshot specifications
      const seriesConfigs = [
        { doc: 'Challan', prefix: 'CH-', nextNo: 1, padding: 4 },
        { doc: 'Credit Note', prefix: 'CN-', nextNo: 1, padding: 3 },
        { doc: 'Debit Note', prefix: 'DN-', nextNo: 1, padding: 3 },
        { doc: 'Purchase Bill', prefix: 'PB-', nextNo: 1, padding: 4 },
        { doc: 'Purchase Order', prefix: 'PO-', nextNo: 1, padding: 3 },
        { doc: 'Purchase Return', prefix: 'PR-', nextNo: 1, padding: 3 },
        { doc: 'Sale Invoice', prefix: 'G-', nextNo: 1940, padding: 4 },
        { doc: 'Sale Return', prefix: 'SR-', nextNo: 1, padding: 3 },
        { doc: 'Sales Order', prefix: 'SO-', nextNo: 1, padding: 3 },
      ]

      const currentSeries: any = await list('series')
      for (const cfg of seriesConfigs) {
        const found = currentSeries.find((s: any) => s.doc.toLowerCase() === cfg.doc.toLowerCase())
        if (found) {
          await update('series', found.id, {
            ...found,
            prefix: cfg.prefix,
            suffix: '',
            nextNo: cfg.nextNo,
            padding: cfg.padding,
            active: true
          })
        }
      }

      // 2. Test Sale Invoices strictly starts at G-1940, then G-1941
      const sale1: any = await create('sales', { party: 'Test Pharmacy', lines: [{ name: 'Paracetamol', qty: 10, rate: 50 }] })
      expect(sale1.id || sale1.invoiceNo || sale1.number).toBe('G-1940')

      const sale2: any = await create('sales', { party: 'Test Pharmacy 2', lines: [{ name: 'Amoxicillin', qty: 5, rate: 100 }] })
      expect(sale2.id || sale2.invoiceNo || sale2.number).toBe('G-1941')

      // 3. Test Purchase Bill strictly starts at PB-0001
      const pb1: any = await create('purchases', { party: 'Sun Pharma', lines: [{ name: 'Paracetamol', qty: 100, rate: 30 }] })
      expect(pb1.id || pb1.invoiceNo || pb1.number).toBe('PB-0001')

      // 4. Test Challan strictly starts at CH-0001
      const ch1: any = await create('challans', { party: 'City Hospital', lines: [{ name: 'Paracetamol', qty: 20, rate: 50 }] })
      expect(ch1.id || ch1.number).toBe('CH-0001')

      // 5. Test Sales Order starts at SO-001
      const so1: any = await create('orders', { party: 'City Hospital', type: 'Sale', items: 2, total: 1000 })
      expect(so1.orderNo || so1.number).toBe('SO-001')

      // 6. Test Purchase Order starts at PO-001
      const po1: any = await create('orders', { party: 'Sun Pharma', type: 'Purchase', items: 5, total: 5000 })
      expect(po1.orderNo || po1.number).toBe('PO-001')

      // 7. Test Credit Note starts at CN-001
      const cn1: any = await create('credit-notes', { party: 'City Hospital', total: 200 })
      expect(cn1.id || cn1.number).toBe('CN-001')

      // 8. Test Debit Note starts at DN-001
      const dn1: any = await create('debit-notes', { party: 'Sun Pharma', total: 300 })
      expect(dn1.id || dn1.number).toBe('DN-001')

      // 9. Test Sale Return starts at SR-001
      const sr1: any = await create('sale-returns', { party: 'City Hospital', total: 150 })
      expect(sr1.number || sr1.returnNo || sr1.id).toBe('SR-001')

      // 10. Test Purchase Return starts at PR-001
      const pr1: any = await create('purchase-returns', { party: 'Sun Pharma', total: 250 })
      expect(pr1.number || pr1.returnNo || pr1.id).toBe('PR-001')
    })

    it('returns lists sorted strictly in descending order throughout the system', async () => {
      const sales: any = await list('sales')
      expect(sales.length).toBeGreaterThan(1)
      for (let i = 0; i < sales.length - 1; i++) {
        const curr = sales[i]
        const next = sales[i + 1]
        const dateA = curr.date || curr.invoice_date || ''
        const dateB = next.date || next.invoice_date || ''
        if (dateA === dateB) {
          const seqA = extractDocSequence(curr.number || curr.invoiceNo || curr.id).sequence
          const seqB = extractDocSequence(next.number || next.invoiceNo || next.id).sequence
          expect(seqA).toBeGreaterThanOrEqual(seqB)
        } else {
          expect(dateA >= dateB).toBe(true)
        }
      }
    })
  })
})

