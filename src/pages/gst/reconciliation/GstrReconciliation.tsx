import React, { useState } from 'react'
import { Download, CheckCircle, AlertTriangle, XCircle, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'
import PrintHeader from '../../../components/layout/PrintHeader'
import { useUIStore } from '../../../store/uiStore'

type ReconRow = {
  id: string
  inv: string
  sup: string
  d: string
  tax: number
  gst: number
  tot: number
  mb: 'Matched' | 'Mismatch' | 'Missing'
  ga: 'Matched' | 'Mismatch' | 'Missing'
}

const DATA: ReconRow[] = [
  { id: '1', inv: 'PUR/2026/102', sup: 'Cipla Laboratories', d: '2026-08-01', tax: 85000, gst: 15300, tot: 100300, mb: 'Matched', ga: 'Matched' },
  { id: '2', inv: 'PUR/2026/103', sup: 'Astra Bio Pharma', d: '2026-08-03', tax: 120000, gst: 21600, tot: 141600, mb: 'Mismatch', ga: 'Matched' },
  { id: '3', inv: 'PUR/2026/104', sup: 'Sun Diagnostics', d: '2026-08-07', tax: 45000, gst: 8100, tot: 53100, mb: 'Matched', ga: 'Matched' },
  { id: '4', inv: 'PUR/2026/105', sup: 'Dr. Reddy Labs Ltd', d: '2026-08-10', tax: 950000, gst: 171000, tot: 1121000, mb: 'Matched', ga: 'Missing' },
  { id: '5', inv: 'PUR/2026/106', sup: 'Lupin Pharma Corp', d: '2026-08-12', tax: 350000, gst: 63000, tot: 413000, mb: 'Matched', ga: 'Matched' }
]

const SC: Record<string, string> = {
  Matched: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Mismatch: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Missing: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
}

const IC: Record<string, React.ReactNode> = {
  Matched: <CheckCircle size={12} />,
  Mismatch: <AlertTriangle size={12} />,
  Missing: <XCircle size={12} />
}

export default function GstrReconciliation() {
  const [f, setF] = useState<'all' | 'mismatched'>('all')
  const m = DATA.filter((d) => d.mb === 'Matched' && d.ga === 'Matched').length
  const mm = DATA.filter((d) => d.mb !== d.ga).length
  const fl = f === 'all' ? DATA : DATA.filter((d) => d.mb !== d.ga)
  const matchRate = DATA.length > 0 ? Math.round((m / DATA.length) * 100) + '%' : '0%'

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="GSTR-2A / 2B Reconciliation" subtitle="Audit Comparison: Purchase Books vs. GST Portal Data" />
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-2A / 2B Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">Match purchase books with portal data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr-reconciliation', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total', v: DATA.length, c: 'text-foreground' },
          { l: 'Matched', v: m, c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Mismatched', v: mm, c: 'text-amber-600 dark:text-amber-400' },
          { l: 'Rate', v: matchRate, c: 'text-foreground font-bold' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'mismatched'] as const).map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition border',
              f === x
                ? 'bg-primary text-primary-foreground border-primary/20 shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {x}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Invoice</th>
              <th className="text-left px-4 py-3 font-semibold">Supplier</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-right px-4 py-3 font-semibold">Taxable</th>
              <th className="text-right px-4 py-3 font-semibold">Tax</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-left px-4 py-3 font-semibold">My Books</th>
              <th className="text-left px-4 py-3 font-semibold">GSTR-2A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {fl.map((d) => (
              <tr key={d.id} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3 font-mono text-foreground font-semibold">{d.inv}</td>
                <td className="px-4 py-3 font-medium text-foreground">{d.sup}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{d.d}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.tax)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.gst)}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{formatCurrency(d.tot)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1.5', SC[d.mb])}>
                    {IC[d.mb]} {d.mb}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1.5', SC[d.ga])}>
                    {IC[d.ga]} {d.ga}
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
