import { describe, expect, it } from 'vitest'
import { calculateInvoice } from '../src/lib/invoiceCalculations'

describe('calculateInvoice', () => {
  it('applies discount before GST and records rounding separately', () => {
    expect(calculateInvoice([{ qty: 3, rate: 99.5, discount: 10, gstRate: 18 }])).toEqual({
      lines: [{ gross: 298.5, discount: 29.85, taxable: 268.65, tax: 48.36, total: 317.01 }],
      subtotal: 298.5, discountTotal: 29.85, taxTotal: 48.36, unroundedTotal: 317.01, roundingAdjustment: -0.01, grandTotal: 317,
    })
  })
  it('rejects invalid percentages and quantities', () => {
    expect(() => calculateInvoice([{ qty: 0, rate: 10 }])).toThrow(/Quantity/)
    expect(() => calculateInvoice([{ qty: 1, rate: 10, discount: 101 }])).toThrow(/between 0 and 100/)
  })
})
