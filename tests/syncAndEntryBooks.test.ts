import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { create, list } from '../apps/web/lib/erp-store'

describe('Inventory & Ledger Synchronization and Entry Books', () => {
  it('auto-deducts stock upon sale creation', async () => {
    const itemsBefore: any = await list('items')
    const item = itemsBefore.find((i: any) => i.batches && i.batches.length > 0) || itemsBefore[0]
    expect(item).toBeDefined()

    const initialStock = Number(item.stock || 0)
    const batch = item.batches?.[0]
    const initialBatchStock = batch ? Number(batch.stock || 0) : 0
    const saleQty = 5

    // Create a sale
    const sale = await create('sales', {
      party: 'Apollo Pharmacy',
      customer: 'Apollo Pharmacy',
      date: '2026-09-16',
      lines: [
        {
          itemId: item.id,
          itemName: item.name,
          batch: batch?.batch,
          quantity: saleQty,
          rate: 100,
          amount: 500,
        },
      ],
      total: 500,
    })

    expect(sale).toBeDefined()

    // Verify stock is deducted
    const itemsAfter: any = await list('items')
    const updatedItem = itemsAfter.find((i: any) => i.id === item.id)
    expect(Number(updatedItem.stock)).toBe(initialStock - saleQty)

    if (batch) {
      const updatedBatch = updatedItem.batches?.find((b: any) => b.batch === batch.batch)
      expect(Number(updatedBatch.stock)).toBe(initialBatchStock - saleQty)
    }
  })

  it('auto-adds stock upon purchase creation', async () => {
    const itemsBefore: any = await list('items')
    const item = itemsBefore.find((i: any) => i.batches && i.batches.length > 0) || itemsBefore[0]
    expect(item).toBeDefined()

    const initialStock = Number(item.stock || 0)
    const batch = item.batches?.[0]
    const initialBatchStock = batch ? Number(batch.stock || 0) : 0
    const purchaseQty = 15

    // Create a purchase bill with MRP and Sale Price
    const purchase = await create('purchases', {
      party: 'Cipla Ltd',
      supplier: 'Cipla Ltd',
      date: '2026-09-16',
      lines: [
        {
          itemId: item.id,
          itemName: item.name,
          batch: batch?.batch,
          quantity: purchaseQty,
          rate: 80,
          saleRate: 110,
          mrp: 150,
          amount: 1200,
        },
      ],
      total: 1200,
    })

    expect(purchase).toBeDefined()

    // Verify stock is incremented and MRP/saleRate are synchronized
    const itemsAfter: any = await list('items')
    const updatedItem = itemsAfter.find((i: any) => i.id === item.id)
    expect(Number(updatedItem.stock)).toBe(initialStock + purchaseQty)
    expect(Number(updatedItem.mrp)).toBe(150)
    expect(Number(updatedItem.saleRate)).toBe(110)

    if (batch) {
      const updatedBatch = updatedItem.batches?.find((b: any) => b.batch === batch.batch)
      expect(Number(updatedBatch.stock)).toBe(initialBatchStock + purchaseQty)
      expect(Number(updatedBatch.mrp)).toBe(150)
      expect(Number(updatedBatch.saleRate)).toBe(110)
    }
  })

  it('reverses stock upon credit note (sale return)', async () => {
    const itemsBefore: any = await list('items')
    const item = itemsBefore[0]
    const initialStock = Number(item.stock || 0)
    const returnQty = 3

    // Customer returns goods -> stock increases
    const note = await create('credit-notes', {
      party: 'Apollo Pharmacy',
      date: '2026-09-16',
      lines: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: returnQty,
          rate: 100,
          amount: 300,
        },
      ],
      total: 300,
    })

    expect(note).toBeDefined()

    const itemsAfter: any = await list('items')
    const updatedItem = itemsAfter.find((i: any) => i.id === item.id)
    expect(Number(updatedItem.stock)).toBe(initialStock + returnQty)
  })

  it('reverses stock upon debit note (purchase return)', async () => {
    const itemsBefore: any = await list('items')
    const item = itemsBefore.find((i: any) => Number(i.stock) >= 10) || itemsBefore[0]
    const initialStock = Number(item.stock || 0)
    const returnQty = Math.min(initialStock, 3)

    // Goods returned to supplier -> stock decreases
    const note = await create('debit-notes', {
      party: 'Cipla Ltd',
      date: '2026-09-16',
      lines: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: returnQty,
          rate: 80,
          amount: 240,
        },
      ],
      total: 240,
    })

    expect(note).toBeDefined()

    const itemsAfter: any = await list('items')
    const updatedItem = itemsAfter.find((i: any) => i.id === item.id)
    expect(Number(updatedItem.stock)).toBe(initialStock - returnQty)
  })

  it('creates ledger entries and balances on voucher creation', async () => {
    const partyName = 'Apollo Pharmacy'
    const partiesBefore: any = await list('parties')
    const partyBefore = partiesBefore.find((p: any) => p.name === partyName)
    const initialBalance = Number(partyBefore?.balance || 0)

    const doc = await create('vouchers', {
      type: 'Journal',
      date: '2026-09-16',
      lines: [
        { ledger: partyName, debit: 2500, credit: 0, narration: 'Debit adjustment' },
        { ledger: 'Cash Account', debit: 0, credit: 2500, narration: 'Cash credit' },
      ],
    })

    expect(doc).toBeDefined()

    // Check ledgers
    const ledgers: any = await list('ledgers', partyName)
    const matched = ledgers.find((l: any) => l.vNo === doc.number && l.debit === 2500)
    expect(matched).toBeDefined()
    expect(matched.party).toBe(partyName)

    // Check updated party balance
    const partiesAfter: any = await list('parties')
    const partyAfter = partiesAfter.find((p: any) => p.name === partyName)
    expect(Number(partyAfter.balance)).toBe(initialBalance + 2500)
  })

  it('provides all 4 new Entry Books correctly', async () => {
    const itemDayBook: any = await list('item-day-book')
    expect(Array.isArray(itemDayBook)).toBe(true)
    expect(itemDayBook.length).toBeGreaterThan(0)

    const selectedBook: any = await list('selected-book')
    expect(Array.isArray(selectedBook)).toBe(true)

    const creditNoteBook: any = await list('credit-note-book')
    expect(Array.isArray(creditNoteBook)).toBe(true)
    expect(creditNoteBook.length).toBeGreaterThan(0)

    const debitNoteBook: any = await list('debit-note-book')
    expect(Array.isArray(debitNoteBook)).toBe(true)
    expect(debitNoteBook.length).toBeGreaterThan(0)
  })
})
