import { formatCurrency } from '../../lib/utils'

const RATIOS: Array<{ group:string; items:Array<{ name:string; value:string; formula:string; good:boolean }> }> = []

export default function RatioAnalysis() {
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Ratio Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">Financial health indicators | FY 2025-26</p></div>
      {RATIOS.map(g => (
        <div key={g.group} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80"><h3 className="text-sm font-semibold text-white">{g.group}</h3></div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {g.items.map(r => (<tr key={r.name} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                <td className="px-4 py-3 text-slate-500">{r.formula}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-lg"><span className={r.good ? 'text-emerald-400' : 'text-amber-400'}>{r.value}</span></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
