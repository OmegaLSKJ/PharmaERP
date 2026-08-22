import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'

const SHORTCUTS: Record<string, { path?: string; label: string }> = {
  'alt+n': { path: '/transactions/sale/new', label: 'New Sale Invoice' },
  'alt+p': { path: '/transactions/purchase/new', label: 'New Purchase Entry' },
  'alt+m': { path: '/transactions/sale', label: 'Modify / View Sales' },
  'alt+c': { path: '/transactions/orders', label: 'Orders' },
  'alt+a': { path: '/accounting/vouchers', label: 'Voucher Entry' },
  'f1': { path: '/', label: 'Dashboard' },
  'f2': { path: '/masters/items', label: 'Item Master' },
  'f3': { path: '/masters/parties', label: 'Party Master' },
  'f4': { path: '/inventory/stock', label: 'Stock View' },
  'f5': { path: '/reports/sales', label: 'Sales Analytics' },
  'f6': { path: '/reports/gst', label: 'GST Reports' },
  'f7': { path: '/accounting/daybook', label: 'Day Book' },
  'f8': { path: '/inventory/expiry', label: 'Expiry Alerts' },
  'f9': { path: '/reports/financial', label: 'Financial Reports' },
  'f10': { path: '/settings', label: 'Settings' },
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const { toggleCommandPalette } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = `${e.altKey ? 'alt+' : ''}${e.ctrlKey ? 'ctrl+' : ''}${e.key.toLowerCase()}`
      if (key === 'ctrl+k') { e.preventDefault(); toggleCommandPalette(); return }
      const shortcut = SHORTCUTS[key]
      if (shortcut) { e.preventDefault(); if (shortcut.path) navigate(shortcut.path) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, toggleCommandPalette])
}
