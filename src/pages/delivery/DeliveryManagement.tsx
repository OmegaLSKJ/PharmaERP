import { useState } from 'react'
import { Truck } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const DATA: Array<{ id:string; order:string; cust:string; items:number; total:number; dispatch:string; deliver:string; transport:string; status:string; track:string }> = []
const ST: Record<string,string> = { pending:'bg-amber-500/10 text-amber-400',dispatched:'bg-blue-500/10 text-blue-400',delivered:'bg-emerald-500/10 text-emerald-400' }

export default function DeliveryManagement() {
  const [f,setF] = useState('all')
  const fl = f==='all'?DATA:DATA.filter(d=>d.status===f)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Delivery Management</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Truck size={14} className="text-cyan-400" />{fl.length} orders | Track dispatch and delivery</p></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{l:'Pending',c:DATA.filter(d=>d.status==='pending').length,cl:'text-amber-400'},{l:'In Transit',c:DATA.filter(d=>d.status==='dispatched').length,cl:'text-blue-400'},{l:'Delivered',c:DATA.filter(d=>d.status==='delivered').length,cl:'text-emerald-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center"><div className="text-xs text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-2xl font-bold mt-1',s.cl)}>{s.c}</div></div>
        ))}
      </div>
      <div className="flex gap-2">{['all','pending','dispatched','delivered'].map(x=>(<button key={x} onClick={()=>setF(x)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition',f===x?'bg-indigo-600 text-white':'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{x}</button>))}</div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
        <th className="text-left px-4 py-3 font-medium">Order</th><th className="text-left px-4 py-3 font-medium">Customer</th><th className="text-right px-4 py-3 font-medium">Items</th><th className="text-right px-4 py-3 font-medium">Total</th><th className="text-left px-4 py-3 font-medium">Transport</th><th className="text-left px-4 py-3 font-medium">Tracking</th><th className="text-left px-4 py-3 font-medium">Status</th>
      </tr></thead><tbody className="divide-y divide-slate-800 text-slate-300">
        {fl.map(d=>(<tr key={d.id} className="hover:bg-slate-900/30">
          <td className="px-4 py-3 font-mono text-white">{d.order}</td><td className="px-4 py-3 font-medium text-white">{d.cust}</td>
          <td className="px-4 py-3 text-right">{d.items}</td><td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(d.total)}</td>
          <td className="px-4 py-3 text-slate-400">{d.transport||'-'}</td><td className="px-4 py-3 font-mono text-slate-400 text-[10px]">{d.track||'-'}</td>
          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize',ST[d.status])}>{d.status}</span></td>
        </tr>))}
      </tbody></table></div>
    </div>
  )
}
