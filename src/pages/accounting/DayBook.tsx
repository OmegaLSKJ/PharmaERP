import { useState } from 'react'
import { Search, Download, Filter, Eye } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp } from '../../lib/erpApi'
import { exportVisibleTables } from '../../lib/download'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface DayBookEntry { id: string; date: string; vType: string; vNo: string; ledger: string; debit: number; credit: number; narration: string }

const TYPE_STYLE: Record<string, string> = {
  Receipt: 'bg-emerald-500/10 text-emerald-400', Payment: 'bg-rose-500/10 text-rose-400',
  Sale: 'bg-blue-500/10 text-blue-400', Purchase: 'bg-purple-500/10 text-purple-400',
  Journal: 'bg-amber-500/10 text-amber-400', Contra: 'bg-cyan-500/10 text-cyan-400',
}

export default function DayBook() {
  const [entries, setEntries] = useState<DayBookEntry[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const types = ['all', 'Receipt', 'Payment', 'Sale', 'Purchase', 'Journal', 'Contra']

  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { getErp<any[]>('ledgers').then((rows) => setEntries(rows.map((row) => ({ id: row.id, date: row.date, vType: String(row.vType).replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), vNo: row.vNo, ledger: row.party, debit: Number(row.debit), credit: Number(row.credit), narration: row.narration })))).catch((e) => showToast(e.message)) }, [showToast])
  const filtered = entries.filter(d => {
    const ms = d.ledger.toLowerCase().includes(search.toLowerCase()) || d.vNo.toLowerCase().includes(search.toLowerCase()) || d.narration.toLowerCase().includes(search.toLowerCase())
    return ms && (typeFilter === 'all' || d.vType === typeFilter)
  })

  const totalDr = filtered.reduce((a, d) => a + d.debit, 0)
  const totalCr = filtered.reduce((a, d) => a + d.credit, 0)

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Day Book" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Day Book</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} entries | March 2026</p>
        </div>
        <button onClick={() => exportVisibleTables('day-book')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search ledger, voucher, narration..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        {types.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition', typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Voucher No</th>
              <th className="text-left px-4 py-3 font-medium">Ledger</th>
              <th className="text-right px-4 py-3 font-medium">Debit</th>
              <th className="text-right px-4 py-3 font-medium">Credit</th>
              <th className="text-left px-4 py-3 font-medium">Narration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-slate-400">{d.date}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TYPE_STYLE[d.vType])}>{d.vType}</span></td>
                <td className="px-4 py-3 font-mono text-white">{d.vNo}</td>
                <td className="px-4 py-3 font-medium text-white">{d.ledger}</td>
                <td className="px-4 py-3 text-right font-mono">{d.debit > 0 ? formatCurrency(d.debit) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono">{d.credit > 0 ? formatCurrency(d.credit) : '-'}</td>
                <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{d.narration}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold text-xs">
              <td colSpan={4} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalDr)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalCr)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
