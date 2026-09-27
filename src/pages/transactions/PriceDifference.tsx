import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

type Row = { id:string; inv:string; party:string; item:string; oldRate:number; newRate:number; qty:number; diff:number }

export default function PriceDifference() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setLoading(true); setError('')
    getErp<any[]>('price-differences', undefined, { forceRefresh: true })
      .then((data) => setRows((data || []).flatMap((doc:any) => (doc.details?.lines || doc.lines || []).map((line:any, index:number) => ({
        id: `${doc.id}-${index}`, inv: doc.number || doc.document_number || doc.id, party: doc.party || doc.supplier || '', item: line.name || line.item || 'Item',
        oldRate: Number(line.oldRate || line.rate || 0), newRate: Number(line.newRate || line.revisedRate || 0), qty: Number(line.qty || line.quantity || 0),
        diff: Number(line.difference || ((Number(line.newRate || line.revisedRate || 0) - Number(line.oldRate || line.rate || 0)) * Number(line.qty || line.quantity || 0)))
      })))))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Price-difference documents could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  const total = rows.reduce((sum, row) => sum + row.diff, 0)

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-foreground">Price Difference</h1><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp size={14} className="text-indigo-500"/>Live rate-difference documents from Supabase</p></div><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
    <div className="text-2xl font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(total)} <span className="text-xs font-sans text-muted-foreground">net impact</span></div>
    {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="min-w-[48rem] text-xs"><thead><tr><th>Invoice</th><th>Party</th><th>Item</th><th className="text-right">Old rate</th><th className="text-right">New rate</th><th className="text-right">Qty</th><th className="text-right">Difference</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading live documents…</td></tr> : rows.map((row) => <tr key={row.id}><td className="font-mono">{row.inv}</td><td>{row.party}</td><td>{row.item}</td><td className="text-right">{formatCurrency(row.oldRate)}</td><td className="text-right">{formatCurrency(row.newRate)}</td><td className="text-right">{row.qty}</td><td className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.diff)}</td></tr>)}{!loading && !error && !rows.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No price-difference documents have been recorded.</td></tr>}</tbody></table></div>
  </div>
}
