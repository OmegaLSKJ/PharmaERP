import { TrendingUp, TrendingDown, Package, AlertTriangle, IndianRupee, ShoppingCart, Truck, Plus, ClipboardList, Zap, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCurrency, daysUntilExpiry } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { useEffect, useState, useCallback } from 'react'
import { getErp } from '../../lib/erpApi'
import { getCached } from '../../lib/erpCache'
import { usePreloaderStore } from '../../lib/erpPreloader'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'

type DashboardData = {
  kpis: { sales: number; purchases: number; activeItems: number; pendingInvoices: number }
  salesData: Array<{ month: string; sale: number; purchase: number }>
  topItems: Array<{ name: string; qty: number; amount: number }>
  recentInvoices: Array<{ id: string; party: string; amount: number; date: string; status: string }>
  expiryAlerts: Array<{ item: string; batch: string; expiry: string; qty: number }>
}
const emptyDashboard: DashboardData = { kpis: { sales: 0, purchases: 0, activeItems: 0, pendingInvoices: 0 }, salesData: [], topItems: [], recentInvoices: [], expiryAlerts: [] }

function normalizeDashboard(value: unknown): DashboardData {
  if (!value || typeof value !== 'object') {
    return { ...emptyDashboard }
  }
  const unwrapped = ('data' in value && value.data && typeof value.data === 'object' && !Array.isArray(value.data))
    ? (value as { data: unknown }).data
    : value
  const source = unwrapped && typeof unwrapped === 'object' ? (unwrapped as Partial<DashboardData>) : {}
  const sourceKpis: Partial<DashboardData['kpis']> = source.kpis && typeof source.kpis === 'object' ? source.kpis : {}
  const numberOrZero = (number: unknown) => Number.isFinite(Number(number)) ? Number(number) : 0

  return {
    kpis: {
      sales: numberOrZero(sourceKpis.sales),
      purchases: numberOrZero(sourceKpis.purchases),
      activeItems: numberOrZero(sourceKpis.activeItems),
      pendingInvoices: numberOrZero(sourceKpis.pendingInvoices),
    },
    salesData: Array.isArray(source.salesData) ? source.salesData : [],
    topItems: Array.isArray(source.topItems) ? source.topItems : [],
    recentInvoices: Array.isArray(source.recentInvoices) ? source.recentInvoices : [],
    expiryAlerts: Array.isArray(source.expiryAlerts) ? source.expiryAlerts : [],
  }
}

function formatChartMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
}

function formatChartValue(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 100000) return `₹${(value / 100000).toFixed(absolute >= 1000000 ? 0 : 1)}L`
  if (absolute >= 1000) return `₹${(value / 1000).toFixed(0)}k`
  return `₹${Math.round(value)}`
}

function SalesPurchaseTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const values = Object.fromEntries(payload.map((entry: any) => [entry.dataKey, Number(entry.value || 0)])) as Record<string, number>
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{formatChartMonth(String(label))}</p>
      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Sales · {formatCurrency(values.sale || 0)}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">Purchases · {formatCurrency(values.purchase || 0)}</p>
    </div>
  )
}

