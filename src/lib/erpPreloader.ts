import { create } from 'zustand'
import { getErp, initCache } from './erpApi'

export const PRELOAD_RESOURCES = [
  // High Priority: Dashboard & Core Masters
  'dashboard',
  'items',
  'item-batches',
  'parties',
  'sales',
  'purchases',
  // Secondary Masters
  'manufacturers',
  'salts',
  'hsn',
  'warehouses',
  'series',
  'accounts',
  'communication-blocks',
  'item-mappings',
  // Transactions
  'orders',
  'challans',
  'sale-returns',
  'purchase-returns',
  'replacements',
  'counter-sales',
  'breakages',
  'price-differences',
  'pendings',
  // Accounting & Inventory
  'ledgers',
  'vouchers',
  'day-book',
  'stock',
  'reservations',
  'inventory-adjustment-records',
  'inventory-adjustment-lines',
  // Compliance
  'drug-licenses',
  'product-recalls',
  'controlled-drug-register',
  // Reports
  'report-sales',
  'report-purchases',
  'report-financial',
  'report-stock',
] as const

export type PreloadResource = (typeof PRELOAD_RESOURCES)[number]

interface PreloaderState {
  status: 'idle' | 'syncing' | 'synced' | 'error'
  total: number
  completed: number
  percent: number
  currentResource: string | null
  lastSyncedAt: Date | null
  errors: string[]
  startPreload: (options?: { force?: boolean }) => Promise<void>
  reset: () => void
}

let preloadPromise: Promise<void> | null = null

export const usePreloaderStore = create<PreloaderState>((set, get) => ({
  status: 'idle',
  total: PRELOAD_RESOURCES.length,
  completed: 0,
  percent: 0,
  currentResource: null,
  lastSyncedAt: null,
  errors: [],

  reset: () => {
    preloadPromise = null
    set({
      status: 'idle',
      total: PRELOAD_RESOURCES.length,
      completed: 0,
      percent: 0,
      currentResource: null,
      errors: [],
    })
  },

  startPreload: async (options?: { force?: boolean }) => {
    // If already syncing, return the active promise
    if (preloadPromise && !options?.force) {
      return preloadPromise
    }

    // If already synced and not forcing, do nothing
    if (get().status === 'synced' && !options?.force) {
      return
    }

    preloadPromise = (async () => {
      // First ensure the IndexedDB cache is initialized into memory
      await initCache()

      const total = PRELOAD_RESOURCES.length
      let completed = 0
      const errors: string[] = []

      set({
        status: 'syncing',
        total,
        completed: 0,
        percent: 0,
        errors: [],
      })

      // Concurrency limit: 4 simultaneous requests to balance speed and avoid rate limits
      const concurrency = 4
      const queue = [...PRELOAD_RESOURCES]

      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length > 0) {
          const resource = queue.shift()
          if (!resource) break

          set({ currentResource: resource })

          try {
            await getErp(resource, undefined, { forceRefresh: Boolean(options?.force) })
          } catch (err) {
            console.warn(`[erpPreloader] Failed preloading resource ${resource}:`, err)
            errors.push(resource)
          } finally {
            completed++
            set({
              completed,
              percent: Math.round((completed / total) * 100),
            })
          }
        }
      })

      await Promise.all(workers)

      set({
        status: errors.length === total ? 'error' : 'synced',
        currentResource: null,
        lastSyncedAt: new Date(),
        errors,
      })
    })()

    return preloadPromise
  },
}))
