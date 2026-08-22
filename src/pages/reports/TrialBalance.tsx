import { Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { trialBalance } from '../../lib/financialData'

export default function TrialBalance() {
  const totalDr = trialBalance.reduce((a, r) => a + r.debit, 0)
  const totalCr = trialBalance.reduce((a, r) => a + r.credit, 0)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Trial Balance</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | As on 31st March 2026</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"><Download size={16} /> Export</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Ledger</th><th className="text-left px-4 py-3 font-medium">Group</th><th className="text-right px-4 py-3 font-medium">Debit</th><th className="text-right px-4 py-3 font-medium">Credit</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {trialBalance.map((r, i) => (<tr key={i} className="hover:bg-slate-900/30">
              <td className="px-4 py-2 font-medium text-white">{r.ledger}</td><td className="px-4 py-2 text-slate-400">{r.group}</td>
              <td className="px-4 py-2 text-right font-mono">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
              <td className="px-4 py-2 text-right font-mono">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
            </tr>))}
          </tbody>
          <tfoot><tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold">
            <td colSpan={2} className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalDr)}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalCr)}</td>
          </tr></tfoot>
        </table>
        <div className="px-4 py-2 text-right">
          <span className={cn('text-xs font-bold', totalDr === totalCr ? 'text-emerald-400' : 'text-rose-400')}>{totalDr === totalCr ? 'Balanced' : 'Difference: ' + formatCurrency(Math.abs(totalDr - totalCr))}</span>
        </div>
      </div>
    </div>
  )
}
