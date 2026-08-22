import { useState } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { downloadCsvTemplate } from '../../lib/download'

const IMPORTS = [
  { id:'1', file:'sales_march_2026.xlsx', type:'Sales Register', rows:1842, valid:1838, errors:4, date:'2026-03-15 09:30', status:'completed' },
  { id:'2', file:'purchase_cipla.xlsx', type:'Purchase Bills', rows:96, valid:96, errors:0, date:'2026-03-14 16:45', status:'completed' },
  { id:'3', file:'opening_stock.csv', type:'Stock Opening', rows:1240, valid:1180, errors:60, date:'2026-03-12 11:00', status:'partial' },
  { id:'4', file:'party_master_new.csv', type:'Party Master', rows:35, valid:0, errors:0, date:'2026-03-16 08:00', status:'processing' },
]
const ST: Record<string,string> = { completed:'bg-emerald-500/10 text-emerald-400', partial:'bg-amber-500/10 text-amber-400', processing:'bg-blue-500/10 text-blue-400' }

export default function TransactionImport() {
  const [drag,setDrag] = useState(false)
  const templates: Record<string, string[]> = { 'Sales Register':['invoice_number','invoice_date','customer','item_code','batch','quantity','rate','gst_rate'], 'Purchase Bills':['supplier_invoice','invoice_date','supplier','item_code','batch','expiry','quantity','purchase_rate'], 'Stock Opening':['item_code','batch','expiry','warehouse','quantity','mrp'], 'Party Master':['code','party_type','legal_name','phone','email','gstin','credit_limit','city'] }
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Transaction Import</h1>
        <p className="text-sm text-slate-400 mt-1">Bulk import sales / purchases / masters from Excel or CSV</p></div>
      <div className={cn('border-2 border-dashed rounded-xl p-10 text-center transition cursor-pointer',drag?'border-indigo-500 bg-indigo-500/5':'border-slate-700 hover:border-slate-600')}
        onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false)}}>
        <Upload size={32} className="mx-auto text-slate-500 mb-3"/>
        <p className="text-sm text-white font-medium">Drop Excel / CSV file here or click to browse</p>
        <p className="text-xs text-slate-500 mt-1">Supported: .xlsx, .csv | Max 10 MB | Templates available for each import type</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {['Sales Register','Purchase Bills','Stock Opening','Party Master'].map(t=>(
          <button key={t} onClick={() => downloadCsvTemplate(`${t.toLowerCase().replace(/\s+/g, '-')}-template`, templates[t])} className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-lg text-xs font-medium text-slate-300 transition"><FileSpreadsheet size={13} className="text-emerald-400"/>Template: {t}</button>))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">File</th><th className="text-left px-4 py-3 font-medium">Type</th><th className="text-right px-4 py-3 font-medium">Rows</th><th className="text-right px-4 py-3 font-medium">Valid</th><th className="text-right px-4 py-3 font-medium">Errors</th><th className="text-left px-4 py-3 font-medium">Date</th><th className="text-left px-4 py-3 font-medium">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {IMPORTS.map(i=>(<tr key={i.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-mono text-white">{i.file}</td><td className="px-4 py-3">{i.type}</td>
            <td className="px-4 py-3 text-right">{i.rows.toLocaleString()}</td><td className="px-4 py-3 text-right text-emerald-400">{i.valid.toLocaleString()}</td>
            <td className="px-4 py-3 text-right">{i.errors>0?<span className="text-rose-400 flex items-center justify-end gap-1"><AlertTriangle size={11}/>{i.errors}</span>:'0'}</td>
            <td className="px-4 py-3 font-mono text-slate-500">{i.date}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize inline-flex items-center gap-1',ST[i.status])}><CheckCircle size={10}/>{i.status}</span></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
