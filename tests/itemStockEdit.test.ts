import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { update, list, create } from '../apps/web/lib/erp-store'

describe('Item Stock Editing & Persistence', () => {
  it('allows user to edit the stock of an item with 0 batches', async () => {
    const items: any = await list('items')
    const targetItem = items.find((i: any) => i.code === 'AE972' || (!i.batches || i.batches.length === 0))
    expect(targetItem).toBeDefined()

    const newStock = 75
    const updated = await update('items', targetItem.id, {
      ...targetItem,
      stock: newStock,
      batches: [
        {
          id: `b-${targetItem.code}-default`,
          batch: 'DEFAULT',
          expiry: '2028-12-31',
          stock: newStock,
          mrp: 50,
          saleRate: 40,
          purchaseRate: 30
        }
      ]
    })

    expect(Number(updated.stock)).toBe(newStock)
    expect(updated.batches.length).toBe(1)
    expect(Number(updated.batches[0].stock)).toBe(newStock)

    // Verify it is reflected when listing items
    const itemsAfter: any = await list('items')
    const foundAfter = itemsAfter.find((i: any) => i.id === targetItem.id)
    expect(Number(foundAfter.stock)).toBe(newStock)
    expect(Number(foundAfter.batches[0].stock)).toBe(newStock)
  })

  it('allows creating an item with custom initial stock and batches', async () => {
    const itemCode = `ITM-TEST-${Date.now()}`
    const created = await create('items', {
      code: itemCode,
      name: 'Amoxicillin 500mg Test Capsule',
      packing: '10x10',
      manufacturer: 'Cipla Ltd',
      stock: 120,
      batches: [
        {
          id: `b-${itemCode}-1`,
          batch: 'BT-001',
          expiry: '2027-06-30',
          stock: 50,
          mrp: 100
        },
        {
          id: `b-${itemCode}-2`,
          batch: 'BT-002',
          expiry: '2027-12-31',
          stock: 70,
          mrp: 100
        }
      ]
    })

    expect(created).toBeDefined()
    expect(Number(created.stock)).toBe(120)
    expect(created.batches.length).toBe(2)

    // Now edit the stock of the second batch
    const updated = await update('items', created.id, {
      ...created,
      stock: 150,
      batches: [
        { ...created.batches[0], stock: 50 },
        { ...created.batches[1], stock: 100 }
      ]
    })

    expect(Number(updated.stock)).toBe(150)
    expect(Number(updated.batches[1].stock)).toBe(100)
  })

  it('allocates all stock to Main Store and reports correct used capacity in warehouses master', async () => {
    const warehouses: any = await list('warehouses')
    expect(warehouses.length).toBeGreaterThanOrEqual(1)

    const mainStore = warehouses.find((w: any) => w.name === 'Main Store' || w.code === 'MAIN')
    expect(mainStore).toBeDefined()
    expect(mainStore.name).toBe('Main Store')
    expect(mainStore.address).toContain('BORGANG')

    // Verify used stock reflects all items in the catalog (66,573+ units)
    expect(Number(mainStore.used)).toBeGreaterThanOrEqual(60000)
    expect(Number(mainStore.capacity)).toBeGreaterThanOrEqual(Number(mainStore.used))
  })
})

