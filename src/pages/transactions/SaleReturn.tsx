import { useState } from 'react'
import { Search, Plus, Eye } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface ReturnEntry { id: string; returnNo: string; date: string; party: string; origInvoice: string; items: number; total: number; reason: string; status: string }

const DATA: ReturnEntry[] = [
  { id: '1', returnNo: 'SR-2026-012', date: '2026-03-15', party: 'MediCare Pharma', origInvoice: 'SI-2026-1830', items: 3, total: 8400, reason: 'Expired stock', status: 'processed' },
  { id: '2', returnNo: 'SR-2026-011', date: '2026-03-14', party: 'CareWell Pharmacy', origInvoice: 'SI-2026-1825', items: 2, total: 5200, reason: 'Damaged', status: 'pending' },
  { id: '3', returnNo: 'SR-2026-010', date: '2026-03-12', party: 'HealthFirst Distributors', origInvoice: 'SI-2026-1820', items: 5, total: 12800, reason: 'Wrong item', status: 'processed' },
  { id: '4', returnNo: 'SR-2026-009', date: '2026-03-10', party: 'LifeLine Medical', origInvoice: 'SI-2026-1815', items: 1, total: 3600, reason: 'Near expiry', status: 'rejected' },
]

const STATUS_STYLE: Record<string, string> = {
  processed: 'bg-emerald-500/10 text-emerald-400', pending: 'bg-amber-500/10 text-amber-400', rejected: 'bg-rose-500/10 text-rose-400',
}

export default function SaleReturn() {
  const [search, setSearch] = useState('')
  const filtered = DATA.filter(s => s.party.toLowerCase().includes(search.toLowerCase()) || s.returnNo.toLowerCase().includes(search.toLowerCase()))
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sale Returns</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} returns | Total: {formatCurrency(totalVal)}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Return
        </button>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by return no or party..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Return No</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Party</th>
              <th className="text-left px-4 py-3 font-medium">Orig. Invoice</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{s.returnNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.party}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.origInvoice}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-rose-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3 text-slate-400">{s.reason}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-right"><button className="p-1 hover:text-white text-slate-400"><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
