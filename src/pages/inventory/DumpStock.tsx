import { AlertTriangle } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const DATA = [
  { name:'Cetirizine 10mg', batch:'CTZ-2024-021', expiry:'2026-02-10', qty:120, mrp:75, rate:28 },
  { name:'Ranitidine 150mg', batch:'RAN-2025-011', expiry:'2026-03-15', qty:80, mrp:62, rate:24 },
  { name:'Paracetamol 650mg', batch:'PCM-2025-105', expiry:'2026-03-20', qty:200, mrp:90, rate:35 },
  { name:'Metformin 500mg', batch:'MTF-2025-088', expiry:'2026-04-01', qty:150, mrp:120, rate:55 },
  { name:'Cough Syrup', batch:'CSY-2024-044', expiry:'2026-01-30', qty:40, mrp:95, rate:42 },
]

export default function DumpStock() {
  const total = DATA.reduce((a,d)=>a+d.qty*d.rate,0)
  const mrpValue = DATA.reduce((a,d)=>a+d.qty*d.mrp,0)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Dump / Dead Stock Report</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400"/>Expired or unsaleable stock requiring write-off or return</p></div>
      <div className="grid grid-cols-3 gap-3">
        {[{l:'Dump Items',v:String(DATA.length),c:'text-amber-400'},{l:'Total Qty',v:DATA.reduce((a,d)=>a+d.qty,0).toLocaleString(),c:'text-white'},{l:'Purchase Value Lost',v:formatCurrency(total),c:'text-rose-400'},{l:'MRP Value Lost',v:formatCurrency(mrpValue),c:'text-rose-400'},{l:'Shortfall vs MRP',v:formatCurrency(mrpValue-total),c:'text-emerald-400'},{l:'Cost Recovery %',v:Math.round(total/mrpValue*100)+'%',c:'text-white'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">Expiry</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">MRP</th><th className="text-right px-4 py-3 font-medium">Rate</th><th className="text-right px-4 py-3 font-medium">Value Lost</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {DATA.map((d,i)=>(<tr key={i} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{d.name}</td><td className="px-4 py-3 font-mono text-slate-400">{d.batch}</td><td className="px-4 py-3 font-mono text-rose-400">{d.expiry}</td>
            <td className="px-4 py-3 text-right">{d.qty}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(d.mrp)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(d.rate)}</td>
            <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(d.qty*d.rate)}</td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
