import { useEffect, useRef } from 'react'

/**
 * Automatically triggers a component refresh callback whenever the specified
 * ERP resource(s) are mutated (created, updated, deleted) or revalidated,
 * either in the current tab, another tab, or a pop-out transaction window.
 * Also refreshes automatically when the user switches back into this tab.
 */
export function useErpAutoRefresh(
  resources: string | string[],
  onRefresh: () => void | Promise<void>
) {
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  const lastRefreshTimeRef = useRef<number>(0)
  const isRefreshingRef = useRef<boolean>(false)

  useEffect(() => {
    const resourceList = Array.isArray(resources) ? resources : [resources]

    const triggerRefresh = async () => {
      if (isRefreshingRef.current) return
      isRefreshingRef.current = true
      try {
        lastRefreshTimeRef.current = Date.now()
        await refreshRef.current()
      } finally {
        isRefreshingRef.current = false
      }
    }

    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ resource?: string }>
      const res = customEvent.detail?.resource
      if (!res || resourceList.includes(res) || resourceList.includes('*')) {
        void triggerRefresh()
      }
    }

    const handleVisibility = () => {
      // Throttle window focus / tab visibility change to once every 30 seconds
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshTimeRef.current > 30_000) {
        void triggerRefresh()
      }
    }

    window.addEventListener('erp-resource-mutated', handleEvent)
    window.addEventListener('erp-cache-revalidated', handleEvent)
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('erp-resource-mutated', handleEvent)
      window.removeEventListener('erp-cache-revalidated', handleEvent)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [Array.isArray(resources) ? resources.join(',') : resources])
}
