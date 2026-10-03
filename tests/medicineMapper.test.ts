import { describe, it, expect } from 'vitest'
import { matchMedicineToMaster, mapExtractedItemsToMaster, MasterItemOption } from '../src/lib/ocr/medicineMapper'
import { ExtractedLineItem } from '../src/lib/ocr/types'

describe('medicineMapper', () => {
  const masterCatalog: MasterItemOption[] = [
    { id: 'item-1', name: 'PAN 40MG TABLET', packing: '15 Tablets', hsn: '30049099', rate: 120, mrp: 155, gstRate: 12 },
    { id: 'item-2', name: 'MOXIKIND-CV 625 TABLET', packing: '10 Tablets', hsn: '30049099', rate: 165, mrp: 215, gstRate: 12 },
    { id: 'item-3', name: 'TELMA 40MG TABLET', packing: '10x10', hsn: '30049099', rate: 145, mrp: 210, gstRate: 12 },
    { id: 'item-4', name: 'AUGMENTIN 625 DUO TABLET', packing: '10 Tablets', hsn: '30049099', rate: 170, mrp: 223, gstRate: 12 },
    { id: 'item-5', name: 'AZITHRAL 500 TABLET', packing: '5 Tablets', hsn: '30049099', rate: 95, mrp: 130, gstRate: 12 }
  ]

  it('matches exact name with 100% score', () => {
    const res = matchMedicineToMaster('PAN 40MG TABLET', masterCatalog)
    expect(res.matchedItem?.id).toBe('item-1')
    expect(res.matchStatus).toBe('exact')
    expect(res.score).toBe(1.0)
  })

  it('matches slightly formatted or hyphenated medicine names', () => {
    const res = matchMedicineToMaster('MOXIKIND CV 625 TAB', masterCatalog)
    expect(res.matchedItem?.id).toBe('item-2')
    expect(res.matchStatus).toBe('exact') // or high
  })

  it('matches brand with minor OCR typo or dosage differences', () => {
    const res = matchMedicineToMaster('Augmentin 625 Tab', masterCatalog)
    expect(res.matchedItem?.id).toBe('item-4')
    expect(['exact', 'high']).toContain(res.matchStatus)
  })

  it('marks unknown products as unmapped with suggestions', () => {
    const res = matchMedicineToMaster('Unknown Herbal Balm 50g', masterCatalog)
    expect(res.matchStatus).toBe('unmapped')
  })

  it('maps array of extracted line items and enriches with master data', () => {
    const ocrItems: ExtractedLineItem[] = [
      {
        id: '1',
        itemName: 'PAN 40 TAB 15S',
        hsn: '',
        batch: 'PN9021',
        expiry: '09/27',
        qty: 20,
        freeQty: 0,
        purchaseRate: 98,
        mrp: 0,
        saleRate: 0,
        discount: 0,
        gstRate: 0,
        amount: 1960
      },
      {
        id: '2',
        itemName: 'TELMA 40MG',
        hsn: '',
        batch: 'TL401',
        expiry: '04/28',
        qty: 10,
        freeQty: 1,
        purchaseRate: 140,
        mrp: 0,
        saleRate: 0,
        discount: 0,
        gstRate: 0,
        amount: 1400
      }
    ]

    const mapped = mapExtractedItemsToMaster(ocrItems, masterCatalog)
    expect(mapped[0].mappedItemId).toBe('item-1')
    expect(mapped[0].mappedItemName).toBe('PAN 40MG TABLET')
    expect(mapped[0].hsn).toBe('30049099')
    expect(mapped[0].isConfirmed).toBe(true)

    expect(mapped[1].mappedItemId).toBe('item-3')
    expect(mapped[1].mappedItemName).toBe('TELMA 40MG TABLET')
    expect(mapped[1].isConfirmed).toBe(true)
  })

  it('disambiguates OCR character errors (optical 1, optical zero)', () => {
    const resAug = matchMedicineToMaster('AUGMENT1N 625 TAB', masterCatalog)
    expect(resAug.matchedItem?.id).toBe('item-4')

    const resPan = matchMedicineToMaster('PAN 40MG', masterCatalog)
    expect(resPan.matchedItem?.id).toBe('item-1')
  })

  it('matches phonetic variations (AZITRAL -> AZITHRAL)', () => {
    const res = matchMedicineToMaster('AZITRAL 500 TAB', masterCatalog)
    expect(res.matchedItem?.id).toBe('item-5')
  })

  it('penalizes strength mismatches so TELMA 20 does not map to TELMA 40', () => {
    const res = matchMedicineToMaster('TELMA 20MG TABLET', masterCatalog)
    // Catalog only has TELMA 40MG, so TELMA 20 should NOT be mapped as exact or high
    expect(res.matchStatus).not.toBe('exact')
    expect(res.score).toBeLessThan(0.40)
  })

  it('for purchases: extracts uploaded invoice info and adds as new medicine if not in master', () => {
    const newOcrItem: ExtractedLineItem = {
      id: 'new-1',
      itemName: 'GLIMEPIRIDE 2MG TAB',
      packing: '10x15',
      hsn: '30049080',
      batch: 'GLM-202',
      expiry: '05/29',
      qty: 50,
      freeQty: 5,
      purchaseRate: 45.5,
      mrp: 75.0,
      saleRate: 60.0,
      discount: 0,
      gstRate: 12,
      amount: 2275
    }

    const mapped = mapExtractedItemsToMaster([newOcrItem], masterCatalog, { mode: 'purchase' })
    expect(mapped[0].isNewMedicine).toBe(true)
    expect(mapped[0].matchStatus).toBe('new_item')
    expect(mapped[0].isConfirmed).toBe(true) // Ready to add to purchases as new medicine
    expect(mapped[0].itemName).toBe('GLIMEPIRIDE 2MG TAB')
    expect(mapped[0].packing).toBe('10x15')
    expect(mapped[0].hsn).toBe('30049080')
    expect(mapped[0].purchaseRate).toBe(45.5)
    expect(mapped[0].mrp).toBe(75.0)
    expect(mapped[0].saleRate).toBe(60.0)
    expect(mapped[0].gstRate).toBe(12)
    expect(mapped[0].amount).toBe(2275)
    expect(mapped[0].mappedItemId).toBeUndefined()
  })

  it('for sales: strictly maps only if present in all items list, rejecting unmapped items', () => {
    const items: ExtractedLineItem[] = [
      {
        id: 'sale-1',
        itemName: 'PAN 40MG TABLET', // in catalog
        hsn: '',
        batch: 'B1',
        expiry: '10/27',
        qty: 10,
        freeQty: 0,
        purchaseRate: 0,
        mrp: 0,
        saleRate: 0,
        discount: 0,
        gstRate: 0,
        amount: 0
      },
      {
        id: 'sale-2',
        itemName: 'BRAND NEW UNKNOWN MEDICINE 100MG', // NOT in catalog
        hsn: '30049099',
        batch: 'B2',
        expiry: '10/27',
        qty: 5,
        freeQty: 0,
        purchaseRate: 20,
        mrp: 40,
        saleRate: 35,
        discount: 0,
        gstRate: 12,
        amount: 175
      }
    ]

    const mapped = mapExtractedItemsToMaster(items, masterCatalog, { mode: 'sale' })
    // Item 1 is present in master catalog -> mapped and confirmed
    expect(mapped[0].mappedItemId).toBe('item-1')
    expect(mapped[0].isConfirmed).toBe(true)
    expect(mapped[0].isNewMedicine).toBe(false)

    // Item 2 is NOT present in master catalog -> strictly unmapped and unconfirmed
    expect(mapped[1].mappedItemId).toBeUndefined()
    expect(mapped[1].matchStatus).toBe('unmapped')
    expect(mapped[1].isConfirmed).toBe(false)
    expect(mapped[1].isNewMedicine).toBe(false)
  })
})


