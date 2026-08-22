import { useState } from 'react'
import { CloudUpload, Cloud, RefreshCw, Database } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const PENDING_UPLOAD = [
  { id:'1', type:'Sale Invoice', ref:'SI-2026-1842', date:'2026-03-15', amount:45600 },
  { id:'2', type:'Receipt Voucher', ref:'REC-2026-045', date:'2026-03-14', amount:45600 },
  { id:'3', type:'Purchase Bill', ref:'PB-2026-1204', date:'2026-03-13', amount:250000 },
]
const UPLOADED = [
  { id:'4', type:'Sale Invoice', ref:'SI-2026-1839', date:'2026-03-12', amount:42000, syncedAt:'2026-03-12 18:30' },
  { id:'5', type:'Payment Voucher', ref:'PAY-2026-031', date:'2026-03-11', amount:180000, syncedAt:'2026-03-11 20:15' },
]

export default function ServerUpload() {
  const [syncing,setSyncing] = useState(false)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Manual Server Upload</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Database size={14} className="text-cyan-400"/>Push local transactions to MARG cloud / head office</p></div>
        <button onClick={()=>setSyncing(true)} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md disabled:opacity-50">
          <RefreshCw size={16} className={syncing?'animate-spin':''}/> Sync Now ({PENDING_UPLOAD.length})
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{l:'Pending Upload',v:String(PENDING_UPLOAD.length),c:'text-amber-400'},{l:'Uploaded Today',v:String(UPLOADED.length),c:'text-emerald-400'},{l:'Last Sync',v:'2026-03-12 20:00',c:'text-slate-300'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-lg font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><CloudUpload size={14} className="text-amber-400"/><h3 className="text-sm font-semibold text-white">Pending Queue</h3></div>
          <table className="w-full text-xs"><tbody className="divide-y divide-slate-800 text-slate-300">
            {PENDING_UPLOAD.map(p=>(<tr key={p.id}><td className="px-4 py-3">{p.type}</td><td className="px-4 py-3 font-mono text-white">{p.ref}</td><td className="px-4 py-3 font-mono text-slate-500">{p.date}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(p.amount)}</td></tr>))}
          </tbody></table>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><Cloud size={14} className="text-emerald-400"/><h3 className="text-sm font-semibold text-white">Recently Uploaded</h3></div>
          <table className="w-full text-xs"><tbody className="divide-y divide-slate-800 text-slate-300">
            {UPLOADED.map(p=>(<tr key={p.id}><td className="px-4 py-3">{p.type}</td><td className="px-4 py-3 font-mono text-white">{p.ref}</td><td className="px-4 py-3 font-mono text-slate-500">{p.syncedAt}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(p.amount)}</td></tr>))}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}


