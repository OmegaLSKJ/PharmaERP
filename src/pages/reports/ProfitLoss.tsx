import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { pnl } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

export default function ProfitLoss() {
  const totalIncome = pnl.income.reduce((a, i) => a + i.amount, 0)
  const totalExpense = pnl.expenses.reduce((a, i) => a + i.amount, 0)
  const netProfit = totalIncome - totalExpense
  const grossProfit = 8100000 - 6500000
  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Profit & Loss Statement" subtitle="FY 2025-26 | 01 Apr 2025 - 31 Mar 2026" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profit &amp; Loss Statement</h1>
          <p className="text-sm text-muted-foreground mt-1">FY 2025-26 | 01 Apr 2025 - 31 Mar 2026</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('profit-and-loss', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Gross Profit', v: formatCurrency(grossProfit), c: 'text-blue-600 dark:text-blue-400' },
          { l: 'Net Profit', v: formatCurrency(netProfit), c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Net Margin', v: ((netProfit / totalIncome) * 100).toFixed(1) + '%', c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Total Income', v: formatCurrency(totalIncome), c: 'text-foreground' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* P&L Statement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-emerald-600 dark:text-emerald-400">
            Income Particulars
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                <th className="text-left px-4 py-2 font-semibold">Ledger Particulars</th>
                <th className="text-right px-4 py-2 font-semibold w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {pnl.income.map((i) => (
                <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 pl-6 text-foreground">{i.item}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatCurrency(i.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-bold border-t border-border">
                <td className="px-4 py-3 text-foreground">Total Income</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Expenses Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-rose-600 dark:text-rose-400">
            Expense Particulars
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                <th className="text-left px-4 py-2 font-semibold">Ledger Particulars</th>
                <th className="text-right px-4 py-2 font-semibold w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {pnl.expenses.map((i) => (
                <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 pl-6 text-foreground">{i.item}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 font-medium">
                    {formatCurrency(i.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-bold border-t border-border">
                <td className="px-4 py-3 text-foreground">Total Expenses</td>
                <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalExpense)}
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
            <tr className={cn(
              'font-bold text-sm bg-secondary/20',
              netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}>
              <td className="px-4 py-3.5">Net {netProfit >= 0 ? 'Profit' : 'Loss'} for the Period</td>
              <td className="px-4 py-3.5 text-right font-mono text-lg">{formatCurrency(Math.abs(netProfit))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
