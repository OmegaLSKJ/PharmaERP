import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

type PriceDifferenceRow = { id:string; inv:string; party?:string; supplier?:string; item:string; oldRate:number; newRate:number; qty:number; diff:number }
const SALE_DIFF: PriceDifferenceRow[] = []
const PURC_DIFF: PriceDifferenceRow[] = []

function partyName(row: PriceDifferenceRow) {
  return row.party ?? row.supplier ?? ''
}

export default function PriceDifference() {
  const [tab,setTab] = useState<'sale'|'purchase'>('sale')
  const rows = tab==='sale'?SALE_DIFF:PURC_DIFF
  const net = rows.reduce((a,r)=>a+r.diff,0)
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Price Difference</h1>
        <p className="text-sm text-slate-400 mt-1">Rate revision adjustments on past invoices</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[{l:tab==='sale'?'Receivable (Sale Diff)':'Payable (Purch Diff)',v:formatCurrency(Math.abs(net)),c:net>=0?'text-emerald-400':'text-rose-400'},{l:'Invoices Affected',v:String(rows.length),c:'text-white'},{l:'Net Impact',v:(net>=0?'+':'')+formatCurrency(net),c:net>=0?'text-emerald-400':'text-rose-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('sale')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='sale'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>Sale Difference</button>
        <button onClick={()=>setTab('purchase')} className={cn('px-5 py-2 rounded-md text-sm font-medium transition',tab==='purchase'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>Purchase Difference</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Invoice</th><th className="text-left px-4 py-3 font-medium">{tab==='sale'?'Customer':'Supplier'}</th><th className="text-left px-4 py-3 font-medium">Item</th><th className="text-right px-4 py-3 font-medium">Old Rate</th><th className="text-right px-4 py-3 font-medium">New Rate</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Difference</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {rows.map(r=>(<tr key={r.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-mono text-white">{r.inv}</td><td className="px-4 py-3 font-medium">{partyName(r)}</td><td className="px-4 py-3">{r.item}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.oldRate)}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.newRate)}</td>
            <td className="px-4 py-3 text-right">{r.qty}</td>
            <td className={cn('px-4 py-3 text-right font-bold flex items-center justify-end gap-1',r.diff>0?'text-emerald-400':'text-rose-400')}>{r.diff>0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}{(r.diff>0?'+':'')+formatCurrency(Math.abs(r.diff))}</td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
