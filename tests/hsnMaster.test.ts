import { describe, it, expect } from 'vitest'
import defaultHsnMaster from '../src/data/hsnMasterData.json'
import { getGstRateForHsn, getHsnDetails, getAllHsnCodes } from '../src/lib/hsnUtils'

describe('HSN Master Data - 3004 Codes', () => {
  it('verifies all HSN codes starting with 3004 have GST rate set to 5%', () => {
    const codes3004 = defaultHsnMaster.filter((item: any) =>
      String(item.code).startsWith('3004')
    )

    expect(codes3004.length).toBe(95)

    codes3004.forEach((item: any) => {
      expect(item.gstRate).toBe(5)
      expect(item.gst_rate).toBe(5)
    })
  })

  it('maps GST rate properly across all HSN codes using getGstRateForHsn', () => {
    // 3004 medicaments -> 5%
    expect(getGstRateForHsn('3004')).toBe(5)
    expect(getGstRateForHsn('30049011')).toBe(5)
    expect(getGstRateForHsn('30041010')).toBe(5)
    expect(getGstRateForHsn('30049099')).toBe(5)

    // Animal feeds 2309 -> 0%
    expect(getGstRateForHsn('2309')).toBe(0)
    expect(getGstRateForHsn('23099020')).toBe(0)

    // Food preparations 2106 -> 18%
    expect(getGstRateForHsn('2106')).toBe(18)

    // Truncated *NOT -> 12%
    expect(getGstRateForHsn('*NOT')).toBe(12)
    expect(getGstRateForHsn('*NOT APPLI')).toBe(12)

    // Unknown code defaults to 5%
    expect(getGstRateForHsn('UNKNOWN_CODE')).toBe(5)
  })

  it('retrieves HSN master details correctly', () => {
    const list = getAllHsnCodes()
    expect(list.length).toBe(197)

    const details = getHsnDetails('30049011')
    expect(details).toBeDefined()
    expect(details?.gstRate).toBe(5)
  })
})

