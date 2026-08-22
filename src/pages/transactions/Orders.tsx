import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface Order { id: string; orderNo: string; date: string; party: string; type: string; items: number; total: number; deliveryDate: string; status: string }

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400', confirmed: 'bg-blue-500/10 text-blue-400',
  dispatched: 'bg-purple-500/10 text-purple-400', delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-rose-500/10 text-rose-400',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [showForm, setShowForm] = useState(false)
  const [orderType, setOrderType] = useState('Sale')
  const [party, setParty] = useState('')
  const [items, setItems] = useState(1)
  const [total, setTotal] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const showToast = useUIStore((s) => s.showToast)
  const load = () => getErp<any[]>('orders').then((rows) => setOrders(rows.map((row) => ({ id:row.id, orderNo:row.number, date:row.date, party:row.party, type:row.type ?? 'Sale', items:Number(row.items ?? 0), total:Number(row.total), deliveryDate:row.deliveryDate ?? '', status:row.status })))).catch((e) => showToast(e.message))
  useEffect(() => { void load() }, [showToast])
  const filtered = orders.filter(o => {
    const ms = o.party.toLowerCase().includes(search.toLowerCase()) || o.orderNo.toLowerCase().includes(search.toLowerCase())
    return ms && (typeFilter === 'all' || o.type === typeFilter) && (statusFilter === 'all' || o.status === statusFilter)
  })
  const saveOrder = async (e: React.FormEvent) => { e.preventDefault(); try { await postErp('orders', { party, partyType:orderType === 'Purchase' ? 'supplier' : 'customer', type:orderType, items, total, deliveryDate, status:'pending' }); setShowForm(false); setParty(''); setTotal(0); await load(); showToast('Order saved.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save order.') } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Orders</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} orders</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Order
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        {['all', 'Sale', 'Purchase'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition', typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{t === 'all' ? 'All' : t}</button>
        ))}
        {['all', 'pending', 'confirmed', 'dispatched', 'delivered'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition', statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{s}</button>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Order No</th>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-left px-4 py-3 font-medium">Party</th>
            <th className="text-right px-4 py-3 font-medium">Items</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-left px-4 py-3 font-medium">Delivery</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{o.orderNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{o.date}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', o.type === 'Sale' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400')}>{o.type}</span></td>
                <td className="px-4 py-3 font-medium text-white">{o.party}</td>
                <td className="px-4 py-3 text-right">{o.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(o.total)}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{o.deliveryDate}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[o.status])}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><form onSubmit={saveOrder} className="glass-surface w-full max-w-lg space-y-4 rounded-xl p-6"><div className="flex justify-between"><h2 className="text-lg font-semibold">New order</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><label className="grid gap-1 text-sm">Order type<select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="rounded-lg border border-input bg-background p-2"><option>Sale</option><option>Purchase</option></select></label><label className="grid gap-1 text-sm">Party<input required autoFocus value={party} onChange={(e) => setParty(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Delivery date<input required type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Items<input type="number" min="1" value={items} onChange={(e) => setItems(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Order value<input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label></div><button className="w-full rounded-lg bg-blue-700 p-2.5 font-semibold text-white">Save order</button></form></div>}
    </div>
  )
}
