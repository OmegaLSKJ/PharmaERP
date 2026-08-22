import { useState } from 'react'
import { Search, Download, ArrowLeftRight } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface LedgerEntry { id: string; date: string; vType: string; vNo: string; debit: number; credit: number; balance: number; narration: string; balType: string }

const PARTY_LEDGERS: Record<string, LedgerEntry[]> = {
  'MediCare Pharma': [
    { id: '1', date: '2026-03-01', vType: 'Opening', vNo: 'OPN', debit: 0, credit: 0, balance: 85000, narration: 'Opening balance', balType: 'Dr' },
    { id: '2', date: '2026-03-05', vType: 'Sale', vNo: 'SI-2026-1830', debit: 45600, credit: 0, balance: 130600, narration: 'Sale - 8 items', balType: 'Dr' },
    { id: '3', date: '2026-03-08', vType: 'Receipt', vNo: 'REC-2026-030', debit: 0, credit: 40000, balance: 90600, narration: 'NEFT received', balType: 'Dr' },
    { id: '4', date: '2026-03-12', vType: 'Sale', vNo: 'SI-2026-1836', debit: 33000, credit: 0, balance: 123600, narration: 'Sale - 6 items', balType: 'Dr' },
    { id: '5', date: '2026-03-15', vType: 'Receipt', vNo: 'REC-2026-045', debit: 0, credit: 45600, balance: 78000, narration: 'NEFT received', balType: 'Dr' },
  ],
  'Sun Pharma Industries': [
    { id: '1', date: '2026-03-01', vType: 'Opening', vNo: 'OPN', debit: 0, credit: 200000, balance: 200000, narration: 'Opening balance', balType: 'Cr' },
    { id: '2', date: '2026-03-05', vType: 'Purchase', vNo: 'PC-2026-038', debit: 0, credit: 180000, balance: 380000, narration: 'Purchase - 15 items', balType: 'Cr' },
    { id: '3', date: '2026-03-10', vType: 'Payment', vNo: 'PAY-2026-018', debit: 150000, credit: 0, balance: 230000, narration: 'NEFT payment', balType: 'Cr' },
    { id: '4', date: '2026-03-15', vType: 'Purchase', vNo: 'PC-2026-045', debit: 0, credit: 285000, balance: 515000, narration: 'Purchase - 12 items', balType: 'Cr' },
  ],
}

const ALL_LEDGERS = Object.keys(PARTY_LEDGERS)

export default function LedgerView() {
  const [selectedLedger, setSelectedLedger] = useState(ALL_LEDGERS[0])
  const [search, setSearch] = useState('')
  const entries = PARTY_LEDGERS[selectedLedger] || []
  const filtered = entries.filter(e => e.narration.toLowerCase().includes(search.toLowerCase()) || e.vNo.toLowerCase().includes(search.toLowerCase()))
  const lastBalance = filtered.length > 0 ? filtered[filtered.length - 1] : null

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ledger View</h1>
          <p className="text-sm text-slate-400 mt-1">{selectedLedger}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:colspan-1 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-3">Ledgers</div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {ALL_LEDGERS.map(l => (
              <button key={l} onClick={() => setSelectedLedger(l)} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition', selectedLedger === l ? 'bg-indigo-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="md:colspan-3 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Debit</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(entries.reduce((a, e) => a + e.debit, 0))}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Credit</div>
              <div className="text-lg font-bold text-rose-400 mt-1">{formatCurrency(entries.reduce((a, e) => a + e.credit, 0))}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Current Balance</div>
              {lastBalance && <div className={cn('text-lg font-bold mt-1', lastBalance.balType === 'Dr' ? 'text-white' : 'text-amber-400')}>{formatCurrency(lastBalance.balance)} {lastBalance.balType}</div>}
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Voucher</th>
                  <th className="text-right px-4 py-3 font-medium">Debit</th>
                  <th className="text-right px-4 py-3 font-medium">Credit</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                  <th className="text-left px-4 py-3 font-medium">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-mono text-slate-400">{e.date}</td>
                    <td className="px-4 py-3 text-slate-400">{e.vType}</td>
                    <td className="px-4 py-3 font-mono text-white">{e.vNo}</td>
                    <td className="px-4 py-3 text-right font-mono">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                    <td className={cn('px-4 py-3 text-right font-mono font-medium', e.balType === 'Dr' ? 'text-white' : 'text-amber-400')}>{formatCurrency(e.balance)} {e.balType}</td>
                    <td className="px-4 py-3 text-slate-400">{e.narration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
