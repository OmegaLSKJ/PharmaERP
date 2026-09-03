import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

const TABLES = [
  { no: '4', title: 'Outward Supplies (Auto from GSTR-1)', taxable: 0, tax: 0, status: 'review' },
  { no: '5', title: 'Inward Supplies (Auto from GSTR-2A)', taxable: 0, tax: 0, status: 'review' },
  { no: '6', title: 'Amendments', taxable: 0, tax: 0, status: 'review' },
  { no: '7', title: 'ITC Reversal / Adjustment', taxable: 0, tax: 0, status: 'review' },
  { no: '8', title: 'ITC Summary (Books vs 2A vs 2B)', taxable: 0, tax: 0, status: 'review' },
  { no: '10', title: 'Supplies through E-commerce', taxable: 0, tax: 0, status: 'review' },
]

export default function Gstr9() {
  const totalTaxable = TABLES.reduce((a, t) => a + t.taxable, 0)
  const totalTax = TABLES.reduce((a, t) => a + t.tax, 0)
  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="GSTR-9 Annual Return" subtitle="FY 2025-26 | Consolidated Annual GST Return" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-9 (Annual Return)</h1>
          <p className="text-sm text-muted-foreground mt-1">FY 2025-26 | Consolidated annual GST return</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr9-annual-return', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr9-filing', TABLES))}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground border border-border rounded-lg text-sm font-semibold shadow-sm transition"
            title="Download JSON schema for government portal upload"
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { l: 'Total Taxable', v: formatCurrency(totalTaxable), c: 'text-blue-600 dark:text-blue-400' },
          { l: 'Total Tax', v: formatCurrency(totalTax), c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Tables Ready', v: TABLES.filter((t) => t.status !== 'review').length + '/' + TABLES.length, c: 'text-foreground' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Main Tables Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="w-16 text-left px-4 py-3 font-medium">Table</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Taxable Value</th>
              <th className="text-right px-4 py-3 font-medium">Tax Amount</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {TABLES.map((t) => (
              <tr key={t.no} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-primary">{t.no}</td>
                <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                <td className="px-4 py-3 text-right font-mono">{t.taxable > 0 ? formatCurrency(t.taxable) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono">{t.tax > 0 ? formatCurrency(t.tax) : '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold capitalize',
                    t.status === 'auto-filled'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : t.status === 'manual'
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  )}>
                    {t.status.replace('-', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
