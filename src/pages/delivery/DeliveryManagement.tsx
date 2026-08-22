import { useState } from 'react'
import { Truck } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const DATA = [
  { id:'1',order:'SO-2026-034',cust:'MediCare Pharma',items:8,total:45600,dispatch:'2026-03-16',deliver:'2026-03-18',transport:'DTDC',status:'dispatched',track:'DTDC-456123' },
  { id:'2',order:'SO-2026-033',cust:'HealthFirst Dist.',items:5,total:32100,dispatch:'2026-03-15',deliver:'2026-03-17',transport:'BlueDart',status:'delivered',track:'BD-789012' },
  { id:'3',order:'SO-2026-032',cust:'CareWell Pharmacy',items:3,total:18900,dispatch:'',deliver:'2026-03-16',transport:'Surface',status:'pending',track:'' },
  { id:'4',order:'SO-2026-031',cust:'Wellness Pharma',items:7,total:42000,dispatch:'2026-03-14',deliver:'2026-03-16',transport:'DTDC',status:'delivered',track:'DTDC-321654' },
  { id:'5',order:'SO-2026-030',cust:'LifeLine Medical',items:12,total:67000,dispatch:'',deliver:'2026-03-19',transport:'',status:'pending',track:'' },
]
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
