import { useState } from 'react'
import { Ban, ShieldAlert } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const DATA: Array<{ id:string; name:string; batch:string; qty:number; mrp:number; reason:string; type:string }> = []

export default function HoldBanStock() {
  const [tab,setTab] = useState<'all'|'hold'|'ban'>('all')
  const rows = tab==='all'?DATA:DATA.filter(d=>d.type===tab)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Hold / Ban Stock</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><ShieldAlert size={14} className="text-rose-400"/>Restricted stock excluded from billing</p></div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('all')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition',tab==='all'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>All ({DATA.length})</button>
        <button onClick={()=>setTab('hold')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition',tab==='hold'?'bg-amber-600 text-white':'text-slate-400 hover:text-white')}>Hold ({DATA.filter(d=>d.type==='hold').length})</button>
        <button onClick={()=>setTab('ban')} className={cn('px-4 py-2 rounded-md text-sm font-medium transition',tab==='ban'?'bg-rose-600 text-white':'text-slate-400 hover:text-white')}>Banned ({DATA.filter(d=>d.type==='ban').length})</button>
      </div>
      <div className="space-y-2">
        {rows.map(d=>(<div key={d.id} className={cn('bg-slate-900/50 border rounded-xl p-4 flex items-center justify-between',d.type==='hold'?'border-amber-500/30':'border-rose-500/30')}>
          <div className="flex items-center gap-3">
            <span className={cn('p-2 rounded-lg',d.type==='hold'?'bg-amber-500/10 text-amber-400':'bg-rose-500/10 text-rose-400')}><Ban size={16}/></span>
            <div><div className="text-sm font-medium text-white">{d.name}</div><div className="text-xs text-slate-400 font-mono">{d.batch} | {d.reason}</div></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Qty: <b className="text-white">{d.qty}</b></span>
            <span className="font-mono text-sm text-slate-300">{formatCurrency(d.mrp)}</span>
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase',d.type==='hold'?'bg-amber-500/10 text-amber-400':'bg-rose-500/10 text-rose-400')}>{d.type}</span>
          </div>
        </div>))}
      </div>
    </div>
  )
}
