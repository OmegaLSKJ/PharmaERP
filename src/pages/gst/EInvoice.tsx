import { useState, useEffect } from 'react'
import { FileCheck, Zap, RefreshCw, Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp } from '../../lib/erpApi'

type EInvoiceRow = {
  id: string
  inv: string
  party: string
  gstin: string
  date: string
  total: number
  irn: string
  status: 'generated' | 'pending' | 'failed'
}

const ST: Record<string, string> = {
  generated: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  failed: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
}

export default function EInvoice() {
  const [data, setData] = useState<EInvoiceRow[]>([])
  const [sel, setSel] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('parties').catch(() => [])
    ]).then(([sales, parties]) => {
      const partyMap = new Map((parties || []).map((p: any) => [p.name, p.gstin || '']))

      const rows: EInvoiceRow[] = (sales || []).map((s: any, idx: number) => {
        const partyGstin = s.gstin || partyMap.get(s.party) || ''
        const hasIrn = Boolean(s.irn)
        const isB2B = partyGstin && partyGstin.trim().length >= 10
        const status: 'generated' | 'pending' | 'failed' = hasIrn
          ? 'generated'
          : (isB2B ? 'pending' : 'generated')

        return {
          id: s.id || String(idx + 1),
          inv: s.number || s.invoiceNo || `SI-${idx + 1}`,
          party: s.party || 'Customer',
          gstin: partyGstin || 'Unregistered',
          date: s.date || new Date().toISOString().slice(0, 10),
          total: Number(s.total || s.grand_total || 0),
          irn: s.irn || (hasIrn ? `IRN-${s.number || idx}` : ''),
          status
        }
      })

      setData(rows)
    })
  }, [])

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const pending = data.filter((d) => d.status === 'pending' || d.status === 'failed')

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="e-Invoice (IRN) Register" subtitle="Real-time e-invoice reporting with GST Portal verification" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">e-Invoice (IRN Generation)</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time e-invoice reporting with GST Portal integration</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('e-invoices', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            disabled={sel.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition border border-emerald-500/20"
          >
            <Zap size={16} /> Generate IRN ({sel.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Pending IRN', v: String(pending.length), c: 'text-amber-600 dark:text-amber-400' },
          { l: 'Failed Submissions', v: String(data.filter((d) => d.status === 'failed').length), c: 'text-rose-600 dark:text-rose-400' },
          { l: 'Total Value', v: formatCurrency(data.reduce((a, d) => a + d.total, 0)), c: 'text-foreground' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left px-4 py-3 font-medium">Invoice</th>
              <th className="text-left px-4 py-3 font-medium">Party</th>
              <th className="text-left px-4 py-3 font-medium">GSTIN</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">IRN</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {data.map((d) => (
              <tr
                key={d.id}
                onClick={() => toggle(d.id)}
                className={cn('cursor-pointer hover:bg-secondary/40 transition-colors', sel.includes(d.id) && 'bg-primary/5')}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={sel.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    className="accent-primary h-4 w-4 rounded border-border"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-foreground font-semibold">{d.inv}</td>
                <td className="px-4 py-3 font-medium text-foreground">{d.party}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold tracking-wider text-foreground select-all">
                    {d.gstin}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(d.total)}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{d.irn ? d.irn.slice(0, 12) + '...' : '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize flex items-center gap-1 w-fit', ST[d.status])}>
                    <FileCheck size={10} />
                    {d.status}
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
