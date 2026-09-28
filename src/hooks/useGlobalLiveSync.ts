import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getErp } from '../lib/erpApi'
import { isStale } from '../lib/erpCache'
import { usePreloaderStore } from '../lib/erpPreloader'

/**
 * Route-to-ERP-resource mapping for intelligent, prioritized background live sync.
 */
const ROUTE_RESOURCE_MAP: Record<string, string[]> = {
  '/': ['dashboard', 'sales', 'purchases', 'items'],
  '/masters/parties': ['parties', 'ledgers', 'sales', 'purchases'],
  '/masters/items': ['items', 'item-batches', 'manufacturers', 'salts', 'hsn', 'stock'],
  '/inventory/items': ['items', 'item-batches', 'stock'],
  '/masters/batches': ['item-batches', 'items', 'stock'],
  '/masters/manufacturers': ['manufacturers'],
  '/masters/ledgers': ['ledgers', 'accounts'],
  '/masters/hsn': ['hsn'],
  '/masters/salts': ['salts'],
  '/masters/locations': ['warehouses'],
  '/masters/itemmapping': ['item-mappings', 'items'],
  '/masters/series': ['series'],
  '/masters/communication': ['communication-blocks', 'parties'],
  '/transactions/sale': ['sales', 'parties', 'series'],
  '/transactions/sale/new': ['items', 'item-batches', 'parties', 'series', 'stock'],
  '/transactions/sale/challan': ['challans', 'parties', 'items', 'stock'],
  '/transactions/sale/counter': ['items', 'item-batches', 'stock', 'sales'],
  '/transactions/sale-return': ['sale-returns', 'sales', 'parties'],
  '/transactions/purchase': ['purchases', 'parties', 'series'],
  '/transactions/purchase/new': ['items', 'item-batches', 'parties', 'series'],
  '/transactions/purchase-return': ['purchase-returns', 'purchases', 'parties'],
  '/transactions/orders': ['orders', 'sales', 'parties'],
  '/transactions/breakage': ['breakages', 'items', 'stock'],
  '/transactions/replacement': ['replacements', 'items', 'stock'],
  '/transactions/pricediff': ['price-differences', 'sales', 'purchases'],
  '/transactions/pendings': ['pendings', 'orders', 'challans', 'sales'],
  '/accounting/vouchers': ['vouchers', 'ledgers', 'accounts'],
  '/accounting/daybook': ['day-book', 'ledgers', 'sales', 'purchases', 'vouchers'],
  '/accounting/ledger': ['ledgers', 'vouchers', 'day-book'],
  '/inventory/stock': ['stock', 'items', 'item-batches'],
  '/inventory/expiry': ['stock', 'item-batches'],
  '/inventory/movement': ['stock', 'items'],
  '/inventory/negative': ['stock', 'items'],
  '/inventory/dump': ['stock', 'items'],
  '/inventory/holdban': ['stock', 'items'],
  '/reports/sales': ['report-sales', 'sales'],
  '/reports/sale-analysis': ['report-sales', 'sales'],
  '/reports/purchases': ['report-purchases', 'purchases'],
  '/reports/financial': ['report-financial', 'ledgers', 'day-book'],
  '/reports/trial-balance': ['ledgers', 'day-book'],
  '/reports/profit-loss': ['ledgers', 'sales', 'purchases'],
  '/reports/balance-sheet': ['ledgers', 'day-book'],
  '/delivery': ['delivery', 'sales', 'orders'],
  '/pricing': ['pricing', 'items'],
}

/**
 * Core resources that keep the entire ERP synchronized in the background.
 */
const CORE_BACKGROUND_RESOURCES = [
  'dashboard',
  'sales',
  'purchases',
  'items',
  'stock',
  'parties',
  'ledgers',
]

/**
 * Global background live synchronization engine.
 * Automatically synchronizes all pages and internal views silently in the background:
 * - Runs initial silent preload on login
 * - Silently revalidates active page resources on route change
 * - Heartbeat interval sync every 20 seconds while page is active
 * - Immediate background sync on tab visibility/focus and network reconnection
 * - Zero UI buttons required.
 */
export function useGlobalLiveSync(isAuthenticated: boolean) {
  const location = useLocation()
  const isSyncingRef = useRef(false)
  const lastSyncTimestampRef = useRef<Record<string, number>>({})

  // Determine active resources needed by current route
  const getActiveResources = (): string[] => {
    const pathname = location.pathname.toLowerCase()
    // Match exact or prefix
    for (const [route, resList] of Object.entries(ROUTE_RESOURCE_MAP)) {
      if (pathname === route || pathname.startsWith(`${route}/`)) {
        return Array.from(new Set([...resList, ...CORE_BACKGROUND_RESOURCES]))
      }
    }
    return CORE_BACKGROUND_RESOURCES
  }

  // Silent background revalidation for a list of resources
  const syncResources = async (resources: string[], force = false) => {
    if (isSyncingRef.current || !isAuthenticated || typeof window === 'undefined') return
    if (!navigator.onLine) return

    isSyncingRef.current = true
    try {
      const now = Date.now()
      // Filter resources: revalidate if forced, stale, or not revalidated in last 12 seconds
      const targetResources = resources.filter((res) => {
        if (force) return true
        const lastSync = lastSyncTimestampRef.current[res] || 0
        return now - lastSync > 12_000 || isStale(res)
      })

      // Sync with concurrency limit of 3
      const queue = [...targetResources]
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length > 0) {
          const res = queue.shift()
          if (!res) break
          try {
            await getErp(res, undefined, { forceRefresh: true })
            lastSyncTimestampRef.current[res] = Date.now()
          } catch {
            // Background sync errors are non-blocking and silent
          }
        }
      })
      await Promise.all(workers)
    } finally {
      isSyncingRef.current = false
    }
  }

  // 1. Initial background preload when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    void usePreloaderStore.getState().startPreload()
  }, [isAuthenticated])

  // 2. Intelligent route transition background sync
  useEffect(() => {
    if (!isAuthenticated) return
    const activeResources = getActiveResources()
    void syncResources(activeResources)
  }, [location.pathname, location.search, isAuthenticated])

  // 3. Periodic background heartbeat sync (every 20 seconds)
  useEffect(() => {
    if (!isAuthenticated) return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const activeResources = getActiveResources()
        void syncResources(activeResources)
      }
    }, 20_000)

    return () => window.clearInterval(intervalId)
  }, [location.pathname, isAuthenticated])

  // 4. Background sync on window focus, visibility change, and network reconnect
  useEffect(() => {
    if (!isAuthenticated) return

    const handleResume = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const activeResources = getActiveResources()
        void syncResources(activeResources, true)
      }
    }

    window.addEventListener('focus', handleResume)
    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('online', handleResume)

    return () => {
      window.removeEventListener('focus', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('online', handleResume)
    }
  }, [location.pathname, isAuthenticated])
}
