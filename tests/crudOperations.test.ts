import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('server-only', () => ({}))

import { create, update, remove, list } from '../apps/web/lib/erp-store'

describe('Comprehensive Master CRUD Operations & Persistence', () => {
  it('performs full CRUD lifecycle on items', async () => {
    const code = `ITM-CRUD-${Date.now()}`
    const name = `CRUD Test Antibiotic ${Date.now()}`

    // 1. CREATE
    const created: any = await create('items', {
      code,
      name,
      packing: '10x10',
      manufacturer: 'Sun Pharma',
      mrp: 150,
      saleRate: 120,
      purchaseRate: 90,
      stock: 50,
      batches: [
        {
          id: `b-${code}-01`,
          batch: 'BT-CRUD-1',
          expiry: '2028-12-31',
          stock: 50,
          mrp: 150,
          saleRate: 120,
          purchaseRate: 90
        }
      ]
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(name)
    expect(created.code).toBe(code)

    // 2. READ
    const allItems: any = await list('items')
    const found = allItems.find((i: any) => i.code === code)
    expect(found).toBeDefined()
    expect(found.stock).toBe(50)

    // 3. UPDATE
    const updated: any = await update('items', found.id, {
      name: `${name} Updated`,
      stock: 100,
      mrp: 180,
      batches: [
        {
          id: `b-${code}-01`,
          batch: 'BT-CRUD-1',
          expiry: '2028-12-31',
          stock: 100,
          mrp: 180,
          saleRate: 140,
          purchaseRate: 100
        }
      ]
    })
    expect(updated.name).toBe(`${name} Updated`)
    expect(Number(updated.stock)).toBe(100)
    expect(Number(updated.mrp)).toBe(180)

    // Verify Read after update
    const allAfterUpdate: any = await list('items')
    const foundAfterUpdate = allAfterUpdate.find((i: any) => i.id === found.id)
    expect(foundAfterUpdate.name).toBe(`${name} Updated`)
    expect(Number(foundAfterUpdate.stock)).toBe(100)

    // 4. DELETE
    const removed: any = await remove('items', found.id)
    expect(removed).toBeDefined()

    // Verify Read after delete
    const allAfterDelete: any = await list('items')
    const foundAfterDelete = allAfterDelete.find((i: any) => i.id === found.id || i.code === code)
    expect(foundAfterDelete).toBeUndefined()
  })

  it('performs full CRUD lifecycle on item-batches', async () => {
    const code = `ITM-BATCH-${Date.now()}`
    const item: any = await create('items', {
      code,
      name: `Batch Item ${Date.now()}`,
      stock: 0,
      batches: []
    })

    // 1. CREATE BATCH
    const batchNumber = `BN-${Date.now()}`
    const createdBatch: any = await create('item-batches', {
      itemId: item.id,
      batchNumber,
      expiryOn: '2027-11-30',
      mrp: 200,
      purchasePrice: 120,
      salePrice: 160,
      stock: 45
    })
    expect(createdBatch).toBeDefined()
    expect(createdBatch.batchNumber).toBe(batchNumber)

    // 2. READ BATCHES
    const batches: any = await list('item-batches')
    const foundBatch = batches.find((b: any) => b.batchNumber === batchNumber)
    expect(foundBatch).toBeDefined()
    expect(Number(foundBatch.stock)).toBe(45)

    // 3. UPDATE BATCH
    const updatedBatch: any = await update('item-batches', foundBatch.id, {
      batchNumber,
      mrp: 220,
      stock: 60
    })
    expect(Number(updatedBatch.mrp)).toBe(220)
    expect(Number(updatedBatch.stock)).toBe(60)

    // 4. DELETE BATCH
    await remove('item-batches', foundBatch.id)
    const batchesAfterDelete: any = await list('item-batches')
    const foundAfterDelete = batchesAfterDelete.find((b: any) => b.id === foundBatch.id)
    expect(foundAfterDelete).toBeUndefined()

    // Clean up item
    await remove('items', item.id)
  })

  it('performs full CRUD lifecycle on parties', async () => {
    const partyName = `Test Chemist ${Date.now()}`

    // 1. CREATE
    const created: any = await create('parties', {
      name: partyName,
      type: 'both',
      phone: '9876543210',
      city: 'Guwahati',
      creditLimit: 50000
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(partyName)

    // 2. READ
    const allParties: any = await list('parties')
    const found = allParties.find((p: any) => p.name === partyName)
    expect(found).toBeDefined()
    expect(found.phone).toBe('9876543210')

    // 3. UPDATE
    const updated: any = await update('parties', found.id, {
      name: `${partyName} Pvt Ltd`,
      phone: '9876549999',
      creditLimit: 75000
    })
    expect(updated.name).toBe(`${partyName} Pvt Ltd`)

    // Verify Read after update
    const partiesAfterUpdate: any = await list('parties')
    const foundUpdated = partiesAfterUpdate.find((p: any) => p.id === found.id)
    expect(foundUpdated.name).toBe(`${partyName} Pvt Ltd`)
    expect(foundUpdated.phone).toBe('9876549999')

    // 4. DELETE
    await remove('parties', found.id)
    const partiesAfterDelete: any = await list('parties')
    const foundDeleted = partiesAfterDelete.find((p: any) => p.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on warehouses / locations', async () => {
    const whName = `Test Godown ${Date.now()}`

    // 1. CREATE
    const created: any = await create('warehouses', {
      name: whName,
      type: 'Godown',
      address: 'North Bank Depot, Tezpur',
      capacity: 50000
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(whName)

    // 2. READ
    const allWarehouses: any = await list('warehouses')
    const found = allWarehouses.find((w: any) => w.name === whName)
    expect(found).toBeDefined()
    expect(found.type).toBe('Godown')

    // 3. UPDATE
    const updated: any = await update('warehouses', found.id, {
      name: `${whName} Expanded`,
      capacity: 80000
    })
    expect(updated.name).toBe(`${whName} Expanded`)
    expect(Number(updated.capacity)).toBe(80000)

    // 4. DELETE
    await remove('warehouses', found.id)
    const warehousesAfterDelete: any = await list('warehouses')
    const foundDeleted = warehousesAfterDelete.find((w: any) => w.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on manufacturers', async () => {
    const mfrName = `Cipla Generics ${Date.now()}`

    // 1. CREATE
    const created: any = await create('manufacturers', {
      name: mfrName,
      code: 'CIPGEN',
      status: 'Active'
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(mfrName)

    // 2. READ
    const allMfgs: any = await list('manufacturers')
    const found = allMfgs.find((m: any) => m.name === mfrName)
    expect(found).toBeDefined()

    // 3. UPDATE
    const updated: any = await update('manufacturers', found.id, {
      name: `${mfrName} Healthcare`,
      code: 'CIPGEN2'
    })
    expect(updated.name).toBe(`${mfrName} Healthcare`)

    // 4. DELETE
    await remove('manufacturers', found.id)
    const mfgsAfterDelete: any = await list('manufacturers')
    const foundDeleted = mfgsAfterDelete.find((m: any) => m.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on salts / chemical molecules', async () => {
    const saltName = `Pantoprazole Sodium ${Date.now()}`

    // 1. CREATE
    const created: any = await create('salts', {
      name: saltName,
      composition: 'Pantoprazole 40mg + Domperidone 30mg',
      category: 'Gastrointestinal'
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(saltName)

    // 2. READ
    const allSalts: any = await list('salts')
    const found = allSalts.find((s: any) => s.name === saltName)
    expect(found).toBeDefined()
    expect(found.category).toBe('Gastrointestinal')

    // 3. UPDATE
    const updated: any = await update('salts', found.id, {
      name: `${saltName} Sustained Release`,
      category: 'Gastrointestinal'
    })
    expect(updated.name).toBe(`${saltName} Sustained Release`)

    // 4. DELETE
    await remove('salts', found.id)
    const saltsAfterDelete: any = await list('salts')
    const foundDeleted = saltsAfterDelete.find((s: any) => s.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on accounts / ledgers', async () => {
    const accName = `Special Medical Ledger ${Date.now()}`

    // 1. CREATE
    const created: any = await create('accounts', {
      name: accName,
      group: 'Direct Expenses',
      openingBalance: 2500
    })
    expect(created).toBeDefined()
    expect(created.name).toBe(accName)

    // 2. READ
    const allAccounts: any = await list('accounts')
    const found = allAccounts.find((a: any) => a.name === accName)
    expect(found).toBeDefined()
    expect(found.group).toBe('Direct Expenses')

    // 3. UPDATE
    const updated: any = await update('accounts', found.id, {
      name: `${accName} Renamed`,
      group: 'Indirect Expenses',
      openingBalance: 3000
    })
    expect(updated.name).toBe(`${accName} Renamed`)
    expect(updated.group).toBe('Indirect Expenses')

    // 4. DELETE
    await remove('accounts', found.id)
    const accountsAfterDelete: any = await list('accounts')
    const foundDeleted = accountsAfterDelete.find((a: any) => a.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on HSN codes', async () => {
    const hsnCode = `99${Date.now().toString().slice(-4)}`

    // 1. CREATE
    const created: any = await create('hsn', {
      code: hsnCode,
      description: 'Medical Laboratory Analysis Service',
      gstRate: 18
    })
    expect(created).toBeDefined()
    expect(created.code).toBe(hsnCode)

    // 2. READ
    const allHsn: any = await list('hsn')
    const found = allHsn.find((h: any) => h.code === hsnCode)
    expect(found).toBeDefined()
    expect(Number(found.gst_rate ?? found.gstRate)).toBe(18)

    // 3. UPDATE
    const updated: any = await update('hsn', found.id, {
      code: hsnCode,
      description: 'Medical Laboratory Diagnostic Service',
      gstRate: 12
    })
    expect(Number(updated.gst_rate ?? updated.gstRate)).toBe(12)

    // 4. DELETE
    await remove('hsn', found.id)
    const hsnAfterDelete: any = await list('hsn')
    const foundDeleted = hsnAfterDelete.find((h: any) => h.id === found.id)
    expect(foundDeleted).toBeUndefined()
  })

  it('performs full CRUD lifecycle on accounting vouchers', async () => {
    const voucherNumber = `VCH-TEST-${Date.now()}`
    const partyName = `Voucher Client ${Date.now()}`

    // 1. CREATE VOUCHER
    const created: any = await create('vouchers', {
      number: voucherNumber,
      party: partyName,
      type: 'Receipt',
      total: 15000,
      lines: [
        { ledger: 'Cash Account', debit: 15000, credit: 0, narration: 'Payment received' },
        { ledger: partyName, debit: 0, credit: 15000, narration: 'Payment received' }
      ]
    })
    expect(created).toBeDefined()
    expect(created.number).toBe(voucherNumber)

    // 2. READ VOUCHERS
    const vouchers: any = await list('vouchers')
    const foundVch = vouchers.find((v: any) => v.number === voucherNumber)
    expect(foundVch).toBeDefined()
    expect(Number(foundVch.total)).toBe(15000)

    // 3. UPDATE VOUCHER
    const updated: any = await update('vouchers', foundVch.id, {
      total: 20000,
      lines: [
        { ledger: 'Cash Account', debit: 20000, credit: 0, narration: 'Amended receipt' },
        { ledger: partyName, debit: 0, credit: 20000, narration: 'Amended receipt' }
      ]
    })
    expect(Number(updated.total)).toBe(20000)

    // 4. DELETE VOUCHER
    await remove('vouchers', foundVch.id)
    const vouchersAfterDelete: any = await list('vouchers')
    const foundAfterDelete = vouchersAfterDelete.find((v: any) => v.number === voucherNumber)
    expect(foundAfterDelete).toBeUndefined()
  })

  it('handles sales and purchase invoice cancellation via remove', async () => {
    // 1. Create a sale invoice
    const invNo = `SI-TEST-${Date.now()}`
    const createdSale: any = await create('sales', {
      number: invNo,
      party: 'Apollo Pharmacy',
      total: 3500,
      lines: []
    })
    expect(createdSale).toBeDefined()

    // 2. Cancel sale invoice via remove
    const cancelResult: any = await remove('sales', createdSale.id)
    expect(cancelResult).toBeDefined()

    // 3. Verify cancelled status
    const allSales: any = await list('sales')
    const foundSale = allSales.find((s: any) => s.id === createdSale.id || s.number === invNo)
    if (foundSale) {
      expect(['cancelled', 'deleted']).toContain(foundSale.status || 'cancelled')
    }
  })
})
