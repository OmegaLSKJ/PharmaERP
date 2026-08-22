import { Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { cashFlow } from '../../lib/financialData'

const sum = (rows: { inflow: number; outflow: number }[]) => rows.reduce((a, r) => a + r.inflow - r.outflow, 0)

export default function CashFlow() {
  const opNet = sum(cashFlow.operating)
  const invNet = sum(cashFlow.investing)
  const finNet = sum(cashFlow.financing)
  const netChange = opNet + invNet + finNet
  const openingCash = 3190000
  const sections = [
    { title: 'Operating Activities', rows: cashFlow.operating, net: opNet, color: 'text-emerald-400' },
    { title: 'Investing Activities', rows: cashFlow.investing, net: invNet, color: 'text-blue-400' },
    { title: 'Financing Activities', rows: cashFlow.financing, net: finNet, color: 'text-purple-400' },
  ]
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Cash Flow Statement</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | Indirect Method</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"><Download size={16} /> Export</button>
      </div>
      {sections.map(s => (
        <div key={s.title} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className={cn('text-sm font-semibold uppercase mb-3', s.color)}>{s.title}</div>
          {s.rows.map(r => (<div key={r.item} className="flex justify-between text-sm py-1.5 border-b border-slate-800/50">
            <span className="text-slate-300">{r.item}</span>
            <span className={cn('font-mono', r.inflow > 0 ? 'text-emerald-400' : 'text-rose-400')}>{r.inflow > 0 ? '+' : '-'}{formatCurrency(Math.abs(r.inflow || r.outflow))}</span>
          </div>))}
          <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-slate-700"><span className="text-white">Net from {s.title}</span><span className={cn('font-mono', s.color)}>{formatCurrency(s.net)}</span></div>
        </div>
      ))}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
        <div className="flex justify-between text-sm py-1"><span className="text-slate-300">Opening Cash &amp; Bank</span><span className="font-mono text-white">{formatCurrency(openingCash)}</span></div>
        <div className="flex justify-between text-sm py-1"><span className="text-slate-300">Net Change in Cash</span><span className={cn('font-mono font-bold', netChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatCurrency(netChange)}</span></div>
        <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-700"><span className="text-white">Closing Cash &amp; Bank</span><span className="font-mono text-emerald-400">{formatCurrency(openingCash + netChange)}</span></div>
      </div>
    </div>
  )
}
