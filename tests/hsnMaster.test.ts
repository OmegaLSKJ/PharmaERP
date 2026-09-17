import { describe, it, expect } from 'vitest'
import defaultHsnMaster from '../src/data/hsnMasterData.json'

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
})
