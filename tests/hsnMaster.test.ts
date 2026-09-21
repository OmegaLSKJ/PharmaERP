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

  it('infers statutory HSN codes and GST rates based on pharma classifications', async () => {
    const { inferHsnForItem } = await import('../src/lib/hsnUtils')

    // Medicated soap -> 3401, 18%
    expect(inferHsnForItem('KETOCONAZOLE SOAP 75GM')).toEqual({ code: '3401', gstRate: 18 })
    expect(inferHsnForItem('CETAPHIL GENTLE SKIN CLEANSER')).toEqual({ code: '3401', gstRate: 18 })

    // Food preparations & nutraceuticals -> 2106, 18%
    expect(inferHsnForItem('PROTINEX CHOCOLATE POWDER 250GM')).toEqual({ code: '2106', gstRate: 18 })
    expect(inferHsnForItem('GLUCON-D INSTANT ENERGY 500GM')).toEqual({ code: '2106', gstRate: 18 })

    // Vaccines & biologicals -> 3002, 5%
    expect(inferHsnForItem('TETANUS TOXOID VACCINE 0.5ML')).toEqual({ code: '3002', gstRate: 5 })
    expect(inferHsnForItem('RABIES VACCINE IP 2.5IU')).toEqual({ code: '3002', gstRate: 5 })

    // Medical devices / Syringes -> 9018, 12%
    expect(inferHsnForItem('DISPO VAN SYRINGE 2ML WITH NEEDLE')).toEqual({ code: '9018', gstRate: 12 })
    expect(inferHsnForItem('IV CANNULA 20G')).toEqual({ code: '9018', gstRate: 12 })

    // Bandages & dressings -> 3005, 5%
    expect(inferHsnForItem('COTTON ROLL ABSORBENT 100GM')).toEqual({ code: '3005', gstRate: 5 })
    expect(inferHsnForItem('CREPE BANDAGE 15CM')).toEqual({ code: '3005', gstRate: 5 })

    // Standard medicaments formulation fallback -> 3004, 5%
    expect(inferHsnForItem('PARACETAMOL 650MG TABLET')).toEqual({ code: '3004', gstRate: 5 })
    expect(inferHsnForItem('AZITHROMYCIN 500MG')).toEqual({ code: '3004', gstRate: 5 })
  })

  it('verifies 100% of all items in catalog have valid HSN and GST rate mapped', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const raw = fs.readFileSync(path.resolve('apps/web/lib/mock-stock-data.json'), 'utf8')
    const parsed = JSON.parse(raw)
    const items = parsed.items || []

    expect(items.length).toBeGreaterThan(11000)

    let missingCount = 0
    for (const item of items) {
      if (!item.hsn || String(item.hsn).trim() === '') {
        missingCount++
      }
      expect(item.gstRate).toBeDefined()
      expect(typeof item.gstRate).toBe('number')
    }

    expect(missingCount).toBe(0)
  })
})


