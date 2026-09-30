export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RawDatedPoint {
  date: string // YYYY-MM-DD or ISO string or YYYY-MM
  value?: number
  sale?: number
  purchase?: number
  [key: string]: any
}

export interface ChartPoint {
  name: string
  fullLabel: string
  key: string
  value: number
  sale?: number
  purchase?: number
  count?: number
}

/**
 * Returns the ISO week number and year, or Monday of that week
 */
export function getWeekStartAndLabel(dateObj: Date): { key: string; name: string; fullLabel: string } {
  const d = new Date(dateObj.getTime())
  // Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = d.getDay()
  const diffToMonday = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const startMon = monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const endSun = sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const yearStr = monday.getFullYear()

  const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  const name = `${startMon} - ${endSun}`
  const fullLabel = `${startMon} - ${endSun} ${yearStr}`

  return { key, name, fullLabel }
}

/**
 * Returns the Financial Year label (e.g. Apr 2026 to Mar 2027 is FY 2026-27)
 */
export function getFinancialYear(dateObj: Date): { key: string; name: string; fullLabel: string } {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1 // 1-12
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd = (fyStart + 1) % 100
  const key = `FY-${fyStart}`
  const name = `FY ${String(fyStart).slice(-2)}-${String(fyEnd).padStart(2, '0')}`
  const fullLabel = `Financial Year ${fyStart}-${fyStart + 1}`

  return { key, name, fullLabel }
}

/**
 * Normalizes any date string into Date object safely
 */
export function parseDateSafe(raw: string | undefined | null): Date | null {
  if (!raw) return null
  const cleaned = String(raw).trim()
  if (!cleaned) return null
  // If YYYY-MM
  if (/^\d{4}-\d{2}$/.test(cleaned)) {
    const d = new Date(`${cleaned}-01T00:00:00`)
    return isNaN(d.getTime()) ? null : d
  }
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const d = new Date(cleaned.slice(0, 10) + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(cleaned)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Aggregates dated data points into daily, weekly, monthly, or yearly buckets
 */
export function aggregateChartData(
  records: RawDatedPoint[],
  timeframe: Timeframe,
  options?: {
    startDate?: string
    endDate?: string
    fillGaps?: boolean
  }
): ChartPoint[] {
  if (!records || records.length === 0) return []

  const { startDate, endDate } = options || {}

  // 1. Filter by date bounds if specified
  const filtered = records.filter((r) => {
    if (!r.date) return false
    const dStr = String(r.date).slice(0, 10)
    if (startDate && dStr < startDate.slice(0, 10)) return false
    if (endDate && dStr > endDate.slice(0, 10)) return false
    return true
  })

  if (filtered.length === 0) return []

  // 2. Group into buckets
  const buckets = new Map<string, { name: string; fullLabel: string; key: string; value: number; sale: number; purchase: number; count: number }>()

  for (const item of filtered) {
    const d = parseDateSafe(item.date)
    if (!d) continue

    let key = ''
    let name = ''
    let fullLabel = ''

    if (timeframe === 'daily') {
      const year = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      key = `${year}-${m}-${day}`
      name = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      fullLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } else if (timeframe === 'weekly') {
      const weekInfo = getWeekStartAndLabel(d)
      key = weekInfo.key
      name = weekInfo.name
      fullLabel = weekInfo.fullLabel
    } else if (timeframe === 'monthly') {
      const year = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      key = `${year}-${m}`
      name = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      fullLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    } else if (timeframe === 'yearly') {
      const fyInfo = getFinancialYear(d)
      key = fyInfo.key
      name = fyInfo.name
      fullLabel = fyInfo.fullLabel
    }

    const current = buckets.get(key) || {
      name,
      fullLabel,
      key,
      value: 0,
      sale: 0,
      purchase: 0,
      count: 0
    }

    const val = Number(item.value ?? item.sale ?? item.grand_total ?? item.total ?? 0)
    const saleVal = Number(item.sale ?? (item.value !== undefined ? item.value : 0))
    const purVal = Number(item.purchase ?? 0)

    current.value += val
    current.sale += saleVal
    current.purchase += purVal
    current.count += 1

    buckets.set(key, current)
  }

  // 3. Sort chronologically by bucket key
  const result = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key))

  return result.map((r) => ({
    name: r.name,
    fullLabel: r.fullLabel,
    key: r.key,
    value: Math.round(r.value * 100) / 100,
    sale: Math.round(r.sale * 100) / 100,
    purchase: Math.round(r.purchase * 100) / 100,
    count: r.count
  }))
}
