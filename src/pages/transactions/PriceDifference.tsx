import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

type Row = { id:string; inv:string; party:string; item:string; oldRate:number; newRate:number; qty:number; diff:number }
export default function PriceDifference() {
  const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true)
  useEffect(() => {
    getErp<any[]>('price-differences')
      .then((data) => setRows((data || []).flatMap((doc:any) =>
        (doc.details?.lines || doc.lines || []).map((line:any, index:number) => ({
          id: `${doc.id}-${index}`, inv: doc.number || doc.document_number || doc.id, party: doc.party || doc.supplier || '',
          item: line.name || line.item || 'Item', oldRate: Number(line.oldRate || line.rate || 0),
          newRate: Number(line.newRate || line.revisedRate || 0), qty: Number(line.qty || line.quantity || 0),
          diff: Number(line.difference || ((Number(line.newRate || line.revisedRate || 0) - Number(line.oldRate || line.rate || 0)) * Number(line.qty || line.quantity || 0))),
        }))
      )))
      .finally(() => setLoading(false))
  }, [])
  const total=rows.reduce((sum,row)=>sum+row.diff,0)
  return <div className="p-6 space-y-4"><div><h1 className="text-2xl font-bold tracking-tight text-white">Price Difference</h1><p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><TrendingUp size={14} className="text-indigo-400"/>Live rate-difference documents from Supabase</p></div><div className="text-2xl font-mono text-emerald-400">{formatCurrency(total)} <span className="text-xs text-slate-400">net impact</span></div><div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 text-slate-400 uppercase"><th className="p-3 text-left">Invoice</th><th className="p-3 text-left">Party</th><th className="p-3 text-left">Item</th><th className="p-3 text-right">Old Rate</th><th className="p-3 text-right">New Rate</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Difference</th></tr></thead><tbody>{loading?<tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading live documents…</td></tr>:rows.map(row=><tr key={row.id} className="border-t border-slate-800"><td className="p-3 font-mono">{row.inv}</td><td className="p-3">{row.party}</td><td className="p-3">{row.item}</td><td className="p-3 text-right">{formatCurrency(row.oldRate)}</td><td className="p-3 text-right">{formatCurrency(row.newRate)}</td><td className="p-3 text-right">{row.qty}</td><td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(row.diff)}</td></tr>)}{!loading&&!rows.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">No price-difference documents have been recorded.</td></tr>}</tbody></table></div></div>
}
