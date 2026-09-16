import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildCacheKey,
  getCached,
  setCached,
  invalidateCache,
  clearAllCache,
  isCached,
  getAllCachedKeys,
} from '../src/lib/erpCache'
import { getErp, postErp, resetInFlightRequests } from '../src/lib/erpApi'
import { usePreloaderStore, PRELOAD_RESOURCES } from '../src/lib/erpPreloader'

describe('erpCache engine', () => {
  beforeEach(async () => {
    resetInFlightRequests()
    await clearAllCache()
    vi.restoreAllMocks()
  })

  it('builds consistent cache keys regardless of query parameter order', () => {
    const key1 = buildCacheKey('items', { sort: 'name', order: 'asc' })
    const key2 = buildCacheKey('items', { order: 'asc', sort: 'name' })
    expect(key1).toBe('items?order=asc&sort=name')
    expect(key1).toBe(key2)

    expect(buildCacheKey('items')).toBe('items')
    expect(buildCacheKey('parties', {})).toBe('parties')
  })

  it('stores and retrieves cached data synchronously in memory with 0ms delay', async () => {
    const mockItems = [{ id: '1', name: 'Paracetamol' }]
    await setCached('items', mockItems)

    expect(isCached('items')).toBe(true)
    const result = getCached<typeof mockItems>('items')
    expect(result).toEqual(mockItems)
  })

  it('handles TTL expiration properly', async () => {
    const mockData = { message: 'temporary' }
    // 10ms TTL
    await setCached('temp-resource', mockData, 10)
    expect(getCached('temp-resource')).toEqual(mockData)

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getCached('temp-resource')).toBeUndefined()
  })

  it('invalidates resource and related resources on modification', async () => {
    await setCached('item-batches', [{ id: 'b1' }])
    await setCached('items', [{ id: 'i1' }])
    await setCached('dashboard', { kpis: {} })
    await setCached('parties', [{ id: 'p1' }])

    // Invalidating item-batches should also invalidate items and dashboard
    await invalidateCache('item-batches')

    expect(getCached('item-batches')).toBeUndefined()
    expect(getCached('items')).toBeUndefined()
    expect(getCached('dashboard')).toBeUndefined()
    // Unrelated resource remains cached
    expect(getCached('parties')).toBeDefined()
  })

  it('clears all cache entries on logout', async () => {
    await setCached('items', [1, 2, 3])
    await setCached('parties', [4, 5, 6])
    expect(getAllCachedKeys().length).toBe(2)

    await clearAllCache()
    expect(getAllCachedKeys().length).toBe(0)
    expect(getCached('items')).toBeUndefined()
    expect(getCached('parties')).toBeUndefined()
  })
})

describe('getErp with Cache-First resolution', () => {
  beforeEach(async () => {
    resetInFlightRequests()
    await clearAllCache()
    vi.restoreAllMocks()
  })

  it('returns cached data immediately without waiting for network', async () => {
    const cachedParties = [{ id: 'p1', name: 'Apollo Pharmacy' }]
    await setCached('parties', cachedParties)

    // Spy on global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await getErp('parties')
    expect(result).toEqual(cachedParties)
    // Synchronous memory return resolved immediately!
  })

  it('fetches from network, caches result, and subsequent calls return from cache', async () => {
    const mockBatches = [{ id: 'b1', batchNumber: 'BAT-001' }]

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBatches }),
    } as Response)

    const firstCall = await getErp('item-batches')
    expect(firstCall).toEqual(mockBatches)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Second call should return directly from cache
    const secondCall = await getErp('item-batches')
    expect(secondCall).toEqual(mockBatches)
    expect(isCached('item-batches')).toBe(true)
  })

  it('invalidates cache when postErp mutation succeeds', async () => {
    await setCached('items', [{ id: 'i1', name: 'Old Item' }])
    expect(isCached('items')).toBe(true)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'i2', name: 'New Item' } }),
    } as Response)

    await postErp('items', { name: 'New Item' })

    // Cache should have been invalidated
    expect(isCached('items')).toBe(false)
  })
})

describe('erpPreloader store', () => {
  beforeEach(async () => {
    resetInFlightRequests()
    await clearAllCache()
    usePreloaderStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('preloads all ERP resources and updates state to synced', async () => {
    // Mock fetch for all resources
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      return {
        ok: true,
        json: async () => ({ data: [{ sample: url }] }),
      } as Response
    })

    const store = usePreloaderStore.getState()
    expect(store.status).toBe('idle')

    await store.startPreload()

    const finalState = usePreloaderStore.getState()
    expect(finalState.status).toBe('synced')
    expect(finalState.percent).toBe(100)
    expect(finalState.completed).toBe(PRELOAD_RESOURCES.length)
    expect(finalState.lastSyncedAt).toBeInstanceOf(Date)

    // Check that resources are now populated in browser cache
    expect(isCached('dashboard')).toBe(true)
    expect(isCached('items')).toBe(true)
    expect(isCached('item-batches')).toBe(true)
    expect(isCached('parties')).toBe(true)
  })
})
