import { Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface Row { desc: string; count: number; taxable: number; cgst: number; sgst: number; igst: number }

const ROWS: Row[] = [
  { desc: 'B2B Supplies', count: 48, taxable: 1250000, cgst: 75000, sgst: 75000, igst: 0 },
  { desc: 'B2C Large Invoice (>5L)', count: 4, taxable: 850000, cgst: 51000, sgst: 51000, igst: 0 },
  { desc: 'B2C Small Invoice (<5L)', count: 312, taxable: 680000, cgst: 40800, sgst: 40800, igst: 0 },
  { desc: 'Nil Rated / Exempted', count: 22, taxable: 35000, cgst: 0, sgst: 0, igst: 0 },
  { desc: 'Export Invoices', count: 2, taxable: 120000, cgst: 0, sgst: 0, igst: 0 },
]

export default function GstrSummary() {
  const totalTaxable = ROWS.reduce((a,r)=>a+r.taxable,0)
  const totalTax = ROWS.reduce((a,r)=>a+r.cgst+r.sgst+r.igst,0)
  const totalCount = ROWS.reduce((a,r)=>a+r.count,0)
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">GSTR-1 Summary</h1>
          <p className="text-sm text-slate-400 mt-1">March 2026 | Outward supply breakdown by category</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700"><Download size={16}/> Export JSON</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[{l:'Total Invoices',v:String(totalCount),c:'text-white'},{l:'Total Taxable',v:formatCurrency(totalTaxable),c:'text-blue-400'},{l:'Total Tax',v:formatCurrency(totalTax),c:'text-emerald-400'}].map(s=>(
          <div key={s.l} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400 uppercase font-semibold">{s.l}</div><div className={cn('text-xl font-bold mt-1',s.c)}>{s.v}</div></div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Description</th><th className="text-right px-4 py-3 font-medium">Count</th><th className="text-right px-4 py-3 font-medium">Taxable</th><th className="text-right px-4 py-3 font-medium">CGST</th><th className="text-right px-4 py-3 font-medium">SGST</th><th className="text-right px-4 py-3 font-medium">IGST</th><th className="text-right px-4 py-3 font-medium">Total Tax</th><th className="text-right px-4 py-3 font-medium">Invoice Value</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {ROWS.map(r=>(<tr key={r.desc} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{r.desc}</td>
            <td className="px-4 py-3 text-right">{r.count}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.taxable)}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-400">{r.cgst>0?formatCurrency(r.cgst):'-'}</td>
            <td className="px-4 py-3 text-right font-mono text-purple-400">{r.sgst>0?formatCurrency(r.sgst):'-'}</td>
            <td className="px-4 py-3 text-right font-mono text-amber-400">{r.igst>0?formatCurrency(r.igst):'-'}</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{r.cgst+r.sgst+r.igst>0?formatCurrency(r.cgst+r.sgst+r.igst):'-'}</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-white">{formatCurrency(r.taxable+r.cgst+r.sgst+r.igst)}</td>
          </tr>))}
        </tbody>
        <tfoot><tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold text-xs">
          <td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right">{totalCount}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable)}</td>
          <td className="px-4 py-3 text-right font-mono">{formatCurrency(ROWS.reduce((a,r)=>a+r.cgst,0))}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(ROWS.reduce((a,r)=>a+r.sgst,0))}</td>
          <td className="px-4 py-3 text-right font-mono">-</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTax)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable+totalTax)}</td>
        </tr></tfoot>
      </table></div>
    </div>
  )
}
