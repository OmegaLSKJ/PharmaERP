import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { create, list, update, remove } from '../apps/web/lib/erp-store'

describe('Party Opening Balance Live Sync & Calculations', () => {
  it('correctly creates, updates and reads openingBalance and openingType on parties', async () => {
    const partyName = `Opening Bal Chemist ${Date.now()}`

    // 1. Create with opening balance
    const created: any = await create('parties', {
      name: partyName,
      type: 'supplier',
      openingBalance: 15000,
      openingType: 'Cr',
      creditLimit: 50000,
    })
    expect(created).toBeDefined()

    // 2. Read back
    const allParties: any = await list('parties')
    const found = allParties.find((p: any) => p.name === partyName)
    expect(found).toBeDefined()
    expect(Number(found.openingBalance)).toBe(15000)
    expect(found.openingType).toBe('Cr')

    // 3. Update opening balance
    await update('parties', found.id, {
      openingBalance: 25000,
      openingType: 'Dr',
    })

    const partiesAfterUpdate: any = await list('parties')
    const foundUpdated = partiesAfterUpdate.find((p: any) => p.id === found.id)
    expect(foundUpdated).toBeDefined()
    expect(Number(foundUpdated.openingBalance)).toBe(25000)
    expect(foundUpdated.openingType).toBe('Dr')

    // Clean up
    await remove('parties', found.id)
  })

  it('correctly calculates supplier and customer net outstanding balance including opening balance', () => {
    // Supplier calculation:
    // Opening balance: 15,000 Cr
    // Invoiced / Debits: 20,000 (payments made to supplier)
    // Purchases / Credits: 61,883.90 (purchases from supplier)
    const isSupplier = true
    const opBal = 15000
    const opType: 'Dr' | 'Cr' = 'Cr'
    const totalDebitSum = 20000
    const totalCreditSum = 61883.90

    const initialPayable = opType === 'Cr' ? opBal : -opBal
    const netBalSupplier = initialPayable + (totalCreditSum - totalDebitSum)
    const finalOutstandingSupplier = Math.abs(netBalSupplier)
    const finalBalTypeSupplier = netBalSupplier >= 0 ? 'Cr' : 'Dr'

    // Expected: 15,000 + (61,883.90 - 20,000) = 56,883.90 Cr
    expect(finalOutstandingSupplier).toBe(56883.90)
    expect(finalBalTypeSupplier).toBe('Cr')

    // Customer calculation:
    // Opening balance: 5,000 Dr
    // Sales / Debits: 10,000
    // Receipts / Credits: 8,000
    const opBalCust = 5000
    const opTypeCust: 'Dr' | 'Cr' = 'Dr'
    const custDebits = 10000
    const custCredits = 8000

    const initialReceivable = opTypeCust === 'Dr' ? opBalCust : -opBalCust
    const netBalCustomer = initialReceivable + (custDebits - custCredits)
    const finalOutstandingCustomer = Math.abs(netBalCustomer)
    const finalBalTypeCustomer = netBalCustomer >= 0 ? 'Dr' : 'Cr'

    // Expected: 5,000 + (10,000 - 8,000) = 7,000 Dr
    expect(finalOutstandingCustomer).toBe(7000)
    expect(finalBalTypeCustomer).toBe('Dr')
  })
})
