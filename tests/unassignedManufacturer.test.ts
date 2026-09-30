import { describe, expect, it, vi, afterAll } from 'vitest'

vi.mock('server-only', () => ({}))

import { list, create, remove } from '../apps/web/lib/erp-store'

describe('Unassigned Manufacturer Master & Medicine Mapping', () => {
  const createdMfgIds: string[] = []
  const createdItemIds: string[] = []

  afterAll(async () => {
    for (const id of createdItemIds) {
      await remove('items', id).catch(() => {})
    }
    for (const id of createdMfgIds) {
      await remove('manufacturers', id).catch(() => {})
    }
  })

  it('normalizes placeholder "**" manufacturer to "Unassigned Manufacturer" with code "UNASSIGNED"', async () => {
    const mfgs: any = await list('manufacturers')
    expect(Array.isArray(mfgs)).toBe(true)

    // Check if there is an unassigned manufacturer, or create one with '**'
    let unassigned = mfgs.find((m: any) => m.name === 'Unassigned Manufacturer' || m.code === 'UNASSIGNED')
    if (!unassigned) {
      const created: any = await create('manufacturers', {
        name: '**',
        code: 'UNASSIGNED',
        status: 'active'
      })
      if (created?.id) createdMfgIds.push(created.id)
      const updatedMfgs: any = await list('manufacturers')
      unassigned = updatedMfgs.find((m: any) => m.name === 'Unassigned Manufacturer' || m.code === 'UNASSIGNED')
    }

    expect(unassigned).toBeDefined()
    expect(unassigned.name).toBe('Unassigned Manufacturer')
    expect(unassigned.code).toBe('UNASSIGNED')
  })

  it('pins Unassigned Manufacturer at the top of the manufacturer list', async () => {
    // Add other manufacturers that would alphabetically come before 'U'
    const aMfg: any = await create('manufacturers', {
      name: 'Abbott Healthcare',
      code: 'ABBOTT',
      status: 'active'
    })
    if (aMfg?.id) createdMfgIds.push(aMfg.id)

    const mfgs: any = await list('manufacturers')
    expect(Array.isArray(mfgs)).toBe(true)
    expect(mfgs.length).toBeGreaterThan(1)
    // First element must be Unassigned Manufacturer
    expect(mfgs[0].code).toBe('UNASSIGNED')
    expect(mfgs[0].name).toBe('Unassigned Manufacturer')
  })

  it('retrieves medicines under Unassigned Manufacturer when queried by name or ID', async () => {
    const unassignedMfgId = 'unassigned-mfg-test-id'
    
    // Create an item explicitly mapped to unassigned manufacturer
    const itemCode = `UNASS-MED-${Date.now()}`
    const createdItem: any = await create('items', {
      code: itemCode,
      name: 'Unassigned Test Ointment 20g',
      manufacturer: 'Unassigned Manufacturer',
      manufacturer_id: unassignedMfgId,
      mrp: 50,
      saleRate: 40,
      purchaseRate: 30,
      stock: 15
    })

    expect(createdItem).toBeDefined()
    if (createdItem?.id) createdItemIds.push(createdItem.id)

    // 1. Query by manufacturer name
    const itemsByName: any = await list('items', undefined, {
      manufacturer: 'Unassigned Manufacturer'
    })
    expect(Array.isArray(itemsByName)).toBe(true)
    const foundByName = itemsByName.find((i: any) => i.code === itemCode)
    expect(foundByName).toBeDefined()
    expect(foundByName.manufacturer).toBe('Unassigned Manufacturer')

    // 2. Query by both manufacturer and manufacturerId (as sent by ManufacturerMedicinesModal)
    const itemsByBoth: any = await list('items', undefined, {
      manufacturer: 'Unassigned Manufacturer',
      manufacturerId: unassignedMfgId
    })
    expect(Array.isArray(itemsByBoth)).toBe(true)
    const foundByBoth = itemsByBoth.find((i: any) => i.code === itemCode)
    expect(foundByBoth).toBeDefined()
  })

  it('matches items with placeholder "**" or empty manufacturer under Unassigned Manufacturer', async () => {
    const placeholderCode = `PLCH-MED-${Date.now()}`
    const createdPlaceholder: any = await create('items', {
      code: placeholderCode,
      name: 'Placeholder Star Medicine 100ml',
      manufacturer: '**',
      mrp: 85,
      saleRate: 70,
      purchaseRate: 50,
      stock: 25
    })
    if (createdPlaceholder?.id) createdItemIds.push(createdPlaceholder.id)

    const results: any = await list('items', undefined, {
      manufacturer: 'Unassigned Manufacturer'
    })
    const found = results.find((i: any) => i.code === placeholderCode)
    expect(found).toBeDefined()
  })
})
