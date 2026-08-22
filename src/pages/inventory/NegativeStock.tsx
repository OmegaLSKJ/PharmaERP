import { AlertOctagon } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect, useState } from 'react'
import { getErp } from '../../lib/erpApi'

const DATA: Array<{ name:string; batch:string; location:string; qty:number; rate:number }> = []

export default function NegativeStock() {
  const [data,setData]=useState<typeof DATA>([])
  useEffect(() => {
    getErp<any[]>('report-stock').then((rows) => setData(rows
      .filter((row) => Number(row.qty) < 0)
      .map((row) => ({ ...row, rate: Number(row.rate ?? 0) }))))
  }, [])
  const total = data.reduce((a,d)=>a+Math.abs(d.qty*d.rate),0)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Negative Stock Report</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><AlertOctagon size={14} className="text-rose-400"/>Items sold beyond available batch quantity — needs adjustment</p></div>
      <div className="grid grid-cols-3 gap-3">
        {[{l:'Negative Items',v:String(data.length),c:'text-rose-400'},{l:'Locations Affected',v:String(new Set(data.map(d=>d.location)).size),c:'text-white'},{l:'Value to Adjust',v:formatCurrency(total),c:'text-amber-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">Location</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Rate</th><th className="text-right px-4 py-3 font-medium">Shortfall Value</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {data.map((d,i)=>(<tr key={i} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{d.name}</td><td className="px-4 py-3 font-mono text-slate-400">{d.batch}</td><td className="px-4 py-3">{d.location}</td>
            <td className="px-4 py-3 text-right font-bold text-rose-400">{d.qty}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(d.rate)}</td>
            <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(Math.abs(d.qty*d.rate))}</td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
