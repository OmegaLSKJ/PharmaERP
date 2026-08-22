import { useState } from 'react'
import { Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const PENDING = [
  { id:'1', type:'Sales Order', ref:'SO-2026-034', party:'MediCare Pharma', date:'2026-03-14', amount:45600, status:'awaiting-stock', items:8 },
  { id:'2', type:'Purchase Order', ref:'PO-2026-021', party:'Sun Pharma', date:'2026-03-13', amount:250000, status:'awaiting-delivery', items:12 },
  { id:'3', type:'Challan to Invoice', ref:'CH-2026-108', party:'CareWell Pharmacy', date:'2026-03-12', amount:18900, status:'convert-pending', items:5 },
  { id:'4', type:'Sales Order', ref:'SO-2026-032', party:'Wellness Pharma', date:'2026-03-11', amount:42000, status:'awaiting-stock', items:7 },
  { id:'5', type:'Purchase Order', ref:'PO-2026-020', party:'Cipla Ltd', date:'2026-03-10', amount:170000, status:'partially-received', items:9 },
]
const ST: Record<string,string> = {
  'awaiting-stock':'bg-amber-500/10 text-amber-400','awaiting-delivery':'bg-blue-500/10 text-blue-400',
  'convert-pending':'bg-purple-500/10 text-purple-400','partially-received':'bg-cyan-500/10 text-cyan-400' }

export default function Pendings() {
  const [f,setF] = useState('all')
  const fl = f==='all'?PENDING:PENDING.filter(p=>p.type===f)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Pending Transactions</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Clock size={14} className="text-amber-400"/>Open orders &amp; challans awaiting action</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{l:'Total Pending',v:PENDING.length,c:'text-white'},{l:'Awaiting Stock',v:PENDING.filter(p=>p.status==='awaiting-stock').length,c:'text-amber-400'},{l:'Awaiting Delivery',v:PENDING.filter(p=>p.status==='awaiting-delivery').length,c:'text-blue-400'},{l:'Convert to Invoice',v:PENDING.filter(p=>p.status==='convert-pending').length,c:'text-purple-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="flex gap-2">{['all','Sales Order','Purchase Order','Challan to Invoice'].map(x=>(<button key={x} onClick={()=>setF(x)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition',f===x?'bg-indigo-600 text-white':'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{x}</button>))}</div>
      <div className="space-y-2">
        {fl.map(p=>(<div key={p.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-indigo-500/50 transition">
          <div className="flex items-center gap-4">
            <span className={cn('px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap',ST[p.status])}>{p.status.replace('-',' ')}</span>
            <div><div className="text-sm font-medium text-white">{p.ref} <span className="text-slate-500 text-xs">| {p.type}</span></div>
            <div className="text-xs text-slate-400">{p.party} | {p.items} items | {p.date}</div></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-emerald-400">{formatCurrency(p.amount)}</span>
            <button className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition',p.type==='Purchase Order'?'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40':'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40')}>
              {p.type==='Purchase Order'?'Receive':p.type==='Challan to Invoice'?'Convert':'Fulfill'} <ArrowRight size={12}/>
            </button>
          </div>
        </div>))}
      </div>
    </div>
  )
}
