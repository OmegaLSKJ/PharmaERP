import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

export default function Toast() {
  const toast = useUIStore((s) => s.toast)
  const clearToast = useUIStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clearToast, 3600)
    return () => window.clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null
  return (
    <div role="status" aria-live="polite" className="glass-surface fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
      <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
      <span className="flex-1">{toast}</span>
      <button type="button" aria-label="Dismiss notification" onClick={clearToast} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X size={15} /></button>
    </div>
  )
}
