import { Download } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { balanceSheet } from '../../lib/financialData'

export default function BalanceSheet() {
  const totalAssets = balanceSheet.assets.reduce((a, i) => a + i.amount, 0)
  const totalLiabilities = balanceSheet.liabilities.reduce((a, i) => a + i.amount, 0)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Balance Sheet</h1>
          <p className="text-sm text-slate-400 mt-1">As on 31st March 2026</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"><Download size={16} /> Export</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-blue-400 uppercase mb-4">Assets</div>
          {balanceSheet.assets.map(i => (<div key={i.item} className="flex justify-between text-sm py-2 border-b border-slate-800/50"><span className="text-slate-300">{i.item}</span><span className="font-mono text-slate-300">{formatCurrency(i.amount)}</span></div>))}
          <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t border-slate-700"><span className="text-white">Total Assets</span><span className="font-mono text-blue-400">{formatCurrency(totalAssets)}</span></div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-purple-400 uppercase mb-4">Liabilities &amp; Capital</div>
          {balanceSheet.liabilities.map(i => (<div key={i.item} className="flex justify-between text-sm py-2 border-b border-slate-800/50"><span className="text-slate-300">{i.item}</span><span className="font-mono text-slate-300">{formatCurrency(i.amount)}</span></div>))}
          <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t border-slate-700"><span className="text-white">Total Liabilities</span><span className="font-mono text-purple-400">{formatCurrency(totalLiabilities)}</span></div>
        </div>
      </div>
      <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-4 text-center">
        <span className={totalAssets === totalLiabilities ? 'text-emerald-400 font-bold text-sm' : 'text-red-400 font-bold text-sm'}>
          {totalAssets === totalLiabilities ? 'Balance Sheet is Balanced' : 'Difference: ' + formatCurrency(Math.abs(totalAssets - totalLiabilities))}
        </span>
      </div>
    </div>
  )
}
