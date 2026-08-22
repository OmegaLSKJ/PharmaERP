import { TrendingUp, TrendingDown, Package, AlertTriangle, IndianRupee, ShoppingCart, Truck, Plus, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatCurrency, daysUntilExpiry } from '../../lib/utils'
import { cn } from '../../lib/utils'

const salesData: Array<{ month: string; sale: number; purchase: number }> = []
const topItems: Array<{ name: string; qty: number; amount: number }> = []
const recentInvoices: Array<{ id: string; party: string; amount: number; date: string; status: string }> = []
const expiryAlerts: Array<{ item: string; batch: string; expiry: string; qty: number }> = []

function KpiCard({ title, value, change, icon: Icon, trend, className }: {
  title: string; value: string; change: string; icon: React.ElementType; trend: 'up' | 'down'; className?: string
}) {
  return (
    <div className={cn('glass-surface rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5', className)}>
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
    </div>
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
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight">Operations overview</h1><p className="text-sm text-muted-foreground mt-1">FY 2025-26 · March 2026 · Live operational view</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/transactions/sale/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"><Plus size={15}/> New sale</Link><Link to="/transactions/orders" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"><ClipboardList size={15}/> Orders</Link></div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Sales" value={formatCurrency(0)} change="0" icon={IndianRupee} trend="up" />
        <KpiCard title="Total Purchases" value={formatCurrency(0)} change="0" icon={Truck} trend="up" />
        <KpiCard title="Active Items" value="0" change="0" icon={Package} trend="up" />
        <KpiCard title="Pending Invoices" value="0" change="0" icon={ShoppingCart} trend="down" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Trend */}
        <div className="lg:col-span-2 data-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Sales vs Purchases</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Sales</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" />Purchases</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="sale" stroke="hsl(221, 83%, 53%)" fill="url(#saleGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="purchase" stroke="hsl(215, 20%, 65%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="data-surface p-4">
          <h3 className="text-sm font-semibold mb-4">Top Selling Items</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="data-surface">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Invoices</h3>
            <a href="/transactions/sale" className="text-xs text-primary hover:underline">View All</a>
          </div>
          <div className="divide-y divide-border">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 table-row-hover">
                <div>
                  <div className="text-sm font-mono font-medium">{inv.id}</div>
                  <div className="text-xs text-muted-foreground">{inv.party}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatCurrency(inv.amount)}</div>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
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
            <a href="/inventory/expiry" className="text-xs text-primary hover:underline">View All</a>
          </div>
          <div className="divide-y divide-border">
            {expiryAlerts.map((item) => {
              const days = daysUntilExpiry(item.expiry)
              return (
                <div key={item.batch} className="flex items-center justify-between px-4 py-3 table-row-hover">
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
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
