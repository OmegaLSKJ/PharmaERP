import { useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'

const CLAIMS: Array<{ id:string; claimNo:string; supplier:string; items:number; qty:number; claimed:number; approved:number; date:string; status:string }> = []
const ST: Record<string,string> = {
  pending:'bg-amber-500/10 text-amber-400', approved:'bg-blue-500/10 text-blue-400',
  partial:'bg-purple-500/10 text-purple-400', settled:'bg-emerald-500/10 text-emerald-400', credited:'bg-cyan-500/10 text-cyan-400' }

export default function ClaimSettlement() {
  const [tab,setTab] = useState('all')
  const rows = tab==='all'?CLAIMS:CLAIMS.filter(c=>c.status===tab)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Claim Settlement</h1>
        <p className="text-sm text-slate-400 mt-1">Breakage / expiry claims raised to suppliers — track approval and credit</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{l:'Total Claims',v:String(CLAIMS.length),c:'text-white'},{l:'Claimed Value',v:formatCurrency(CLAIMS.reduce((a,c)=>a+c.claimed,0)),c:'text-amber-400'},{l:'Approved Value',v:formatCurrency(CLAIMS.reduce((a,c)=>a+c.approved,0)),c:'text-emerald-400'},{l:'Pending Approval',v:String(CLAIMS.filter(c=>c.status==='pending').length),c:'text-rose-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">{['all','pending','approved','partial','settled','credited'].map(x=>(<button key={x} onClick={()=>setTab(x)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition',tab===x?'bg-indigo-600 text-white':'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{x}</button>))}</div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Claim No</th><th className="text-left px-4 py-3 font-medium">Supplier</th><th className="text-right px-4 py-3 font-medium">Items</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Claimed</th><th className="text-right px-4 py-3 font-medium">Approved</th><th className="text-left px-4 py-3 font-medium">Date</th><th className="text-left px-4 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {rows.map(c=>(<tr key={c.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-mono text-indigo-400">{c.claimNo}</td><td className="px-4 py-3 font-medium text-white">{c.supplier}</td>
            <td className="px-4 py-3 text-right">{c.items}</td><td className="px-4 py-3 text-right">{c.qty}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(c.claimed)}</td>
            <td className="px-4 py-3 text-right font-mono text-emerald-400">{c.approved>0?formatCurrency(c.approved):'-'}</td>
            <td className="px-4 py-3 font-mono text-slate-500">{c.date}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize inline-flex items-center gap-1',ST[c.status])}>{c.status==='settled'||c.status==='credited'?<CheckCircle size={11}/>:<Clock size={11}/>}{c.status}</span></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
