import { useState, useEffect, useMemo } from 'react'
import { Download, TrendingUp, TrendingDown, Calendar, Layers } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import PrintHeader from '../../components/layout/PrintHeader'
import PrintButton from '../../components/common/PrintButton'
import { useUIStore } from '../../store/uiStore'
import { aggregateChartData, type Timeframe, type ChartPoint } from '../../lib/chartUtils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b']

interface RawInvoiceLine {
  name: string
  qty: number
  amount: number
  category: string
}

interface RawInvoice {
  id: string
  invoiceNumber?: string
  date: string
  party: string
  total: number
  lines?: RawInvoiceLine[]
}

interface SalesReport {
  monthlySales: Array<{ month: string; value: number }>
  dailySales?: Array<{ date: string; value: number }>
  rawInvoices?: RawInvoice[]
  categories: Array<{ name: string; value: number }>
  topParties: Array<{ name: string; sales: number; growth: number }>
  topItems: Array<{ name: string; qty: number; revenue: number; margin: number }>
  units: number
}

const emptySalesReport: SalesReport = {
  monthlySales: [],
  dailySales: [],
  rawInvoices: [],
  categories: [],
  topParties: [],
  topItems: [],
  units: 0
}

function normalizeSalesReport(value: unknown): SalesReport {
  const source = value && typeof value === 'object' ? (value as Partial<SalesReport>) : {}
  return {
    monthlySales: Array.isArray(source.monthlySales) ? source.monthlySales : [],
    dailySales: Array.isArray(source.dailySales) ? source.dailySales : [],
    rawInvoices: Array.isArray(source.rawInvoices) ? source.rawInvoices : [],
    categories: Array.isArray(source.categories) ? source.categories : [],
    topParties: Array.isArray(source.topParties) ? source.topParties : [],
    topItems: Array.isArray(source.topItems) ? source.topItems : [],
    units: Number.isFinite(Number(source.units)) ? Number(source.units) : 0,
  }
}

function ChartCustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload as ChartPoint
  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-3 shadow-xl min-w-[180px] text-xs">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/60">
        <Calendar size={13} className="text-muted-foreground" />
        <span className="font-semibold text-foreground">{data.fullLabel || data.name}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-muted-foreground">Total Sales:</span>
        <span className="font-semibold text-primary font-mono">{formatCurrency(data.value)}</span>
      </div>
      {data.count !== undefined && data.count > 0 && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Invoices:</span>
          <span>{data.count}</span>
        </div>
      )}
    </div>
  )
}

