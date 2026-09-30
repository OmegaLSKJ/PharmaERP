import { describe, it, expect } from 'vitest'
import { aggregateChartData, getWeekStartAndLabel, getFinancialYear, parseDateSafe } from '../src/lib/chartUtils'

describe('chartUtils date bucketing and live aggregation', () => {
  const samplePoints = [
    { date: '2026-08-10', value: 15000, sale: 15000, purchase: 10000 },
    { date: '2026-08-15', value: 25000, sale: 25000, purchase: 18000 },
    { date: '2026-09-02', value: 38708, sale: 38708, purchase: 19354 },
    { date: '2026-09-18', value: 45000, sale: 45000, purchase: 30000 },
    { date: '2027-01-10', value: 12000, sale: 12000, purchase: 8000 },
  ]

  it('aggregates correctly by day', () => {
    const daily = aggregateChartData(samplePoints, 'daily')
    expect(daily.length).toBe(5)
    expect(daily[0].key).toBe('2026-08-10')
    expect(daily[0].value).toBe(15000)
    expect(daily[2].key).toBe('2026-09-02')
    expect(daily[2].value).toBe(38708)
  })

  it('aggregates correctly by week', () => {
    const weekly = aggregateChartData(samplePoints, 'weekly')
    expect(weekly.length).toBeGreaterThan(0)
    for (const pt of weekly) {
      expect(pt.key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(pt.name).toContain('-')
      expect(pt.value).toBeGreaterThan(0)
    }
  })

  it('aggregates correctly by month', () => {
    const monthly = aggregateChartData(samplePoints, 'monthly')
    expect(monthly.length).toBe(3) // 2026-08, 2026-09, 2027-01
    expect(monthly[0].key).toBe('2026-08')
    expect(monthly[0].value).toBe(40000) // 15000 + 25000
    expect(monthly[1].key).toBe('2026-09')
    expect(monthly[1].value).toBe(83708) // 38708 + 45000
    expect(monthly[2].key).toBe('2027-01')
    expect(monthly[2].value).toBe(12000)
  })

  it('aggregates correctly by financial year', () => {
    const yearly = aggregateChartData(samplePoints, 'yearly')
    // All 2026-08, 2026-09, 2027-01 fall into FY 2026-27 (April 2026 - March 2027)
    expect(yearly.length).toBe(1)
    expect(yearly[0].key).toBe('FY-2026')
    expect(yearly[0].name).toBe('FY 26-27')
    expect(yearly[0].value).toBe(135708)
  })

  it('respects startDate and endDate filtering', () => {
    const filtered = aggregateChartData(samplePoints, 'monthly', {
      startDate: '2026-09-01',
      endDate: '2026-09-30'
    })
    expect(filtered.length).toBe(1)
    expect(filtered[0].key).toBe('2026-09')
    expect(filtered[0].value).toBe(83708)
  })

  it('handles dual metrics (sale and purchase)', () => {
    const result = aggregateChartData(samplePoints, 'monthly')
    const aug = result.find(r => r.key === '2026-08')
    expect(aug).toBeDefined()
    expect(aug?.sale).toBe(40000)
    expect(aug?.purchase).toBe(28000)
  })
})
