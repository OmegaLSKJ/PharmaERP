import { useState } from 'react'
import { Search, Plus, Eye, Edit2 } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface PurchaseInv { id: string; challanNo: string; invoiceNo: string; date: string; supplier: string; items: number; total: number; status: string }

const DATA: PurchaseInv[] = [
  { id: '1', challanNo: 'PC-2026-045', invoiceNo: 'SUN-INV-8921', date: '2026-03-15', supplier: 'Sun Pharma', items: 12, total: 285000, status: 'received' },
  { id: '2', challanNo: 'PC-2026-044', invoiceNo: 'CIPL-INV-4567', date: '2026-03-14', supplier: 'Cipla Ltd', items: 8, total: 192000, status: 'received' },
  { id: '3', challanNo: 'PC-2026-043', invoiceNo: 'DRR-INV-1234', date: '2026-03-13', supplier: "Dr. Reddy's Labs", items: 6, total: 145000, status: 'pending' },
  { id: '4', challanNo: 'PC-2026-042', invoiceNo: 'RAN-INV-7890', date: '2026-03-12', supplier: 'Ranbaxy Labs', items: 15, total: 340000, status: 'received' },
  { id: '5', challanNo: 'PC-2026-041', invoiceNo: 'SUN-INV-8888', date: '2026-03-11', supplier: 'Sun Pharma', items: 10, total: 220000, status: 'partial' },
]

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-400',
  partial: 'bg-blue-500/10 text-blue-400',
}

export default function PurchaseRegister() {
  const [search, setSearch] = useState('')
  const filtered = DATA.filter(s => s.supplier.toLowerCase().includes(search.toLowerCase()) || s.challanNo.toLowerCase().includes(search.toLowerCase()))
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Register</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} challans | Total: {formatCurrency(totalVal)}</p>
        </div>
        <a href="/transactions/purchase/new" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Purchase
        </a>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by challan or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Challan No</th>
              <th className="text-left px-4 py-3 font-medium">Supplier Invoice</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{s.challanNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.invoiceNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button className="p-1 hover:text-white text-slate-400"><Eye size={14} /></button>
                    <button className="p-1 hover:text-white text-slate-400"><Edit2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
