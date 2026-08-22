import { useEffect } from 'react'

const editableSelector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Makes dense ERP forms keyboard-first without overriding native Tab behavior. */
export function useKeyboardFormNavigation() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key === 'Escape') { target.blur(); return }
      if (event.key !== 'Enter' || target.tagName === 'TEXTAREA' || target.matches('[data-enter-submit]')) return
      if (!target.matches('input, select')) return
      const scope = target.closest('form, .page-enter')
      if (!scope) return
      const fields = Array.from(scope.querySelectorAll<HTMLElement>(editableSelector)).filter((field) => field.offsetParent !== null)
      const index = fields.indexOf(target)
      const next = fields[index + (event.shiftKey ? -1 : 1)]
      if (next) { event.preventDefault(); next.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
