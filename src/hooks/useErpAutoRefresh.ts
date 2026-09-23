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

  useEffect(() => {
    const resourceList = Array.isArray(resources) ? resources : [resources]

    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ resource?: string }>
      const res = customEvent.detail?.resource
      if (!res || resourceList.includes(res) || resourceList.includes('*')) {
        void refreshRef.current()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshRef.current()
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