function KpiCard({ title, value, change, icon: Icon, trend, className, to }: {
  title: string; value: string; change: string; icon: React.ElementType; trend: 'up' | 'down'; className?: string; to: string
}) {
  return (
    <Link to={to} className={cn('glass-surface rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5 block cursor-pointer', className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{title}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
        <div className="p-2 rounded-md bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs">
        {trend === 'up' ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-red-500" />}
        <span className={trend === 'up' ? 'text-emerald-500' : 'text-red-500'}>{change}</span>
        <span className="text-muted-foreground">vs last month</span>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
      status === 'paid' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      status === 'pending' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      status === 'overdue' && 'bg-red-500/10 text-red-600 dark:text-red-400',
    )}>
      {status}
    </span>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>(() => {
    try {
      const cached = getCached<unknown>('dashboard')
      return cached ? normalizeDashboard(cached) : emptyDashboard
    } catch {
      return emptyDashboard
    }
  })
  const [loading, setLoading] = useState(() => !getCached('dashboard'))
  const syncStatus = usePreloaderStore((s) => s.status)
  const syncPercent = usePreloaderStore((s) => s.percent)

  const loadData = useCallback(async (force = false) => {
    try {
      if (force && !getCached('dashboard')) {
        setLoading(true)
      }
      const res = await getErp<unknown>('dashboard', undefined, { forceRefresh: force })
      if (res !== undefined && res !== null) {
        setData(normalizeDashboard(res))
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to load dashboard data:', err)
      setData((prev) => (prev && prev.kpis ? prev : emptyDashboard))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void usePreloaderStore.getState().startPreload()
    loadData()
  }, [loadData])

  useErpAutoRefresh(['dashboard', 'sales', 'purchases', 'items'], () => loadData(true))
  const currentData = (data && typeof data === 'object') ? data : emptyDashboard
  const kpis = (currentData.kpis && typeof currentData.kpis === 'object') ? currentData.kpis : emptyDashboard.kpis
  const salesData = Array.isArray(currentData.salesData) ? currentData.salesData : []
  const topItems = Array.isArray(currentData.topItems) ? currentData.topItems : []
  const recentInvoices = Array.isArray(currentData.recentInvoices) ? currentData.recentInvoices : []
  const expiryAlerts = Array.isArray(currentData.expiryAlerts) ? currentData.expiryAlerts : []
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Operations overview</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs sm:text-sm text-muted-foreground">FY 2025-26 · March 2026 · Live operational view</p>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            {syncStatus === 'syncing' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                <RefreshCw size={11} className="animate-spin" />
                <span>Caching ERP data ({syncPercent}%)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                <Zap size={11} className="fill-emerald-400/20" />
                <span>Instant Browser Cache Active</span>
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2">
          <a
            href="/transactions/sale/new"
            target="_blank"
            rel="noopener noreferrer"
            title="New sale (opens in new window)"
            className="inline-flex h-9 items-center justify-center text-center gap-2 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-3.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all duration-150 active:scale-[0.98] border border-blue-500/50"
          >
            <Plus size={15} className="shrink-0" />
            <span className="leading-none text-center">New sale</span>
          </a>
          <a
            href="/transactions/orders"
            target="_blank"
            rel="noopener noreferrer"
            title="Orders (opens in new window)"
            className="inline-flex h-9 items-center justify-center text-center gap-2 rounded-lg border border-border bg-card hover:bg-secondary px-3.5 text-xs sm:text-sm font-semibold text-foreground shadow-2xs transition-all duration-150 active:scale-[0.98]"
          >
            <ClipboardList size={15} className="shrink-0" />
            <span className="leading-none text-center">Orders</span>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard to="/transactions/sale" title="Total Sales" value={loading ? 'Loading…' : formatCurrency(kpis.sales ?? 0)} change="Live" icon={IndianRupee} trend="up" />
        <KpiCard to="/transactions/purchase" title="Total Purchases" value={loading ? 'Loading…' : formatCurrency(kpis.purchases ?? 0)} change="Live" icon={Truck} trend="up" />
        <KpiCard to="/masters/items" title="Active Items" value={loading ? '…' : String(kpis.activeItems ?? 0)} change="Live" icon={Package} trend="up" />
        <KpiCard to="/transactions/sale" title="Pending Invoices" value={loading ? '…' : String(kpis.pendingInvoices ?? 0)} change="Live" icon={ShoppingCart} trend="down" />
      </div>

      {/* Charts Row — full width on all screens */}
      <div className="data-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold">Monthly Sales vs Purchases</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Posted invoices and purchases by calendar month</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Sales</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />Purchases</span>
            </div>
          </div>
          <div className="w-full" style={{ minHeight: 260, height: 'clamp(260px, 35vw, 420px)' }}>
            {salesData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
                No posted sales or purchase invoices are available for a monthly comparison yet.
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {salesData.length < 3 && <p className="mb-2 text-xs text-muted-foreground">Showing {salesData.length} recorded month{salesData.length === 1 ? '' : 's'} — bars avoid implying a trend where data is sparse.</p>}
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barGap={6} barCategoryGap="28%">
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatChartMonth} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={58} tickFormatter={formatChartValue} />
                      <Tooltip content={<SalesPurchaseTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.45)' }} />
                      <Bar dataKey="sale" name="Sales" fill="hsl(221, 83%, 53%)" radius={[5, 5, 0, 0]} maxBarSize={56} />
                      <Bar dataKey="purchase" name="Purchases" fill="hsl(215, 16%, 47%)" radius={[5, 5, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Invoices */}
        <div className="data-surface">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Invoices</h3>
            <Link to="/transactions/sale" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {!loading && recentInvoices.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No sales have been posted yet.</div>}
            {recentInvoices.map((inv, idx) => (
              <a
                href={`/transactions/sale/edit/${encodeURIComponent(inv.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                key={`${inv.id}-${idx}`}
                title={`Open invoice ${inv.id} in new window`}
                className="flex items-center justify-between px-4 py-3 table-row-hover hover:bg-secondary/50 transition-colors"
              >
                <div>
                  <div className="text-sm font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{inv.id}</div>
                  <div className="text-xs text-muted-foreground">{inv.party}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatCurrency(inv.amount)}</div>
                  <StatusBadge status={inv.status} />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Expiry Alerts */}
        <div className="data-surface">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              Expiry Alerts
            </h3>
            <Link to="/inventory/expiry" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {!loading && expiryAlerts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No batches with expiry dates are in stock.</div>}
            {expiryAlerts.map((item) => {
              const days = daysUntilExpiry(item.expiry)
              return (
                <Link to="/inventory/expiry" key={item.batch} className="flex items-center justify-between px-4 py-3 table-row-hover hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{item.item}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.batch}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{item.qty} units</div>
                    <div className={cn(
                      'text-xs font-medium',
                      days <= 30 ? 'text-red-500' : days <= 60 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {days} days left
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="data-surface p-4">
          <h3 className="text-sm font-semibold mb-4">Top Selling Items</h3>
          {topItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground text-center px-4">
              No sales data available yet.
            </div>
          ) : (
            <div style={{ minHeight: 220, height: 'clamp(220px, 25vw, 360px)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="hsl(221, 83%, 53%)" radius={[0, 5, 5, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
