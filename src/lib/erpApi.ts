import {
  buildCacheKey,
  getCached,
  getCachedAsync,
  setCached,
  invalidateCache,
  initCache,
  isStale,
} from './erpCache'

export { initCache }

// Track in-flight promises to deduplicate concurrent network requests
const inFlightRequests = new Map<string, Promise<any>>()

export function resetInFlightRequests(): void {
  inFlightRequests.clear()
}

function buildApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path
  }
  return `http://127.0.0.1:3000${path}`
}

async function fetchFromNetwork<T>(resource: string, query?: Record<string, string>): Promise<T> {
  const params = query ? `?${new URLSearchParams(query)}` : ''
  const response = await fetch(buildApiUrl(`/api/v1/${resource}${params}`))
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed')
  }
  return payload.data as T
}

/**
 * Retrieves ERP resource data.
 * Cache-First with Background Revalidation:
 * If cached in memory or IndexedDB, returns instantly without making the user wait.
 * Revalidates in the background only when the data is stale (older than 2 minutes).
 */
export async function getErp<T>(
  resource: string,
  query?: Record<string, string>,
  options?: { forceRefresh?: boolean }
): Promise<T> {
  const cacheKey = buildCacheKey(resource, query)

  // 1. Instant return if in memory cache and not forced refresh
  if (!options?.forceRefresh) {
    const memoryData = getCached<T>(cacheKey)
    if (memoryData !== undefined) {
      // Non-blocking background revalidation only if cache has become stale
      if (isStale(cacheKey)) {
        backgroundRevalidate(resource, query, cacheKey)
      }
      return memoryData
    }

    // 2. Check persistent IndexedDB cache
    const idbData = await getCachedAsync<T>(cacheKey)
    if (idbData !== undefined) {
      if (isStale(cacheKey)) {
        backgroundRevalidate(resource, query, cacheKey)
      }
      return idbData
    }
  }

  // 3. Deduplicate network requests in flight
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>
  }

  const fetchPromise = (async () => {
    try {
      const data = await fetchFromNetwork<T>(resource, query)
      await setCached(cacheKey, data)
      return data
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, fetchPromise)
  return fetchPromise
}

function backgroundRevalidate(resource: string, query: Record<string, string> | undefined, cacheKey: string) {
  if (inFlightRequests.has(cacheKey)) return
  const revalPromise = (async () => {
    try {
      const data = await fetchFromNetwork(resource, query)
      await setCached(cacheKey, data)
    } catch (err) {
      // Silently ignore background revalidation errors so user experience is not disrupted
      console.warn(`[erpCache] Background revalidation failed for ${cacheKey}:`, err)
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()
  inFlightRequests.set(cacheKey, revalPromise)
}

export async function postErp<T>(resource: string, body: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(`/api/v1/${resource}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed')
  }
  await invalidateCache(resource)
  return payload.data as T
}

export async function patchErp<T>(resource: string, id: string, body: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(`/api/v1/${resource}?id=${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed')
  }
  await invalidateCache(resource)
  return payload.data as T
}

export async function deleteErp(resource: string, id: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/v1/${resource}?id=${encodeURIComponent(id)}`), {
    method: 'DELETE',
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Request failed')
  }
  await invalidateCache(resource)
}
