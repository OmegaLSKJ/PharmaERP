import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { create, list, update, remove } from '../apps/web/lib/erp-store'

describe('Item Manual Stock and Batch Persistence', () => {
  it('creates an item with manual stock without explicit batches and synthesizes a DEFAULT batch', async () => {
    const itemName = `GASCOOL JR SUSP TEST ${Date.now()}`
    const itemCode = `ITM-TEST-${Math.floor(100000 + Math.random() * 900000)}`

    const created: any = await create('items', {
      code: itemCode,
      name: itemName,
      packing: '100ML',
      manufacturer: 'Abbott',
      stock: 45,
      mrp: 120,
      saleRate: 95,
      purchaseRate: 80
    })

    expect(created).toBeDefined()
    expect(Number(created.stock)).toBe(45)
    expect(created.batchCount).toBe(1)
    expect(created.batches?.[0]?.batch).toBe('DEFAULT')
    expect(Number(created.batches?.[0]?.stock)).toBe(45)

    // Verify retrieval via list
    const allItems: any = await list('items')
    const found = allItems.find((i: any) => i.code === itemCode || i.id === created.id)
    expect(found).toBeDefined()
    expect(Number(found.stock)).toBe(45)
    expect(found.batches.length).toBeGreaterThanOrEqual(1)

    // Clean up
    await remove('items', created.id)
  })

  it('creates an item with explicit batches and updates its stock', async () => {
    const itemName = `MULTIBATCH SYP ${Date.now()}`
    const itemCode = `ITM-MB-${Math.floor(100000 + Math.random() * 900000)}`

    const batch1 = {
      batch: 'BATCH-A1',
      expiry: '2027-06-30',
      stock: 30,
      mrp: 150,
      purchasePrice: 100,
      salePrice: 120,
      rackNumber: 'RACK-1'
    }
    const batch2 = {
      batch: 'BATCH-A2',
      expiry: '2028-01-31',
      stock: 20,
      mrp: 150,
      purchasePrice: 100,
      salePrice: 120,
      rackNumber: 'RACK-2'
    }

    const created: any = await create('items', {
      code: itemCode,
      name: itemName,
      packing: '200ML',
      stock: 50,
      mrp: 150,
      saleRate: 120,
      purchaseRate: 100,
      batches: [batch1, batch2],
      batchCount: 2
    })

    expect(created).toBeDefined()
    expect(Number(created.stock)).toBe(50)
    expect(created.batchCount).toBe(2)

    // Update item stock directly
    const updated: any = await update('items', created.id, {
      stock: 80,
      batches: [
        { ...batch1, stock: 50 },
        { ...batch2, stock: 30 }
      ]
    })

    expect(Number(updated.stock)).toBe(80)

    // Verify in list
    const allItems: any = await list('items')
    const found = allItems.find((i: any) => i.id === created.id)
    expect(found).toBeDefined()
    expect(Number(found.stock)).toBe(80)

    // Clean up
    await remove('items', created.id)
  })

  it('creates an item-batch with initial stock and reflects in batch list', async () => {
    const itemName = `BATCH DIRECT TEST ${Date.now()}`
    const createdItem: any = await create('items', {
      name: itemName,
      stock: 0,
      mrp: 200,
      saleRate: 160,
      purchaseRate: 140
    })

    const createdBatch: any = await create('item-batches', {
      itemId: createdItem.id,
      batchNumber: 'DIR-999',
      expiryOn: '2029-05-31',
      mrp: 200,
      costPrice: 140,
      purchasePrice: 140,
      salePrice: 160,
      stock: 65
    })

    expect(createdBatch).toBeDefined()
    expect(Number(createdBatch.stock)).toBe(65)

    // Clean up
    await remove('items', createdItem.id)
  })
})
