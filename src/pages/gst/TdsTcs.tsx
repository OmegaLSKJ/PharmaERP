import { useState } from 'react'
import { Download, Percent } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

type TaxRow = { id:string; type:string; party:string; gstin:string; amount:number; rate:number; tax:number; date:string; status:string }
const TDS: TaxRow[] = []
const TCS: TaxRow[] = []

export default function TdsTcs() {
  const [tab,setTab] = useState<'tds'|'tcs'>('tds')
  const rows = tab==='tds'?TDS:TCS
  const totalTax = rows.reduce((a,r)=>a+r.tax,0)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">TDS / TCS</h1>
          <p className="text-sm text-slate-400 mt-1">Deductee &amp; collector ledger | FY 2025-26</p></div>
        <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('tds-tcs-register'))} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md"><Download size={16}/> Export 26Q / 27Q</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{l:tab==='tds'?'Total Deducted':'Total Collected',v:formatCurrency(totalTax),c:'text-emerald-400'},{l:'Entries',v:String(rows.length),c:'text-white'},{l:'Pending Payment',v:formatCurrency(rows.filter(r=>r.status==='due').reduce((a,r)=>a+r.tax,0)),c:'text-amber-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('tds')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='tds'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>TDS</button>
        <button onClick={()=>setTab('tcs')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='tcs'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>TCS</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Type</th><th className="text-left px-4 py-3 font-medium">Party</th><th className="text-left px-4 py-3 font-medium">GSTIN</th><th className="text-right px-4 py-3 font-medium">Base Amount</th><th className="text-right px-4 py-3 font-medium"><Percent size={11}/></th><th className="text-right px-4 py-3 font-medium">{tab==='tds'?'Deducted':'Collected'}</th><th className="text-left px-4 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {rows.map(r=>(<tr key={r.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{r.type}</td><td className="px-4 py-3">{r.party}</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{r.gstin}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.amount)}</td>
            <td className="px-4 py-3 text-right">{r.rate}%</td>
            <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(r.tax)}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize',r.status==='paid'?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400')}>{r.status}</span></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
