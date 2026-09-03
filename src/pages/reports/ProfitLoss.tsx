import { useState, useEffect, useMemo } from 'react'
import { Download, FileText, Calendar, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp } from '../../lib/erpApi'

type PeriodPreset = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export default function ProfitLoss() {
  const [sales, setSales] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Date filtering state
  const [activePeriod, setActivePeriod] = useState<PeriodPreset>('year')
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return `${fyStartYear}-04-01`
  })
  const [toDate, setToDate] = useState<string>(() => {
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return `${fyStartYear + 1}-03-31`
  })

  // Load real software entries
  const loadData = () => {
    setLoading(true)
    Promise.all([
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('purchases').catch(() => []),
      getErp<any[]>('items').catch(() => []),
      getErp<any[]>('vouchers').catch(() => [])
    ]).then(([s, p, it, v]) => {
      setSales(s || [])
      setPurchases(p || [])
      setItems(it || [])
      setVouchers(v || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Period preset switcher
  const handlePeriodChange = (period: PeriodPreset) => {
    setActivePeriod(period)
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    if (period === 'day') {
      setFromDate(todayStr)
      setToDate(todayStr)
    } else if (period === 'week') {
      const dayOfWeek = now.getDay()
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(now)
      monday.setDate(diff)
      const monStr = monday.toISOString().slice(0, 10)
      setFromDate(monStr)
      setToDate(todayStr)
    } else if (period === 'month') {
      setFromDate(`${yyyy}-${mm}-01`)
      setToDate(todayStr)
    } else if (period === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1
      setFromDate(`${yyyy}-${String(qMonth).padStart(2, '0')}-01`)
      setToDate(todayStr)
    } else if (period === 'year') {
      const fyStartYear = now.getMonth() >= 3 ? yyyy : yyyy - 1
      setFromDate(`${fyStartYear}-04-01`)
      setToDate(`${fyStartYear + 1}-03-31`)
    }
  }

  // Calculate filtered financials
  const financials = useMemo(() => {
    const isWithin = (dStr?: string) => {
      if (!dStr) return true
      const d = String(dStr).slice(0, 10)
      return d >= fromDate && d <= toDate
    }

    const filteredSales = sales.filter((s) => isWithin(s.date))
    const filteredPurchases = purchases.filter((p) => isWithin(p.date))
    const filteredVouchers = vouchers.filter((v) => isWithin(v.date))

    // 1. Sales Calculation
    let totalSalesGross = 0
    let totalSalesTaxable = 0
    let cogs = 0

    filteredSales.forEach((s) => {
      const tot = Number(s.total || s.grand_total || 0)
      totalSalesGross += tot
      const taxable = s.subtotal ? Number(s.subtotal) : tot / 1.12
      totalSalesTaxable += taxable

      // Direct cost of items sold
      ;(s.lines || []).forEach((l: any) => {
        const qty = Number(l.qty || l.quantity || 0)
        const pr = Number(l.purchaseRate || (l.rate ? l.rate * 0.8 : 0) || 0)
        cogs += qty * pr
      })
    })

    // If lines don't have explicit cost, estimate standard pharma wholesale/retail cost (78%)
    if (cogs === 0 && totalSalesTaxable > 0) {
      cogs = totalSalesTaxable * 0.8
    }

    // 2. Purchases Calculation
    let totalPurchasesGross = 0
    let totalPurchasesTaxable = 0

    filteredPurchases.forEach((p) => {
      const tot = Number(p.total || p.grand_total || 0)
      totalPurchasesGross += tot
      const taxable = p.subtotal ? Number(p.subtotal) : tot / 1.12
      totalPurchasesTaxable += taxable
    })

    // 3. Inventory Closing Stock Valuation (Asset value remaining on shelf)
    let closingStockVal = 0
    items.forEach((it) => {
      const st = Number(it.stock || 0)
      const pr = Number(it.purchaseRate || it.saleRate * 0.8 || 0)
      closingStockVal += st * pr
    })

    // If closing stock calculation is 0 but we have purchases exceeding COGS, derive remaining stock
    if (closingStockVal === 0 && totalPurchasesTaxable > cogs) {
      closingStockVal = totalPurchasesTaxable - cogs
    }

    // 4. Operating Expenses from Vouchers
    let totalOperatingExpenses = 0
    const expenseParticulars: Array<{ item: string; amount: number }> = []

    filteredVouchers.forEach((v) => {
      const amt = Number(v.amount || 0)
      if (amt > 0 && (v.voucher_type === 'payment' || v.type === 'expense')) {
        totalOperatingExpenses += amt
        expenseParticulars.push({
          item: v.narration || v.party || 'General Expense',
          amount: Math.round(amt)
        })
      }
    })

    // 5. Accounting Formulae
    // Gross Profit = Sales Revenue - Cost of Goods Sold
    const grossProfit = Math.round(totalSalesTaxable - cogs)
    const grossMargin = totalSalesTaxable > 0 ? (grossProfit / totalSalesTaxable) * 100 : 0

    // Trading Account Presentation:
    // Credit: Sales Revenue + Closing Stock
    // Debit: Purchases + Operating Expenses
    // Net Profit = (Sales Revenue + Closing Stock) - (Purchases + Operating Expenses)
    // = (Sales Revenue - (Purchases - Closing Stock)) - Operating Expenses = Gross Profit - Expenses
    const incomeItems = [
      { item: 'Sales Revenue (Net of GST)', amount: Math.round(totalSalesTaxable) }
    ]

    if (closingStockVal > 0) {
      incomeItems.push({
        item: 'Closing Stock (Inventory on Hand at Cost)',
        amount: Math.round(closingStockVal)
      })
    }

    const expenseItems = [
      { item: 'Gross Purchases (Inward Stock)', amount: Math.round(totalPurchasesTaxable) }
    ]

    if (expenseParticulars.length > 0) {
      expenseParticulars.forEach((e) => expenseItems.push(e))
    } else if (totalOperatingExpenses > 0) {
      expenseItems.push({
        item: 'Operating & Administrative Expenses',
        amount: Math.round(totalOperatingExpenses)
      })
    }

    const totalIncome = incomeItems.reduce((a, i) => a + i.amount, 0)
    const totalExpenses = expenseItems.reduce((a, e) => a + e.amount, 0)
    const netProfit = Math.round(totalIncome - totalExpenses)
    const netMargin = totalSalesTaxable > 0 ? (netProfit / totalSalesTaxable) * 100 : 0

    return {
      totalSalesGross: Math.round(totalSalesGross),
      totalSalesTaxable: Math.round(totalSalesTaxable),
      totalPurchasesTaxable: Math.round(totalPurchasesTaxable),
      cogs: Math.round(cogs),
      closingStockVal: Math.round(closingStockVal),
      grossProfit,
      grossMargin: grossMargin.toFixed(1),
      netProfit,
      netMargin: netMargin.toFixed(1),
      incomeItems,
      expenseItems,
      totalIncome,
      totalExpenses
    }
  }, [sales, purchases, items, vouchers, fromDate, toDate])

  const formatDateDisplay = (dStr: string) => {
    try {
      const parts = dStr.split('-')
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    } catch {}
    return dStr
  }

  const periodSubtitle = useMemo(() => {
    if (activePeriod === 'day') return `Day: ${formatDateDisplay(fromDate)}`
    if (activePeriod === 'week') return `Week: ${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
    if (activePeriod === 'month') return `Month: ${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
    if (activePeriod === 'quarter') return `Quarter: ${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
    if (activePeriod === 'year') return `FY: ${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
    return `Period: ${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`
  }, [activePeriod, fromDate, toDate])

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Profit & Loss Statement" subtitle={periodSubtitle} />

      {/* Screen Header */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profit &amp; Loss Statement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{periodSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 h-9 px-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-semibold shadow-xs transition border border-border cursor-pointer"
            title="Refresh transactions"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('profit-and-loss', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-primary/20 cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Period Selection & Calendar Controls */}
      <div className="no-print bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter size={13} /> Period:
            </span>
            <button
              onClick={() => handlePeriodChange('day')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activePeriod === 'day'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground'
              )}
            >
              Day (Today)
            </button>
            <button
              onClick={() => handlePeriodChange('week')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activePeriod === 'week'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground'
              )}
            >
              This Week
            </button>
            <button
              onClick={() => handlePeriodChange('month')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activePeriod === 'month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground'
              )}
            >
              This Month
            </button>
            <button
              onClick={() => handlePeriodChange('quarter')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activePeriod === 'quarter'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground'
              )}
            >
              This Quarter
            </button>
            <button
              onClick={() => handlePeriodChange('year')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activePeriod === 'year'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-foreground'
              )}
            >
              Financial Year
            </button>
          </div>

          {/* Calendar Date Pickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-secondary/40 px-2.5 py-1.5 rounded-lg border border-border">
              <Calendar size={13} className="text-muted-foreground" />
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setActivePeriod('custom')
                }}
                className="bg-card text-foreground px-2 py-0.5 rounded border border-border outline-none font-mono text-xs focus:border-indigo-600"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-secondary/40 px-2.5 py-1.5 rounded-lg border border-border">
              <Calendar size={13} className="text-muted-foreground" />
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setActivePeriod('custom')
                }}
                className="bg-card text-foreground px-2 py-0.5 rounded border border-border outline-none font-mono text-xs focus:border-indigo-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Gross Profit */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>{financials.grossProfit >= 0 ? 'Gross Profit' : 'Gross Loss'}</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
              Margin: {financials.grossMargin}%
            </span>
          </div>
          <div
            className={cn(
              'text-xl font-bold mt-1 flex items-center gap-1 font-mono',
              financials.grossProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {financials.grossProfit >= 0 ? (
              <ArrowUpRight size={18} className="text-blue-500" />
            ) : (
              <ArrowDownRight size={18} className="text-rose-500" />
            )}
            {formatCurrency(financials.grossProfit)}
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>{financials.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span
              className={cn(
                'text-[10px] font-mono font-bold',
                financials.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {financials.netProfit >= 0 ? 'Profitable' : 'Deficit'}
            </span>
          </div>
          <div
            className={cn(
              'text-xl font-bold mt-1 flex items-center gap-1 font-mono',
              financials.netProfit >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {financials.netProfit >= 0 ? (
              <ArrowUpRight size={18} className="text-emerald-500" />
            ) : (
              <ArrowDownRight size={18} className="text-rose-500" />
            )}
            {formatCurrency(financials.netProfit)}
          </div>
        </div>

        {/* Net Margin */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Net Profit Margin</div>
          <div
            className={cn(
              'text-xl font-bold mt-1 font-mono',
              Number(financials.netMargin) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {Number(financials.netMargin) > 0 ? `+${financials.netMargin}%` : `${financials.netMargin}%`}
          </div>
        </div>

        {/* Total Sales Revenue */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Sales Revenue</span>
            <span className="text-[10px] text-muted-foreground font-mono">Taxable</span>
          </div>
          <div className="text-xl font-bold mt-1 text-foreground font-mono">
            {formatCurrency(financials.totalSalesTaxable)}
          </div>
        </div>
      </div>

      {/* P&L Statement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>Trading &amp; Operating Income (Credit)</span>
            <span className="text-xs font-mono text-foreground font-bold">
              {formatCurrency(financials.totalIncome)}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                <th className="text-left px-4 py-2.5 font-semibold">Ledger Particulars</th>
                <th className="text-right px-4 py-2.5 font-semibold w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {financials.incomeItems.map((i) => (
                <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 pl-6 text-foreground font-medium">{i.item}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatCurrency(i.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-bold border-t border-border">
                <td className="px-4 py-3 text-foreground">Total Income &amp; Stock Value</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(financials.totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Expenses Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>Cost of Goods &amp; Expenses (Debit)</span>
            <span className="text-xs font-mono text-foreground font-bold">
              {formatCurrency(financials.totalExpenses)}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                <th className="text-left px-4 py-2.5 font-semibold">Ledger Particulars</th>
                <th className="text-right px-4 py-2.5 font-semibold w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {financials.expenseItems.map((i) => (
                <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 pl-6 text-foreground font-medium">{i.item}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                    {formatCurrency(i.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-bold border-t border-border">
                <td className="px-4 py-3 text-foreground">Total Cost &amp; Expenses</td>
                <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">
                  {formatCurrency(financials.totalExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Net Summary Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <tfoot>
            <tr
              className={cn(
                'font-bold text-sm bg-secondary/20',
                financials.netProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
              )}
            >
              <td className="px-4 py-3.5 text-base">
                Net {financials.netProfit >= 0 ? 'Profit' : 'Loss'} for the Period
                <span className="text-xs font-normal ml-2 opacity-80">({periodSubtitle})</span>
              </td>
              <td className="px-4 py-3.5 text-right font-mono text-xl">
                {financials.netProfit >= 0
                  ? formatCurrency(financials.netProfit)
                  : `- ${formatCurrency(Math.abs(financials.netProfit))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
