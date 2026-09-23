import { describe, expect, it } from 'vitest'
import { calculateInvoice } from '../src/lib/invoiceCalculations'

describe('Auto-rate resolution from MRP and batch sale rates', () => {
  it('auto-resolves rate from batch sale price when item sale rate is 0', () => {
    const item = {
      name: 'GASCOOL JR SUSP',
      saleRate: 0,
      mrp: 120,
      batches: [{ batch: 'sol1868', stock: 11, salePrice: 111.62, mrp: 120 }]
    }
    const b = item.batches[0]
    const batchMrp = Number(b.mrp || item.mrp || 0)
    const batchSaleRate = Number(b.salePrice ?? (b as any).saleRate ?? (b as any).rate ?? item.saleRate ?? 0)
    const autoRate = batchSaleRate > 0 ? batchSaleRate : batchMrp

    expect(autoRate).toBe(111.62)
    const calculated = calculateInvoice([{ qty: 10, rate: autoRate, discount: 0, gstRate: 5 }])
    expect(calculated.subtotal).toBe(1116.2)
  })

  it('auto-resolves rate directly from MRP when batch sale price and item sale rate are both 0 or missing', () => {
    const item = {
      name: 'MEDICINE XYZ',
      saleRate: 0,
      mrp: 150,
      batches: [{ batch: 'B101', stock: 20, salePrice: 0, mrp: 150 }]
    }
    const b = item.batches[0]
    const batchMrp = Number(b.mrp || item.mrp || 0)
    const batchSaleRate = Number(b.salePrice ?? (b as any).saleRate ?? (b as any).rate ?? item.saleRate ?? 0)
    const autoRate = batchSaleRate > 0 ? batchSaleRate : batchMrp

    expect(autoRate).toBe(150)
    const calculated = calculateInvoice([{ qty: 2, rate: autoRate, discount: 0, gstRate: 12 }])
    expect(calculated.subtotal).toBe(300)
  })

  it('handles row line rate fallback to MRP when quantity is updated and rate was empty/0', () => {
    const row = {
      id: 'row-1',
      qty: 1,
      free: 0,
      rate: 0,
      mrp: 120,
      disc: 0,
      gst: 5,
      amount: 0
    }

    const field: 'qty' | 'free' | 'rate' | 'disc' = 'qty'
    const value = 10
    const next = { ...row, [field]: value }
    if (field !== 'rate' && (Number(next.rate) || 0) <= 0 && (Number(next.mrp) || 0) > 0) {
      next.rate = Number(next.mrp)
    }

    const invoice = calculateInvoice([{
      qty: next.qty,
      rate: next.rate,
      discount: next.disc,
      gstRate: next.gst
    }])
    next.amount = invoice.lines[0].total

    expect(next.rate).toBe(120)
    expect(next.amount).toBe(1260) // 10 * 120 + 5% GST = 1200 + 60 = 1260
  })
})
