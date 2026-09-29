import { describe, expect, it } from 'vitest'
import {
  calculateRateMargins,
  formatDisplayExpiry,
} from '../src/components/transactions/ActiveProductDetailPanel'

describe('ActiveProductDetailPanel logic & helper unit tests', () => {
  it('calculates rate margins correctly', () => {
    const margins = calculateRateMargins({
      mrp: 200,
      saleRate: 150,
      purchaseRate: 120,
      costPrice: 100,
    })

    // mrpVsSale: ((200 - 150) / 200) * 100 = 25%
    expect(margins.mrpVsSale).toBeCloseTo(25, 2)
    // mrpVsPurchase: ((200 - 120) / 200) * 100 = 40%
    expect(margins.mrpVsPurchase).toBeCloseTo(40, 2)
    // saleVsCost: ((150 - 100) / 150) * 100 = 33.33%
    expect(margins.saleVsCost).toBeCloseTo(33.333, 2)
  })

  it('handles zero or missing values safely in margin calculations', () => {
    const emptyMargins = calculateRateMargins({})
    expect(emptyMargins.mrpVsSale).toBeNull()
    expect(emptyMargins.mrpVsPurchase).toBeNull()
    expect(emptyMargins.saleVsCost).toBeNull()
  })

  it('formats various expiry date string structures', () => {
    expect(formatDisplayExpiry('2028-12')).toBe('Dec, 2028')
    expect(formatDisplayExpiry('2026-09-29')).toBe('Sep, 2026')
    expect(formatDisplayExpiry('Sep, 2026')).toBe('Sep, 2026')
    expect(formatDisplayExpiry('09/26')).toBe('09/26')
    expect(formatDisplayExpiry('')).toBe('—')
    expect(formatDisplayExpiry(undefined)).toBe('—')
  })
})
