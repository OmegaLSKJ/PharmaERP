import { useState } from 'react'
import { Search, Plus, Eye } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface ReturnEntry { id: string; returnNo: string; date: string; supplier: string; origChallan: string; items: number; total: number; reason: string; status: string }

const STATUS_STYLE: Record<string, string> = {
  processed: 'bg-emerald-500/10 text-emerald-400', pending: 'bg-amber-500/10 text-amber-400',
}

export default function PurchaseReturn() {
  const [returns, setReturns] = useState<ReturnEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [origChallan, setOrigChallan] = useState('')
  const [reason, setReason] = useState('')
  const [items, setItems] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const showToast = useUIStore((s) => s.showToast)
  const load = () => getErp<any[]>('purchase-returns').then((rows) => setReturns(rows.map((row) => ({ id:row.id, returnNo:row.number, date:row.date, supplier:row.party, origChallan:row.origChallan ?? '', items:Number(row.items ?? 0), total:Number(row.total), reason:row.reason ?? '', status:row.status })))).catch((e) => showToast(e.message))
  useEffect(() => { void load() }, [showToast])
  const filtered = returns.filter(s => s.supplier.toLowerCase().includes(search.toLowerCase()) || s.returnNo.toLowerCase().includes(search.toLowerCase()))
  const saveReturn = async (e: React.FormEvent) => { e.preventDefault(); try { await postErp('purchase-returns', { party:supplier, partyType:'supplier', origChallan, reason, items, total, status:'processed' }); setShowForm(false); setSupplier(''); setOrigChallan(''); setReason(''); setTotal(0); await load(); showToast('Purchase return recorded.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save return.') } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Returns</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} returns</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Return
        </button>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Return No</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Orig. Challan</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{s.returnNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.origChallan}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-rose-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3 text-slate-400">{s.reason}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><form onSubmit={saveReturn} className="glass-surface w-full max-w-lg space-y-4 rounded-xl p-6"><div className="flex justify-between"><h2 className="text-lg font-semibold">New purchase return</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><label className="grid gap-1 text-sm">Supplier<input required autoFocus value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Original purchase / challan<input required value={origChallan} onChange={(e) => setOrigChallan(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Reason<input required value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Items<input type="number" min="1" value={items} onChange={(e) => setItems(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Return value<input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label></div><button className="w-full rounded-lg bg-blue-700 p-2.5 font-semibold text-white">Post purchase return</button></form></div>}
    </div>
  )
}
