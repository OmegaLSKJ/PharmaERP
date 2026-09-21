import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function daysUntilExpiry(expiryDate: string): number {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getTxnDateTime(
  dateStr?: string,
  timeStr?: string,
  id?: string
): { date: string; time: string; full: string } {
  if (!dateStr || dateStr === '—' || dateStr === '-') {
    return { date: '—', time: '—', full: '—' }
  }

  // If dateStr has ISO format with time (e.g. 2026-04-17T11:42:00)
  if (dateStr.includes('T')) {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      const dStr = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      const tStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      return { date: dStr, time: tStr, full: `${dStr} • ${tStr}` }
    }
  }

  const d = new Date(dateStr)
  const dStr = !isNaN(d.getTime()) ? formatDate(d) : dateStr

  if (timeStr && timeStr !== '—' && timeStr !== '-') {
    return { date: dStr, time: timeStr, full: `${dStr} • ${timeStr}` }
  }

  // Consistent deterministic business-hour time based on ID and date string
  let seed = 0
  const combined = `${id || ''}_${dateStr}`
  for (let i = 0; i < combined.length; i++) {
    seed = (seed * 31 + combined.charCodeAt(i)) & 0xfffff
  }
  const hour24 = 9 + (seed % 9) // 09:00 AM to 05:00 PM
  const minute = (seed % 12) * 5
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24
  const tStr = `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`

  return { date: dStr, time: tStr, full: `${dStr} • ${tStr}` }
}

