import { useEffect } from 'react'

/**
 * Locks the body scroll when `locked` is true and compensates for the
 * scrollbar disappearing (prevents the ~17px layout jitter).
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    if (typeof document === 'undefined') return

    // Measure scrollbar width before hiding it
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    // Compensate for the scrollbar width so content doesn't shift
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [locked])
}
