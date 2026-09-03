import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { cashFlow } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

const sum = (rows: { inflow: number; outflow: number }[]) => rows.reduce((a, r) => a + r.inflow - r.outflow, 0)

export default function CashFlow() {
  const opNet = sum(cashFlow.operating)
  const invNet = sum(cashFlow.investing)
  const finNet = sum(cashFlow.financing)
  const netChange = opNet + invNet + finNet
  const openingCash = 3190000
  const sections = [
    { title: 'Operating Activities', rows: cashFlow.operating, net: opNet, color: 'text-emerald-600 dark:text-emerald-400' },
    { title: 'Investing Activities', rows: cashFlow.investing, net: invNet, color: 'text-blue-600 dark:text-blue-400' },
    { title: 'Financing Activities', rows: cashFlow.financing, net: finNet, color: 'text-purple-600 dark:text-purple-400' },
  ]
  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Cash Flow Statement" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cash Flow Statement</h1>
          <p className="text-sm text-muted-foreground mt-1">FY 2025-26 | Indirect Method</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('cash-flow', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.title} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className={cn('text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border', s.color)}>{s.title}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                <th className="text-left px-4 py-2 font-semibold">Particulars</th>
                <th className="text-right px-4 py-2 font-semibold w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {s.rows.map((r) => (
                <tr key={r.item} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 pl-6 text-foreground">{r.item}</td>
                  <td className={cn('px-4 py-2.5 text-right font-mono font-medium', r.inflow > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {r.inflow > 0 ? '+' : '-'}{formatCurrency(Math.abs(r.inflow || r.outflow))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-bold border-t border-border">
                <td className="px-4 py-3 text-foreground">Net from {s.title}</td>
                <td className={cn('px-4 py-3 text-right font-mono', s.color)}>{formatCurrency(s.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-foreground">Cash Reconciliation</div>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-border text-foreground">
            <tr className="hover:bg-secondary/20 transition-colors">
              <td className="px-4 py-2.5 pl-6 text-muted-foreground">Opening Cash &amp; Bank</td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">{formatCurrency(openingCash)}</td>
            </tr>
            <tr className="hover:bg-secondary/20 transition-colors">
              <td className="px-4 py-2.5 pl-6 text-muted-foreground">Net Change in Cash</td>
              <td className={cn('px-4 py-2.5 text-right font-mono font-bold', netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {formatCurrency(netChange)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-secondary/30 font-bold border-t border-border text-foreground">
              <td className="px-4 py-3 text-sm">Closing Cash &amp; Bank</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(openingCash + netChange)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
