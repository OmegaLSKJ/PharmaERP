import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface Row {
  desc: string
  count: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

const ROWS: Row[] = [
  { desc: 'B2B Supplies', count: 12, taxable: 850000, cgst: 76500, sgst: 76500, igst: 0 },
  { desc: 'B2C Large Invoice (>5L)', count: 2, taxable: 1100000, cgst: 0, sgst: 0, igst: 198000 },
  { desc: 'B2C Small Invoice (<5L)', count: 48, taxable: 320000, cgst: 28800, sgst: 28800, igst: 0 },
  { desc: 'Nil Rated / Exempted', count: 5, taxable: 45000, cgst: 0, sgst: 0, igst: 0 },
  { desc: 'Export Invoices', count: 1, taxable: 650000, cgst: 0, sgst: 0, igst: 0 }
]

export default function GstrSummary() {
  const totalTaxable = ROWS.reduce((a, r) => a + r.taxable, 0)
  const totalTax = ROWS.reduce((a, r) => a + r.cgst + r.sgst + r.igst, 0)
  const totalCount = ROWS.reduce((a, r) => a + r.count, 0)

  return (
    <div className="p-6 space-y-4">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-1 Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">March 2026 | Outward supply breakdown by category</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr1-summary'))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr-summary', ROWS))}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground border border-border rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { l: 'Total Invoices', v: String(totalCount), c: 'text-foreground' },
          { l: 'Total Taxable', v: formatCurrency(totalTaxable), c: 'text-blue-600 dark:text-blue-400' },
          { l: 'Total Tax', v: formatCurrency(totalTax), c: 'text-emerald-600 dark:text-emerald-400' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* GSTR-1 Summary Grid Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Description</th>
              <th className="text-right px-4 py-3 font-semibold w-16">Count</th>
              <th className="text-right px-4 py-3 font-semibold">Taxable</th>
              <th className="text-right px-4 py-3 font-semibold">CGST</th>
              <th className="text-right px-4 py-3 font-semibold">SGST</th>
              <th className="text-right px-4 py-3 font-semibold">IGST</th>
              <th className="text-right px-4 py-3 font-semibold">Total Tax</th>
              <th className="text-right px-4 py-3 font-semibold">Invoice Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {ROWS.map((r) => (
              <tr key={r.desc} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{r.desc}</td>
                <td className="px-4 py-3 text-right font-medium">{r.count}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.taxable)}</td>
                <td className={cn('px-4 py-3 text-right font-mono', r.cgst > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                  {r.cgst > 0 ? formatCurrency(r.cgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', r.sgst > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}>
                  {r.sgst > 0 ? formatCurrency(r.sgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', r.igst > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                  {r.igst > 0 ? formatCurrency(r.igst) : '-'}
                </td>
                <td className={cn(
                  'px-4 py-3 text-right font-mono font-bold',
                  r.cgst + r.sgst + r.igst > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}>
                  {r.cgst + r.sgst + r.igst > 0 ? formatCurrency(r.cgst + r.sgst + r.igst) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                  {formatCurrency(r.taxable + r.cgst + r.sgst + r.igst)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary/30 border-t border-border text-foreground font-bold text-xs">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{totalCount}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(ROWS.reduce((a, r) => a + r.cgst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(ROWS.reduce((a, r) => a + r.sgst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(ROWS.reduce((a, r) => a + r.igst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTax)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable + totalTax)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
