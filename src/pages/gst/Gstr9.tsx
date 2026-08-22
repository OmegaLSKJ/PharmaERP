import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const TABLES = [
  { no: '4', title: 'Outward Supplies (Auto from GSTR-1)', taxable: 2935000, tax: 258600, status: 'auto-filled' },
  { no: '5', title: 'Inward Supplies (Auto from GSTR-2A)', taxable: 1128000, tax: 135360, status: 'auto-filled' },
  { no: '6', title: 'Amendments', taxable: 15000, tax: 1800, status: 'manual' },
  { no: '7', title: 'ITC Reversal / Adjustment', taxable: 0, tax: 4200, status: 'review' },
  { no: '8', title: 'ITC Summary (Books vs 2A vs 2B)', taxable: 0, tax: 131160, status: 'review' },
  { no: '10', title: 'Supplies through E-commerce', taxable: 45000, tax: 5400, status: 'manual' },
]

export default function Gstr9() {
  const totalTaxable = TABLES.reduce((a,t)=>a+t.taxable,0)
  const totalTax = TABLES.reduce((a,t)=>a+t.tax,0)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">GSTR-9 (Annual Return)</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | Consolidated annual GST return</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md"><Download size={16}/> Prepare Filing</button>
      </div>
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
        <FileText size={18} className="text-amber-400 shrink-0" />
        <span className="text-xs text-amber-300">Due date for GSTR-9 FY 2025-26: <b>31 Dec 2026</b>. Tables marked "Review" need manual reconciliation before filing.</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[{l:'Total Taxable',v:formatCurrency(totalTaxable),c:'text-blue-400'},{l:'Total Tax',v:formatCurrency(totalTax),c:'text-emerald-400'},{l:'Tables Ready',v:TABLES.filter(t=>t.status!=='review').length+'/'+TABLES.length,c:'text-white'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="w-16 text-left px-4 py-3 font-medium">Table</th><th className="text-left px-4 py-3 font-medium">Description</th><th className="text-right px-4 py-3 font-medium">Taxable Value</th><th className="text-right px-4 py-3 font-medium">Tax Amount</th><th className="text-left px-4 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {TABLES.map(t=>(<tr key={t.no} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-mono font-bold text-indigo-400">{t.no}</td>
            <td className="px-4 py-3 font-medium text-white">{t.title}</td>
            <td className="px-4 py-3 text-right font-mono">{t.taxable>0?formatCurrency(t.taxable):'-'}</td>
            <td className="px-4 py-3 text-right font-mono">{t.tax>0?formatCurrency(t.tax):'-'}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize',t.status==='auto-filled'?'bg-emerald-500/10 text-emerald-400':t.status==='manual'?'bg-blue-500/10 text-blue-400':'bg-amber-500/10 text-amber-400')}>{t.status.replace('-',' ')}</span></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
