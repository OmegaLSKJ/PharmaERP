import { useState } from 'react'
import { Plus, Search, Link2, Trash2, Database } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Map {
  id:string; source:'import'|'manual'; supplier:string; supplierItem:string; canonicalItem:string; company:string; unit:string; batch:string; stock:number; mrp:number; costPrice:number; purchasePrice:number; salePrice:number; reportedValue:number; salesSchemeDeal:number; salesSchemeFree:number; purchaseSchemeDeal:number; purchaseSchemeFree:number; receivedOn:string; manufacturedOn:string; expiryOn:string; invoiceNumber:string; invoiceDate:string; rackNumber:string; status:string
}

const display = (value: string) => value || '—'

export default function ItemMapping() {
  const [mappings, setMappings] = useState<Map[]>([])
  const [search,setSearch] = useState('')
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { getErp<Map[]>('item-mappings').then(setMappings).catch((e) => showToast(e.message)) }, [showToast])
  const filtered = mappings.filter(m => [m.supplier,m.canonicalItem,m.supplierItem,m.company,m.batch,m.invoiceNumber,m.rackNumber].some((value) => value.toLowerCase().includes(search.toLowerCase())))
  const addMapping = async () => { const supplier = window.prompt('Supplier name'); if (!supplier) return; const supplierItem = window.prompt('Supplier item code'); if (!supplierItem) return; const canonicalItem = window.prompt('Canonical item name'); if (!canonicalItem) return; try { const row = await postErp<any>('item-mappings', { supplier, supplierItem, canonicalItem, packing:'', mrp:0, status:'posted' }); setMappings((items) => [...items, { id:row.id, source:'manual', supplier, supplierItem, canonicalItem, company:'', unit:'', batch:'', stock:0, mrp:0, costPrice:0, purchasePrice:0, salePrice:0, reportedValue:0, salesSchemeDeal:0, salesSchemeFree:0, purchaseSchemeDeal:0, purchaseSchemeFree:0, receivedOn:'', manufacturedOn:'', expiryOn:'', invoiceNumber:'', invoiceDate:'', rackNumber:'', status:'active' }]); showToast('Item mapping saved.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save mapping.') } }
  const removeMapping = async (id:string) => { if (!window.confirm('Delete this manual mapping?')) return; try { await deleteErp('item-mappings', id); setMappings((items) => items.filter((item) => item.id !== id)); showToast('Mapping deleted.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to delete mapping.') } }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Item Mapping</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Database size={14} className="text-indigo-400"/>Imported stock mapping with full batch, rate, supplier and rack details</p></div>
        <button onClick={addMapping} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md"><Plus size={16}/> New Mapping</button>
      </div>
      <div className="relative max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" placeholder="Search product, supplier, batch, invoice or rack..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500"/></div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto"><table className="min-w-[1800px] w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Product / Code</th><th className="text-left px-4 py-3 font-medium">Company</th><th className="text-left px-4 py-3 font-medium">Batch / Unit</th><th className="text-right px-4 py-3 font-medium">Stock</th><th className="text-right px-4 py-3 font-medium">Cost</th><th className="text-right px-4 py-3 font-medium">Purchase</th><th className="text-right px-4 py-3 font-medium">Sale</th><th className="text-right px-4 py-3 font-medium">MRP</th><th className="text-right px-4 py-3 font-medium">Value</th><th className="text-left px-4 py-3 font-medium">Sales Scheme</th><th className="text-left px-4 py-3 font-medium">Purchase Scheme</th><th className="text-left px-4 py-3 font-medium">Received</th><th className="text-left px-4 py-3 font-medium">Mfg / Expiry</th><th className="text-left px-4 py-3 font-medium">Supplier</th><th className="text-left px-4 py-3 font-medium">Invoice</th><th className="text-left px-4 py-3 font-medium">Rack</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="w-10 px-4 py-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {filtered.map(m=>(<tr key={m.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3"><div className="font-medium text-white">{m.canonicalItem}</div><div className="font-mono text-amber-400">{m.supplierItem}</div></td>
            <td className="px-4 py-3">{display(m.company)}</td><td className="px-4 py-3"><div className="font-mono text-emerald-400">{display(m.batch)}</div><div className="text-slate-400">{display(m.unit)}</div></td>
            <td className="px-4 py-3 text-right font-mono">{m.stock}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(m.costPrice)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(m.purchasePrice)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(m.salePrice)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(m.mrp)}</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(m.reportedValue)}</td>
            <td className="px-4 py-3 font-mono">{m.salesSchemeDeal}+{m.salesSchemeFree}</td><td className="px-4 py-3 font-mono">{m.purchaseSchemeDeal}+{m.purchaseSchemeFree}</td><td className="px-4 py-3">{display(m.receivedOn)}</td><td className="px-4 py-3">{display(m.manufacturedOn)} / {display(m.expiryOn)}</td><td className="px-4 py-3">{display(m.supplier)}</td><td className="px-4 py-3"><div>{display(m.invoiceNumber)}</div><div className="text-slate-500">{display(m.invoiceDate)}</div></td><td className="px-4 py-3">{display(m.rackNumber)}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize',m.source==='import'?'bg-blue-500/10 text-blue-400':m.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400')}>{m.source==='import'?'imported':m.status}</span></td>
            <td className="px-4 py-3">{m.source==='manual' && <button aria-label={`Delete ${m.supplierItem}`} onClick={() => removeMapping(m.id)} className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={13}/></button>}</td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
