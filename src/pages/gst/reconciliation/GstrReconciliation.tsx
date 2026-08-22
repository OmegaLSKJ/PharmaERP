import { useState } from 'react'
import { Download, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'

const DATA: Array<{ id:string; inv:string; sup:string; d:string; tax:number; gst:number; tot:number; mb:string; ga:string }> = []
const SC: Record<string,string> = { Matched:'bg-emerald-500/10 text-emerald-400',Mismatch:'bg-amber-500/10 text-amber-400',Missing:'bg-rose-500/10 text-rose-400' }
const IC: Record<string,any> = { Matched:<CheckCircle size={12}/>,Mismatch:<AlertTriangle size={12}/>,Missing:<XCircle size={12}/> }

export default function GstrReconciliation() {
  const [f,setF] = useState('all')
  const m = DATA.filter(d=>d.mb==='Matched'&&d.ga==='Matched').length
  const mm = DATA.filter(d=>d.mb!==d.ga).length
  const fl = f==='all'?DATA:DATA.filter(d=>d.mb!==d.ga)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">GSTR-2A / 2B Reconciliation</h1>
        <p className="text-sm text-slate-400 mt-1">Match purchase books with portal data</p></div>
        <button onClick={() => import('../../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr-reconciliation'))} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"><Download size={16}/> Export</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{l:'Total',v:DATA.length,c:'text-white'},{l:'Matched',v:m,c:'text-emerald-400'},{l:'Mismatched',v:mm,c:'text-amber-400'},{l:'Rate',v:Math.round((m/DATA.length)*100)+'%',c:'text-white'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="flex gap-2">{['all','mismatched'].map(x=>(<button key={x} onClick={()=>setF(x)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition',f===x?'bg-indigo-600 text-white':'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{x}</button>))}</div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
        <th className="text-left px-4 py-3 font-medium">Invoice</th><th className="text-left px-4 py-3 font-medium">Supplier</th><th className="text-left px-4 py-3 font-medium">Date</th><th className="text-right px-4 py-3 font-medium">Taxable</th><th className="text-right px-4 py-3 font-medium">Tax</th><th className="text-right px-4 py-3 font-medium">Total</th><th className="text-left px-4 py-3 font-medium">My Books</th><th className="text-left px-4 py-3 font-medium">GSTR-2A</th>
      </tr></thead><tbody className="divide-y divide-slate-800 text-slate-300">
        {fl.map(d=>(<tr key={d.id} className="hover:bg-slate-900/30">
          <td className="px-4 py-3 font-mono text-white">{d.inv}</td><td className="px-4 py-3 font-medium text-white">{d.sup}</td><td className="px-4 py-3 font-mono text-slate-400">{d.d}</td>
          <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.tax)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(d.gst)}</td><td className="px-4 py-3 text-right font-mono font-medium text-white">{formatCurrency(d.tot)}</td>
          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1',SC[d.mb])}>{IC[d.mb]} {d.mb}</span></td>
          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1',SC[d.ga])}>{IC[d.ga]} {d.ga}</span></td>
        </tr>))}
      </tbody></table></div>
    </div>
  )
}
