import { useState } from 'react'
import { Zap, Turtle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'

const FAST = [
  { name:'Dolo 650', sold:450, stock:1200, days:3.2, value:20250 },
  { name:'Cetirizine 10mg', sold:290, stock:850, days:4.1, value:8120 },
  { name:'Paracetamol 650mg', sold:380, stock:1100, days:5.5, value:13300 },
  { name:'Pantoprazole 40mg', sold:210, stock:640, days:6.8, value:14280 },
]
const SLOW = [
  { name:'Ibuprofen 400mg', sold:12, stock:640, days:95, value:20480 },
  { name:'Ranitidine 150mg', sold:8, stock:480, days:140, value:11520 },
  { name:'Domperidone 10mg', sold:15, stock:520, days:88, value:16120 },
]

export default function FastSlowMoving() {
  const [tab,setTab] = useState<'fast'|'slow'>('fast')
  const rows = tab==='fast'?FAST:SLOW
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Fast / Slow Moving Items</h1>
        <p className="text-sm text-slate-400 mt-1">Movement velocity analysis for purchase planning</p></div>
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