export default function SalesAnalytics() {
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')
  const [preset, setPreset] = useState('FY')

  // Default financial year
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return `${yr}-04-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const now = new Date()
    const yr = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear()
    return `${yr}-03-31`
  })

  const [report, setReport] = useState<SalesReport>(emptySalesReport)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getErp<unknown>('report-sales')
      .then((data) => setReport(normalizeSalesReport(data)))
      .catch(() => setReport(emptySalesReport))
      .finally(() => setLoading(false))
  }, [])

  // Helper to handle date preset selection
  const handlePresetChange = (val: string) => {
    setPreset(val)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const yr = now.getFullYear()
    const m = now.getMonth() // 0-indexed

    if (val === 'Today') {
      setStartDate(todayStr)
      setEndDate(todayStr)
      setTimeframe('daily')
    } else if (val === 'Month') {
      const startOfMonth = new Date(yr, m, 1).toISOString().slice(0, 10)
      const endOfMonth = new Date(yr, m + 1, 0).toISOString().slice(0, 10)
      setStartDate(startOfMonth)
      setEndDate(endOfMonth)
      setTimeframe('daily')
    } else if (val === 'Quarter') {
      const qMonth = Math.floor(m / 3) * 3
      const startOfQ = new Date(yr, qMonth, 1).toISOString().slice(0, 10)
      const endOfQ = new Date(yr, qMonth + 3, 0).toISOString().slice(0, 10)
      setStartDate(startOfQ)
      setEndDate(endOfQ)
      setTimeframe('weekly')
    } else if (val === 'FY') {
      const fyStartYear = m >= 3 ? yr : yr - 1
      setStartDate(`${fyStartYear}-04-01`)
      setEndDate(`${fyStartYear + 1}-03-31`)
      setTimeframe('monthly')
    }
  }

  // Filter raw data points by active date range
  const filteredData = useMemo(() => {
    const rawInvoices = report.rawInvoices || []
    if (rawInvoices.length > 0) {
      const inRange = rawInvoices.filter((inv) => {
        const d = String(inv.date || '').slice(0, 10)
        return (!startDate || d >= startDate) && (!endDate || d <= endDate)
      })

      const totalSales = inRange.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0)

      // Category breakdown from filtered invoices
      const catMap = new Map<string, number>()
      let totalUnits = 0
      const partyMap = new Map<string, number>()
      const itemMap = new Map<string, { name: string; qty: number; revenue: number; margin: number }>()

      for (const inv of inRange) {
        partyMap.set(inv.party, (partyMap.get(inv.party) || 0) + inv.total)
        for (const line of inv.lines || []) {
          totalUnits += line.qty
          catMap.set(line.category, (catMap.get(line.category) || 0) + line.amount)
          const currItem = itemMap.get(line.name) || { name: line.name, qty: 0, revenue: 0, margin: 25 }
          currItem.qty += line.qty
          currItem.revenue += line.amount
          itemMap.set(line.name, currItem)
        }
      }

      const categories = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))

      const topParties = Array.from(partyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, sales]) => ({ name, sales, growth: 0 }))

      const topItems = Array.from(itemMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      return {
        points: inRange.map((inv) => ({ date: inv.date, value: inv.total })),
        totalSales,
        categories: categories.length > 0 ? categories : report.categories,
        topParties: topParties.length > 0 ? topParties : report.topParties,
        topItems: topItems.length > 0 ? topItems : report.topItems,
        units: totalUnits || report.units,
      }
    }

    // Fallback if rawInvoices isn't loaded yet
    const sourcePoints = (report.dailySales && report.dailySales.length > 0)
      ? report.dailySales
      : report.monthlySales.map((m) => ({ date: m.month, value: m.value }))

    const inRange = sourcePoints.filter((pt) => {
      const d = String(pt.date).slice(0, 10)
      return (!startDate || d >= startDate) && (!endDate || d <= endDate)
    })

    const totalSales = inRange.reduce((acc, p) => acc + (p.value || 0), 0)

    return {
      points: inRange,
      totalSales,
      categories: report.categories,
      topParties: report.topParties,
      topItems: report.topItems,
      units: report.units,
    }
  }, [report, startDate, endDate])

  // Dynamic Chart Points aggregated strictly according to selected timeframe
  const chartData = useMemo(() => {
    return aggregateChartData(filteredData.points, timeframe, {
      startDate,
      endDate,
    })
  }, [filteredData.points, timeframe, startDate, endDate])

  const totalSales = filteredData.totalSales
  const avgPeriodSales = chartData.length > 0 ? totalSales / chartData.length : 0
  const bestPeriod = chartData.reduce(
    (max, pt) => (pt.value > max.value ? pt : max),
    { name: '—', value: 0 } as { name: string; value: number }
  )

  const timeframeLabel = useMemo(() => {
    if (timeframe === 'daily') return 'Day'
    if (timeframe === 'weekly') return 'Week'
    if (timeframe === 'monthly') return 'Month'
    return 'Year'
  }, [timeframe])

  const periodLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${startDate} to ${endDate}`
    }
    if (preset === 'Today') return 'Today'
    if (preset === 'Month') return 'This Month'
    if (preset === 'Quarter') return 'This Quarter'
    if (preset === 'FY') return 'Financial Year'
    return 'All Recorded Periods'
  }, [startDate, endDate, preset])

  return (
    <div className="p-3 sm:p-6 space-y-4 print:p-0 print:space-y-3 print:bg-white print:text-black">
      <PrintHeader
        title="SALES ANALYTICS & INTELLIGENCE REPORT"
        subtitle={`${periodLabel} • ${timeframeLabel} Trend View`}
        orientation="auto"
      />

      {/* Title Block - Screen Only */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Sales Analytics</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Live ERP Intelligence · Multi-dimensional sales reporting</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label="Export to Print / PDF" autoOrientationHint="portrait" className="no-print" />
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('sales-analytics', useUIStore.getState().company))}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Date Filter Bar - Screen Only */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm no-print">
        <div className="flex items-center gap-2.5">
          <Calendar className="text-primary animate-pulse" size={16} />
          <span className="text-xs font-semibold text-foreground">Analytics Date Filter</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
            Live Database Data
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-secondary/60 border border-border rounded-lg text-foreground w-full sm:w-auto sm:max-w-[150px] focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="FY">Financial Year</option>
            <option value="Today">Today</option>
            <option value="Month">This Month</option>
            <option value="Quarter">This Quarter</option>
            <option value="Custom">Custom Range</option>
          </select>
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto max-w-full">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPreset('Custom')
              }}
              className="flex-1 min-w-0 max-w-[135px] sm:max-w-none px-2.5 py-1.5 text-xs bg-secondary/60 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground shrink-0 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPreset('Custom')
              }}
              className="flex-1 min-w-0 max-w-[135px] sm:max-w-none px-2.5 py-1.5 text-xs bg-secondary/60 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-3 print:gap-2.5 print:break-inside-avoid">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold print:text-black/70 print:text-[9px]">Total Sales</div>
          <div className="text-xl font-bold text-foreground mt-1 font-mono print:text-base print:text-black print:mt-0.5">
            {loading ? 'Loading…' : formatCurrency(totalSales)}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] print:text-[8.5px]">
            <TrendingUp size={11} className="text-emerald-600 dark:text-emerald-400 print:text-emerald-700" />
            <span className="text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-medium">Live Active</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold print:text-black/70 print:text-[9px]">Avg Per {timeframeLabel}</div>
          <div className="text-xl font-bold text-foreground mt-1 font-mono print:text-base print:text-black print:mt-0.5">
            {loading ? '…' : formatCurrency(avgPeriodSales)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 print:text-[8.5px] print:text-black/60">Across {chartData.length} active periods</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold print:text-black/70 print:text-[9px]">Best {timeframeLabel}</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-700 mt-1 truncate print:text-base print:mt-0.5">
            {bestPeriod.name || '—'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 print:text-[8.5px] print:text-black/60">
            {bestPeriod.value > 0 ? formatCurrency(bestPeriod.value) : '₹0.00'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold print:text-black/70 print:text-[9px]">Units Sold</div>
          <div className="text-xl font-bold text-foreground mt-1 font-mono print:text-base print:text-black print:mt-0.5">
            {loading ? '…' : filteredData.units.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 print:text-[8.5px] print:text-black/60">Total items transacted</div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-12 gap-4 print:gap-3 print:break-inside-avoid">
        {/* Dynamic Trend Bar Chart */}
        <div className="lg:col-span-2 print:col-span-7 bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground print:text-xs print:text-black">Sales Trend Analysis</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20 capitalize print:border-black/20 print:text-black print:text-[9px]">
                  {timeframe} view
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 print:text-[9px] print:text-black/60">
                Aggregated by {timeframe} over selected range
              </p>
            </div>

            {/* Timeframe Toggle Buttons - Hidden in Print */}
            <div className="inline-flex bg-secondary/80 p-0.5 rounded-lg border border-border self-start sm:self-auto no-print">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeframe(t)}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all duration-150 cursor-pointer',
                    timeframe === t
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'daily' ? 'Daily' : t === 'weekly' ? 'Weekly' : t === 'monthly' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 sm:h-72 lg:h-80 xl:h-96 min-h-[250px] print:h-52 print:min-h-0 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 12, left: -4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="salesGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-muted-foreground print:text-black"
                    axisLine={false}
                    tickLine={false}
                    interval={chartData.length > 15 ? 'preserveStartEnd' : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'currentColor' }}
                    className="text-muted-foreground print:text-black"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip content={<ChartCustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.35)', radius: 6 }} />
                  <Bar
                    dataKey="value"
                    fill="url(#salesGlow)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={chartData.length > 20 ? 22 : 44}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground">
                <Calendar size={24} className="mb-2 opacity-50" />
                No sales recorded in the selected date range.
              </div>
            )}
          </div>
        </div>

        {/* By Category Donut Chart */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between print:col-span-5 print:bg-white print:border-black/30 print:shadow-none print:p-2.5 print:rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 print:text-xs print:text-black">
              <Layers size={15} className="text-primary print:text-black" /> By Category
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono print:text-[9px] print:text-black/70">
              {filteredData.categories.length} categories
            </span>
          </div>

          <div className="h-48 sm:h-56 min-h-[190px] print:h-36 print:min-h-0 w-full">
            {filteredData.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredData.categories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={3}
                  >
                    {filteredData.categories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number | string) => [formatCurrency(Number(v)), 'Sales']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No category data found.
              </div>
            )}
          </div>

          <div className="space-y-1.5 mt-2 max-h-[160px] overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:space-y-1">
            {filteredData.categories.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs py-0.5 print:text-[10px] print:py-0">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 print:w-2 print:h-2" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-foreground truncate print:text-black">{c.name}</span>
                </div>
                <span className="font-mono text-muted-foreground shrink-0 font-medium print:text-black">
                  {formatCurrency(c.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Page 2 Continuation Section Header (Print Only) */}
      <div className="hidden print:flex items-center justify-between border-b border-black/40 pb-1.5 mt-2 print:break-before-page">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-black">
            SALES ANALYTICS & INTELLIGENCE REPORT — BREAKDOWN
          </div>
          <div className="text-[8.5px] text-black/70">
            {periodLabel} • Counterparty & SKU Revenue Performance
          </div>
        </div>
        <div className="text-right text-[8.5px] text-black/70">
          <span>Official Audited Statement</span>
        </div>
      </div>

      {/* Top Parties and Top Items Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3 print:break-inside-avoid">
        {/* Top Parties */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm print:bg-white print:border-black/30 print:shadow-none print:rounded-lg">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between print:px-2.5 print:py-1.5 print:bg-gray-100 print:border-black/30">
            <h3 className="text-sm font-semibold text-foreground print:text-xs print:text-black">Top Parties by Sales</h3>
            <span className="text-[11px] text-muted-foreground print:text-[9px] print:text-black/60">In active date range</span>
          </div>
          <div className="divide-y divide-border print:divide-black/15">
            {filteredData.topParties.length > 0 ? (
              filteredData.topParties.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors print:px-2.5 print:py-1.5">
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 print:text-black/60 print:text-[10px]">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground truncate print:text-black print:text-xs">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm font-mono text-foreground font-medium print:text-black print:text-xs">{formatCurrency(p.sales)}</span>
                    <span className={cn('text-[10px] font-semibold flex items-center gap-0.5 whitespace-nowrap shrink-0 print:text-[9px]', p.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-800' : 'text-rose-600 dark:text-rose-400 print:text-rose-800')}>
                      {p.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(p.growth)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground print:text-black/60">No party sales data available.</div>
            )}
          </div>
        </div>

        {/* Top Items */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm print:bg-white print:border-black/30 print:shadow-none print:rounded-lg">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between print:px-2.5 print:py-1.5 print:bg-gray-100 print:border-black/30">
            <h3 className="text-sm font-semibold text-foreground print:text-xs print:text-black">Top Items by Revenue</h3>
            <span className="text-[11px] text-muted-foreground print:text-[9px] print:text-black/60">In active date range</span>
          </div>
          <div className="divide-y divide-border print:divide-black/15">
            {filteredData.topItems.length > 0 ? (
              filteredData.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors print:px-2.5 print:py-1.5">
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 print:text-black/60 print:text-[10px]">{i + 1}</span>
                    <div className="truncate">
                      <div className="text-sm font-medium text-foreground truncate print:text-black print:text-xs">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground print:text-[8.5px] print:text-black/60 whitespace-nowrap">
                        <span>{item.qty.toLocaleString()} units</span>
                        <span className="mx-1">•</span>
                        <span className="whitespace-nowrap">Margin: {item.margin}%</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-foreground font-medium shrink-0 print:text-black print:text-xs">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground print:text-black/60">No item sales data available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Official Signatory / Verification Footer (Print Only) */}
      <div className="hidden print:flex items-end justify-between pt-6 mt-4 border-t border-black/30 text-[9px] text-black/70 print:break-inside-avoid">
        <div className="space-y-1">
          <p className="font-semibold text-black">Terms & Declarations:</p>
          <p>1. This is an authenticated computer-generated analytical report retrieved directly from the live ERP database.</p>
          <p>2. Subject to BISWANATH Jurisdiction. All values shown are in INR (₹) inclusive of applicable taxes.</p>
        </div>
        <div className="text-center min-w-[200px]">
          <div className="h-8 border-b border-dashed border-black/40"></div>
          <p className="mt-1 font-semibold text-black">Authorised Signatory</p>
          <p className="text-[8px] text-black/60">For BORGANG DRUG DISTRIBUTORS</p>
        </div>
      </div>
    </div>
  )
}
