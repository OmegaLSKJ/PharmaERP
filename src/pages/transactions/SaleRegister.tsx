import { useState } from 'react'
import { Search, Plus, Eye, Edit2 } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface SaleInv { id: string; invoiceNo: string; date: string; customer: string; items: number; total: number; status: string }

const DATA: SaleInv[] = [
  { id: '1', invoiceNo: 'SI-2026-1842', date: '2026-03-15', customer: 'MediCare Pharma', items: 8, total: 45600, status: 'paid' },
  { id: '2', invoiceNo: 'SI-2026-1841', date: '2026-03-15', customer: 'HealthFirst Distributors', items: 5, total: 32100, status: 'pending' },
  { id: '3', invoiceNo: 'SI-2026-1840', date: '2026-03-14', customer: 'CareWell Pharmacy', items: 3, total: 18900, status: 'paid' },
  { id: '4', invoiceNo: 'SI-2026-1839', date: '2026-03-14', customer: 'LifeLine Medical', items: 12, total: 67000, status: 'overdue' },
  { id: '5', invoiceNo: 'SI-2026-1838', date: '2026-03-13', customer: 'PharmaPlus Retail', items: 4, total: 23400, status: 'paid' },
  { id: '6', invoiceNo: 'SI-2026-1837', date: '2026-03-13', customer: 'Wellness Pharma Chain', items: 7, total: 42000, status: 'partial' },
  { id: '7', invoiceNo: 'SI-2026-1836', date: '2026-03-12', customer: 'MediCare Pharma', items: 6, total: 33000, status: 'paid' },
  { id: '8', invoiceNo: 'SI-2026-1835', date: '2026-03-12', customer: 'CareWell Pharmacy', items: 9, total: 60000, status: 'paid' },
  { id: '9', invoiceNo: 'SI-2026-1834', date: '2026-03-11', customer: 'HealthFirst Distributors', items: 2, total: 10000, status: 'pending' },
  { id: '10', invoiceNo: 'SI-2026-1833', date: '2026-03-11', customer: 'LifeLine Medical', items: 11, total: 50000, status: 'paid' },
]

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-400', pending: 'bg-amber-500/10 text-amber-400',
  overdue: 'bg-rose-500/10 text-rose-400', partial: 'bg-blue-500/10 text-blue-400',
}

export default function SaleRegister() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = DATA.filter(s => {
    const ms = s.customer.toLowerCase().includes(search.toLowerCase()) || s.invoiceNo.toLowerCase().includes(search.toLowerCase())
    const mf = statusFilter === 'all' || s.status === statusFilter
    return ms && mf
  })
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sale Register</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} invoices &bull; Total: {formatCurrency(totalVal)}</p>
        </div>
        <a href="/transactions/sale/new" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Sale
        </a>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by invoice or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden">
          {['all', 'paid', 'pending', 'overdue', 'partial'].map(t => (
            <button key={t} onClick={() => setStatusFilter(t)} className={cn('px-3 py-1.5 text-xs font-semibold capitalize transition', statusFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white')}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Invoice No</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Customer</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{s.invoiceNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.customer}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>{s.status}</span></td>
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
