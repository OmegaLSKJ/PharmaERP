import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

type Delivery = { id:string; order:string; customer:string; items:number; total:number; transport:string; status:string }
const colors: Record<string,string> = { draft:'text-amber-400', dispatched:'text-blue-400', delivered:'text-emerald-400', cancelled:'text-rose-400' }

export default function DeliveryManagement() {
  const [rows, setRows] = useState<Delivery[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getErp<any[]>('challans')
      .then((data) => setRows((data || []).map((row) => ({
        id: String(row.dbId || row.id), order: row.number || row.id, customer: row.party || '',
        items: (row.lines || []).reduce((n:number,line:any) => n + Number(line.qty || 0), 0),
        total: (row.lines || []).reduce((n:number,line:any) => n + Number(line.qty || 0) * Number(line.rate || 0), 0),
        transport: row.transport || '—', status: row.status || 'draft',
      }))))
      .finally(() => setLoading(false))
  }, [])
  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)
  return <div className="p-6 space-y-4"><div><h1 className="text-2xl font-bold tracking-tight text-white">Delivery Management</h1><p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Truck size={14} className="text-cyan-400" />Live delivery challans from Supabase</p></div><div className="flex gap-2 flex-wrap">{['all','draft','dispatched','delivered','cancelled'].map((value) => <button key={value} onClick={() => setFilter(value)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize', filter === value ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400')}>{value}</button>)}</div><div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 text-slate-400 uppercase"><th className="text-left p-3">Challan</th><th className="text-left p-3">Customer</th><th className="text-right p-3">Items</th><th className="text-right p-3">Total</th><th className="text-left p-3">Transport</th><th className="text-left p-3">Status</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading live challans…</td></tr> : visible.map((row) => <tr key={row.id} className="border-t border-slate-800"><td className="p-3 font-mono text-white">{row.order}</td><td className="p-3">{row.customer}</td><td className="p-3 text-right">{row.items}</td><td className="p-3 text-right font-mono">{formatCurrency(row.total)}</td><td className="p-3">{row.transport}</td><td className={cn('p-3 capitalize font-semibold', colors[row.status] || 'text-slate-300')}>{row.status}</td></tr>)}{!loading && !visible.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No delivery challans match this view.</td></tr>}</tbody></table></div></div>
}
