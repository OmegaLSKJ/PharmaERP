import { Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { pnl } from '../../lib/financialData'

export default function ProfitLoss() {
  const totalIncome = pnl.income.reduce((a, i) => a + i.amount, 0)
  const totalExpense = pnl.expenses.reduce((a, i) => a + i.amount, 0)
  const netProfit = totalIncome - totalExpense
  const grossProfit = 8100000 - 6500000
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Profit &amp; Loss Statement</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | 01 Apr 2025 - 31 Mar 2026</p></div>
        <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('profit-and-loss'))} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"><Download size={16} /> Export</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{l:'Gross Profit',v:formatCurrency(grossProfit),c:'text-blue-400'},{l:'Net Profit',v:formatCurrency(netProfit),c:'text-emerald-400'},{l:'Net Margin',v:(netProfit/totalIncome*100).toFixed(1)+'%',c:'text-emerald-400'},{l:'Total Income',v:formatCurrency(totalIncome),c:'text-white'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="max-w-2xl bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-5">
        <div>
          <div className="text-xs text-emerald-400 font-semibold uppercase mb-2">Income</div>
          {pnl.income.map(i => (<div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-slate-800/50"><span className="text-slate-300">{i.item}</span><span className="font-mono text-emerald-400">{formatCurrency(i.amount)}</span></div>))}
          <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-slate-700"><span className="text-white">Total Income</span><span className="font-mono text-emerald-400">{formatCurrency(totalIncome)}</span></div>
        </div>
        <div>
          <div className="text-xs text-rose-400 font-semibold uppercase mb-2">Expenses</div>
          {pnl.expenses.map(i => (<div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-slate-800/50"><span className="text-slate-300">{i.item}</span><span className="font-mono text-rose-400">{formatCurrency(i.amount)}</span></div>))}
          <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-slate-700"><span className="text-white">Total Expenses</span><span className="font-mono text-rose-400">{formatCurrency(totalExpense)}</span></div>
        </div>
        <div className={cn('flex justify-between text-xl font-bold border-t-2 border-slate-600 pt-3', netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
          <span>Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span><span>{formatCurrency(Math.abs(netProfit))}</span>
        </div>
      </div>
    </div>
  )
}
