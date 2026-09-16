/**
 * Browser Caching Engine for Pharma ERP
 * Combines an in-memory Map for 0ms synchronous access with IndexedDB
 * for persistent storage across page refreshes and browser sessions.
 */

const DB_NAME = 'pharma_erp_cache'
const DB_VERSION = 1
const STORE_NAME = 'erp_resources'
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours

interface CacheEntry<T = unknown> {
  key: string
  data: T
  timestamp: number
  ttl: number
}

// In-memory cache for instant synchronous retrieval
const memoryCache = new Map<string, CacheEntry>()
let dbPromise: Promise<IDBDatabase | null> | null = null
let isInitialized = false

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB
  }
  return null
}

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  const idb = getIndexedDB()
  if (!idb) {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        console.warn('IndexedDB could not be opened, falling back to in-memory cache')
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

/**
 * Normalizes resource name and query object into a unique deterministic cache key
 */
export function buildCacheKey(resource: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) {
    return resource
  }
  const searchParams = new URLSearchParams()
  const sortedKeys = Object.keys(query).sort()
  for (const k of sortedKeys) {
    if (query[k] !== undefined && query[k] !== null) {
      searchParams.set(k, String(query[k]))
    }
  }
  const qs = searchParams.toString()
  return qs ? `${resource}?${qs}` : resource
}

/**
 * Initializes the in-memory cache by reading all persisted entries from IndexedDB
 */
export async function initCache(): Promise<void> {
  if (isInitialized) return
  const db = await openDB()
  if (!db) {
    isInitialized = true
    return
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const now = Date.now()
        const records = request.result as CacheEntry[]
        for (const entry of records) {
          if (entry && entry.key && (now - entry.timestamp <= entry.ttl)) {
            memoryCache.set(entry.key, entry)
          }
        }
        isInitialized = true
        resolve()
      }

      request.onerror = () => {
        isInitialized = true
        resolve()
      }
    } catch {
      isInitialized = true
      resolve()
    }
  })
}

/**
 * Synchronously retrieves cached data from memory for instant (0ms) render.
 * Returns undefined if not in cache or if expired.
 */
export function getCached<T = unknown>(key: string): T | undefined {
  const entry = memoryCache.get(key)
  if (!entry) return undefined

  const isExpired = Date.now() - entry.timestamp > entry.ttl
  if (isExpired) {
    memoryCache.delete(key)
    void removeKeyFromIdb(key)
    return undefined
  }

  return entry.data as T
}

/**
 * Asynchronously checks memory first, then IndexedDB if memory wasn't populated yet.
 */
export async function getCachedAsync<T = unknown>(key: string): Promise<T | undefined> {
  const syncData = getCached<T>(key)
  if (syncData !== undefined) return syncData

  const db = await openDB()
  if (!db) return undefined

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined
        if (!entry) {
          resolve(undefined)
          return
        }
        const isExpired = Date.now() - entry.timestamp > entry.ttl
        if (isExpired) {
          void removeKeyFromIdb(key)
          resolve(undefined)
          return
        }
        memoryCache.set(key, entry)
        resolve(entry.data as T)
      }

      request.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

/**
 * Saves data into both memory and persistent IndexedDB
 */
export async function setCached<T = unknown>(
  key: string,
  data: T,
  ttlMs = DEFAULT_TTL_MS
): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  }

  // Update synchronous memory cache immediately
  memoryCache.set(key, entry as CacheEntry<unknown>)

  // Persist to IndexedDB asynchronously
  const db = await openDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function removeKeyFromIdb(key: string): Promise<void> {
  const db = await openDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Mapping of resources to related resources that should also be invalidated
 */
const RELATED_RESOURCES: Record<string, string[]> = {
  'item-batches': ['items', 'dashboard', 'stock', 'report-stock'],
  items: ['item-batches', 'dashboard', 'stock', 'report-stock', 'report-sales'],
  parties: ['dashboard', 'ledgers', 'report-sales', 'report-purchases'],
  sales: ['dashboard', 'stock', 'report-stock', 'report-sales', 'ledgers', 'day-book'],
  purchases: ['dashboard', 'stock', 'report-stock', 'report-purchases', 'ledgers', 'day-book', 'item-batches', 'items'],
  'sale-returns': ['sales', 'stock', 'report-stock', 'dashboard', 'ledgers'],
  'purchase-returns': ['purchases', 'stock', 'report-stock', 'dashboard', 'ledgers'],
  orders: ['dashboard'],
  challans: ['dashboard', 'stock'],
  vouchers: ['ledgers', 'day-book', 'report-financial'],
  ledgers: ['day-book', 'report-financial', 'dashboard'],
  warehouses: ['stock', 'report-stock'],
}

/**
 * Invalidates cache entries for a resource and all its related dependencies
 */
export async function invalidateCache(resource: string): Promise<void> {
  const resourcesToInvalidate = new Set<string>([resource, ...(RELATED_RESOURCES[resource] || [])])

  const keysToDelete: string[] = []
  for (const key of memoryCache.keys()) {
    for (const res of resourcesToInvalidate) {
      if (key === res || key.startsWith(`${res}?`)) {
        keysToDelete.push(key)
        break
      }
    }
  }

  for (const key of keysToDelete) {
    memoryCache.delete(key)
    await removeKeyFromIdb(key)
  }
}

/**
 * Clears all cached ERP data (used on logout)
 */
export async function clearAllCache(): Promise<void> {
  memoryCache.clear()
  const db = await openDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Checks if a resource/query is already present in cache and valid
 */
export function isCached(key: string): boolean {
  return getCached(key) !== undefined
}

/**
 * Checks if a cached entry is older than maxAgeMs (default 2 minutes)
 */
export function isStale(key: string, maxAgeMs = 120_000): boolean {
  const entry = memoryCache.get(key)
  if (!entry) return true
  return Date.now() - entry.timestamp > maxAgeMs
}

/**
 * Returns all active cache keys currently in memory
 */
export function getAllCachedKeys(): string[] {
  const keys: string[] = []
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.timestamp <= entry.ttl) {
      keys.push(key)
    }
  }
  return keys
}
