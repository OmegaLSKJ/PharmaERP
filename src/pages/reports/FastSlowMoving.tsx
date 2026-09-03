import { useState } from 'react'
import { Zap, Turtle, Printer } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'

type MovementRow = { name:string; sold:number; stock:number; days:number; value:number }
const FAST: MovementRow[] = []
const SLOW: MovementRow[] = []

export default function FastSlowMoving() {
  const [tab,setTab] = useState<'fast'|'slow'>('fast')
  const rows = tab==='fast'?FAST:SLOW
  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Fast / Slow Moving Analysis" subtitle="Movement velocity analysis for inventory & purchase planning" />
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fast / Slow Moving Items</h1>
          <p className="text-sm text-slate-400 mt-1">Movement velocity analysis for purchase planning</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-sm font-semibold shadow-xs transition border border-neutral-700 cursor-pointer"
        >
          <Printer size={15} /> Export PDF
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-4"><div className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1"><Zap size={11}/>Fast Movers (&lt; 7d cycle)</div><div className="text-xl font-bold text-white mt-1">{FAST.length} items</div></div>
        <div className="bg-slate-900/50 border border-amber-500/20 rounded-xl p-4"><div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center gap-1"><Turtle size={11}/>Slow Movers (&gt; 60d cycle)</div><div className="text-xl font-bold text-white mt-1">{SLOW.length} items</div></div>
      </div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('fast')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='fast'?'bg-emerald-600 text-white':'text-slate-400 hover:text-white')}>Fast Moving</button>
        <button onClick={()=>setTab('slow')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='slow'?'bg-amber-600 text-white':'text-slate-400 hover:text-white')}>Slow Moving</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-right px-4 py-3 font-medium">Units Sold (30d)</th><th className="text-right px-4 py-3 font-medium">Current Stock</th><th className="text-right px-4 py-3 font-medium">Cycle (days)</th><th className="text-right px-4 py-3 font-medium">Stock Value</th><th className="text-center px-4 py-3 font-medium">Velocity</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {rows.map((r,i)=>{const vel=Math.round(r.sold/(r.sold+r.stock)*100);return(<tr key={i} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{r.name}</td>
            <td className="px-4 py-3 text-right">{r.sold}</td><td className="px-4 py-3 text-right">{r.stock.toLocaleString()}</td>
            <td className={cn('px-4 py-3 text-right font-bold',tab==='fast'?'text-emerald-400':'text-amber-400')}>{r.days}d</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.value)}</td>
            <td className="px-4 py-3"><div className="flex items-center justify-center gap-2"><div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={cn('h-full',tab==='fast'?'bg-emerald-500':'bg-amber-500')} style={{width:vel+'%'}}/></div><span className="font-mono text-[10px] text-slate-400">{vel}%</span></div></td>
          </tr>)})}
        </tbody></table></div>
    </div>
  )
}
