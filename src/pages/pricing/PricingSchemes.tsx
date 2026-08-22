import { useState } from 'react'
import { Tag, Percent, Gift } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const ITEMS: Array<{ name:string; packing:string; mrp:number; purc:number; sale:number; margin:number; scheme:string; disc:number }> = []

export default function PricingSchemes() {
  const [tab,setTab] = useState<'rates'|'schemes'>('rates')
  const avgMargin = ITEMS.length ? Math.round(ITEMS.reduce((a,i)=>a+i.margin,0)/ITEMS.length) : 0
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Pricing / Schemes / Margins</h1>
        <p className="text-sm text-slate-400 mt-1">Rate lists, scheme deals & margin analysis</p></div>
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1 text-slate-400"><Tag size={14} /> Avg Margin: <b className={avgMargin>=45?'text-emerald-400':'text-amber-400'}>{avgMargin}%</b></span>
          <span className="flex items-center gap-1 text-slate-400"><Gift size={14} /> Active Schemes: <b className="text-purple-400">{ITEMS.filter(i=>i.scheme!=='-').length}</b></span>
        </div>
      </div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('rates')} className={cn('px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition',tab==='rates'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}><Percent size={14}/> Rate List</button>
        <button onClick={()=>setTab('schemes')} className={cn('px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition',tab==='schemes'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}><Gift size={14}/> Schemes</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Packing</th>
          {tab==='rates'?<><th className="text-right px-4 py-3 font-medium">MRP</th><th className="text-right px-4 py-3 font-medium">Purchase</th><th className="text-right px-4 py-3 font-medium">Sale</th><th className="text-right px-4 py-3 font-medium">Margin %</th></>:<><th className="text-left px-4 py-3 font-medium">Scheme</th><th className="text-right px-4 py-3 font-medium">Discount %</th><th className="text-left px-4 py-3 font-medium">Type</th></>}
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {ITEMS.map(i=>(<tr key={i.name} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{i.name}</td><td className="px-4 py-3 text-slate-400">{i.packing}</td>
            {tab==='rates'?<>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(i.mrp)}</td>
              <td className="px-4 py-3 text-right font-mono text-rose-400">{formatCurrency(i.purc)}</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(i.sale)}</td>
              <td className="px-4 py-3 text-right font-bold"><span className={cn('px-2 py-0.5 rounded',i.margin>=50?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400')}>{i.margin}%</span></td>
            </>:<>
              <td className="px-4 py-3 font-mono text-purple-400">{i.scheme}</td>
              <td className="px-4 py-3 text-right">{i.disc}%</td>
              <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',i.scheme!=='-'?'bg-purple-500/10 text-purple-400':'bg-slate-700/50 text-slate-400')}>{i.scheme!=='-'?'Scheme + Discount':'Discount only'}</span></td>
            </>}
          </tr>))}
        </tbody>
      </table></div>
    </div>
  )
}
