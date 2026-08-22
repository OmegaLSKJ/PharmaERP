import { useState } from 'react'
import { FileCheck, Zap, RefreshCw } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const DATA = [
  { id:'1',inv:'SI-2026-1842',party:'MediCare Pharma',gstin:'27AAACM1234F1Z5',date:'2026-03-15',total:45600,irn:'a1b2c3d4e5f6...789012',status:'generated' },
  { id:'2',inv:'SI-2026-1841',party:'HealthFirst Dist.',gstin:'27BBBHF2345G1Z6',date:'2026-03-15',total:32100,irn:'f6e5d4c3b2a1...210987',status:'generated' },
  { id:'3',inv:'SI-2026-1840',party:'CareWell Pharmacy',gstin:'27CCCCW3456H1Z7',date:'2026-03-14',total:18900,irn:'',status:'pending' },
  { id:'4',inv:'SI-2026-1839',party:'Wellness Pharma',gstin:'24DDDDP4567J1Z8',date:'2026-03-14',total:42000,irn:'',status:'failed' },
  { id:'5',inv:'SI-2026-1838',party:'LifeLine Medical',gstin:'07EEEEE5678K1Z9',date:'2026-03-13',total:67000,irn:'9z8y7x6w5v4u...654321',status:'generated' },
]
const ST: Record<string,string> = { generated:'bg-emerald-500/10 text-emerald-400', pending:'bg-amber-500/10 text-amber-400', failed:'bg-rose-500/10 text-rose-400' }

export default function EInvoice() {
  const [sel, setSel] = useState<string[]>([])
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const pending = DATA.filter(d => d.status === 'pending' || d.status === 'failed')
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">e-Invoice (IRN Generation)</h1>
          <p className="text-sm text-slate-400 mt-1">Generate IRN for B2B invoices | NIC Portal</p></div>
        <div className="flex gap-2">
          <button disabled title="Configure NIC e-Invoice credentials to sync IRN status" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium border border-slate-700 opacity-50 cursor-not-allowed"><RefreshCw size={16} /> Sync Status</button>
          <button disabled title="Configure NIC e-Invoice credentials before generating an IRN" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-md opacity-50 cursor-not-allowed"><Zap size={16} /> Generate IRN ({sel.length})</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{l:'Total B2B Invoices',v:DATA.length,c:'text-white'},{l:'IRN Generated',v:DATA.filter(d=>d.status==='generated').length,c:'text-emerald-400'},{l:'Pending',v:pending.length,c:'text-amber-400'},{l:'Failed',v:DATA.filter(d=>d.status==='failed').length,c:'text-rose-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="w-10 px-4 py-3"></th><th className="text-left px-4 py-3 font-medium">Invoice</th><th className="text-left px-4 py-3 font-medium">Party</th><th className="text-left px-4 py-3 font-medium">GSTIN</th><th className="text-right px-4 py-3 font-medium">Total</th><th className="text-left px-4 py-3 font-medium">IRN</th><th className="text-left px-4 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {DATA.map(d=>(<tr key={d.id} onClick={()=>toggle(d.id)} className={cn('cursor-pointer hover:bg-slate-900/30', sel.includes(d.id) && 'bg-indigo-500/5')}>
            <td className="px-4 py-3"><input type="checkbox" checked={sel.includes(d.id)} onChange={()=>toggle(d.id)} className="accent-indigo-600" /></td>
            <td className="px-4 py-3 font-mono text-white">{d.inv}</td><td className="px-4 py-3 font-medium">{d.party}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-400">{d.gstin}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.total)}</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{d.irn ? d.irn.slice(0,12)+'...' : '-'}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize flex items-center gap-1 w-fit',ST[d.status])}><FileCheck size={10}/>{d.status}</span></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
