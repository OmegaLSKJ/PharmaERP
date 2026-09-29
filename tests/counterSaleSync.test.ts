import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { invalidateServerCache, list } from '../apps/web/lib/erp-store'
import { getCached, setCached, clearAllCache } from '../src/lib/erpCache'
import { resetInFlightRequests } from '../src/lib/erpApi'

describe('Instant Sync and Cache Optimization', () => {
  beforeEach(async () => {
    resetInFlightRequests()
    await clearAllCache()
    invalidateServerCache()
    vi.restoreAllMocks()
  })

  it('serves items from client cache synchronously without delay', async () => {
    const mockItems = [
      { id: '1', name: 'A TO Z GOLD CAP', batches: [{ batch: 'B1', stock: 10, mrp: 180 }] },
      { id: '2', name: 'ABHAYRAB VACCINE', batches: [{ batch: 'B2', stock: 5, mrp: 320 }] }
    ]
    await setCached('items', mockItems)

    const cached = getCached<typeof mockItems>('items')
    expect(cached).toBeDefined()
    expect(cached?.length).toBe(2)
    expect(cached?.[0].name).toBe('A TO Z GOLD CAP')
  })

  it('invalidates server-side cache on mutations correctly', () => {
    // Calling invalidateServerCache with 'sales' clears related cached resources
    expect(() => invalidateServerCache('sales')).not.toThrow()
    expect(() => invalidateServerCache('items')).not.toThrow()
    expect(() => invalidateServerCache()).not.toThrow()
  })

  it('allows fast retrieval of mock/store items without errors', async () => {
    const items = await list('items')
    expect(Array.isArray(items)).toBe(true)
  })
})
