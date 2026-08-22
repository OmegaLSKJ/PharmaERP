import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface Order { id: string; orderNo: string; date: string; party: string; type: string; items: number; total: number; deliveryDate: string; status: string }

const DATA: Order[] = [
  { id: '1', orderNo: 'SO-2026-034', date: '2026-03-15', party: 'MediCare Pharma', type: 'Sale', items: 8, total: 45600, deliveryDate: '2026-03-18', status: 'confirmed' },
  { id: '2', orderNo: 'PO-2026-021', date: '2026-03-15', party: 'Sun Pharma', type: 'Purchase', items: 15, total: 285000, deliveryDate: '2026-03-20', status: 'pending' },
  { id: '3', orderNo: 'SO-2026-033', date: '2026-03-14', party: 'HealthFirst Dist.', type: 'Sale', items: 5, total: 32100, deliveryDate: '2026-03-17', status: 'dispatched' },
  { id: '4', orderNo: 'PO-2026-020', date: '2026-03-13', party: 'Cipla Ltd', type: 'Purchase', items: 10, total: 192000, deliveryDate: '2026-03-19', status: 'confirmed' },
  { id: '5', orderNo: 'SO-2026-032', date: '2026-03-12', party: 'CareWell Pharmacy', type: 'Sale', items: 3, total: 18900, deliveryDate: '2026-03-15', status: 'delivered' },
  { id: '6', orderNo: 'SO-2026-031', date: '2026-03-11', party: 'Wellness Pharma', type: 'Sale', items: 7, total: 42000, deliveryDate: '2026-03-14', status: 'delivered' },
  { id: '7', orderNo: 'PO-2026-019', date: '2026-03-10', party: 'Dr. Reddy Labs', type: 'Purchase', items: 6, total: 145000, deliveryDate: '2026-03-16', status: 'dispatched' },
  { id: '8', orderNo: 'SO-2026-030', date: '2026-03-09', party: 'LifeLine Medical', type: 'Sale', items: 12, total: 67000, deliveryDate: '2026-03-12', status: 'cancelled' },
]

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400', confirmed: 'bg-blue-500/10 text-blue-400',
  dispatched: 'bg-purple-500/10 text-purple-400', delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-rose-500/10 text-rose-400',
}

export default function Orders() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = DATA.filter(o => {
    const ms = o.party.toLowerCase().includes(search.toLowerCase()) || o.orderNo.toLowerCase().includes(search.toLowerCase())
    return ms && (typeFilter === 'all' || o.type === typeFilter) && (statusFilter === 'all' || o.status === statusFilter)
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Orders</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} orders</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
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
    </div>
  )
}