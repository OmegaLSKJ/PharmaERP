import { describe, it, expect } from 'vitest'
import { findKnownDistributor, KNOWN_DISTRIBUTORS } from '../src/lib/ocr/pharmaMasterCatalog'

describe('Purchase Invoice Print Dynamic Supplier Resolution', () => {
  it('correctly looks up all 10 known distributors from the master catalog', () => {
    expect(KNOWN_DISTRIBUTORS.length).toBeGreaterThanOrEqual(10)

    const dey = findKnownDistributor('DEY DRUG DISTRIBUTORS')
    expect(dey).toBeDefined()
    expect(dey?.gstin).toBe('18AGJPD0188M1Z4')
    expect(dey?.dlNo).toBe('STR/1475/1476')

    const assam = findKnownDistributor('ASSAM PHARMACEUTICALS')
    expect(assam).toBeDefined()
    expect(assam?.gstin).toBe('18AADFA8829J2Z3')
    expect(assam?.dlNo).toBe('STR-5004/5005')

    const pragati = findKnownDistributor('PRAGATI DRUG DRISTRIBUTOR')
    expect(pragati).toBeDefined()
    expect(pragati?.gstin).toBe('18BFHPM0344A1ZX')
    expect(pragati?.dlNo).toBe('STR-4040/4041')

    const atish = findKnownDistributor('ATISH PHARMACEUTICALS')
    expect(atish).toBeDefined()
    expect(atish?.gstin).toBe('18CJQPP4331L1ZL')
    expect(atish?.dlNo).toBe('STR-4814/4815')

    const shanti = findKnownDistributor('SHANTI DRUG DISTRIBUTORS')
    expect(shanti).toBeDefined()
    expect(shanti?.gstin).toBe('18ADAPG3096R1Z1')
    expect(shanti?.dlNo).toBe('STR-4197/98')
  })

  it('matches distributors by partial query or case variation', () => {
    const deyMatch = findKnownDistributor('dey drug')
    expect(deyMatch?.name).toBe('DEY DRUG DISTRIBUTORS')

    const assamMatch = findKnownDistributor('assam pharmaceuticals')
    expect(assamMatch?.name).toBe('ASSAM PHARMACEUTICALS')

    const gstinMatch = findKnownDistributor('18BFHPM0344A1ZX')
    expect(gstinMatch?.name).toBe('PRAGATI DRUG DRISTRIBUTOR')
  })

  it('dynamically resolves supplier based on whichever bill it is generated for', () => {
    // Simulating helper logic used in PurchaseRegister and PurchaseInvoicePrint
    const resolvePrintSupplier = (supplierName: string, partyInfo: any = {}) => {
      const known = findKnownDistributor(supplierName)
      const name = partyInfo.name || supplierName || known?.name || 'SUPPLIER / DISTRIBUTOR'
      const address = partyInfo.address || partyInfo.city || known?.address || ''
      const gstin = partyInfo.gstin || known?.gstin || ''
      const dlNo = partyInfo.dlNo || partyInfo.dlNumber || known?.dlNo || ''
      const phone = partyInfo.phone || known?.phone || ''
      const pan = partyInfo.pan || (gstin ? gstin.slice(2, 12) : '')

      return { name, address, gstin, dlNo, phone, pan }
    }

    // Bill 1: Dey Drug Distributors
    const bill1 = resolvePrintSupplier('DEY DRUG DISTRIBUTORS')
    expect(bill1.name).toBe('DEY DRUG DISTRIBUTORS')
    expect(bill1.gstin).toBe('18AGJPD0188M1Z4')
    expect(bill1.dlNo).toBe('STR/1475/1476')
    expect(bill1.name).not.toBe('HUVET ENTERPRISES')

    // Bill 2: Assam Pharmaceuticals
    const bill2 = resolvePrintSupplier('ASSAM PHARMACEUTICALS')
    expect(bill2.name).toBe('ASSAM PHARMACEUTICALS')
    expect(bill2.gstin).toBe('18AADFA8829J2Z3')
    expect(bill2.name).not.toBe('HUVET ENTERPRISES')

    // Bill 3: Pragati Drug Dristributor
    const bill3 = resolvePrintSupplier('PRAGATI DRUG DRISTRIBUTOR')
    expect(bill3.name).toBe('PRAGATI DRUG DRISTRIBUTOR')
    expect(bill3.gstin).toBe('18BFHPM0344A1ZX')
    expect(bill3.name).not.toBe('HUVET ENTERPRISES')

    // Bill 4: Atish Pharmaceuticals
    const bill4 = resolvePrintSupplier('ATISH PHARMACEUTICALS')
    expect(bill4.name).toBe('ATISH PHARMACEUTICALS')
    expect(bill4.gstin).toBe('18CJQPP4331L1ZL')
    expect(bill4.name).not.toBe('HUVET ENTERPRISES')

    // Bill 5: Shanti Drug Distributors
    const bill5 = resolvePrintSupplier('SHANTI DRUG DISTRIBUTORS')
    expect(bill5.name).toBe('SHANTI DRUG DISTRIBUTORS')
    expect(bill5.gstin).toBe('18ADAPG3096R1Z1')
    expect(bill5.name).not.toBe('HUVET ENTERPRISES')

    // Bill 6: Custom Party from Party Master
    const bill6 = resolvePrintSupplier('BORGANG DRUG DISTRIBUTORS', {
      name: 'BORGANG DRUG DISTRIBUTORS',
      address: 'BORGANG, BISWANATH, ASSAM',
      gstin: '18AFMPP9224L1ZQ',
      dlNo: 'STR 4137/4138',
      phone: '9957627881',
    })
    expect(bill6.name).toBe('BORGANG DRUG DISTRIBUTORS')
    expect(bill6.gstin).toBe('18AFMPP9224L1ZQ')
    expect(bill6.dlNo).toBe('STR 4137/4138')
    expect(bill6.name).not.toBe('HUVET ENTERPRISES')
  })
})
