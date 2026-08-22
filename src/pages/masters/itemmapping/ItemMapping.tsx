import { useState } from 'react'
import { Plus, Search, Link2, Trash2 } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Map { id:string; supplier:string; supplierItem:string; canonicalItem:string; packing:string; mrp:number; status:'active'|'pending' }

export default function ItemMapping() {
  const [mappings, setMappings] = useState<Map[]>([])
  const [search,setSearch] = useState('')
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { getErp<any[]>('item-mappings').then((rows) => setMappings(rows.map((row) => ({ id:row.id, supplier:row.supplier ?? row.party ?? '', supplierItem:row.supplierItem ?? '', canonicalItem:row.canonicalItem ?? '', packing:row.packing ?? '', mrp:Number(row.mrp ?? 0), status:row.status === 'posted' ? 'active' : row.status })))).catch((e) => showToast(e.message)) }, [showToast])
  const filtered = mappings.filter(m => m.supplier.toLowerCase().includes(search.toLowerCase()) || m.canonicalItem.toLowerCase().includes(search.toLowerCase()) || m.supplierItem.toLowerCase().includes(search.toLowerCase()))
  const addMapping = async () => { const supplier = window.prompt('Supplier name'); if (!supplier) return; const supplierItem = window.prompt('Supplier item code'); if (!supplierItem) return; const canonicalItem = window.prompt('Canonical item name'); if (!canonicalItem) return; try { const row = await postErp<any>('item-mappings', { supplier, supplierItem, canonicalItem, packing:'', mrp:0, status:'posted' }); setMappings((items) => [...items, { id:row.id, supplier, supplierItem, canonicalItem, packing:'', mrp:0, status:'active' }]); showToast('Item mapping saved.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save mapping.') } }
  const removeMapping = async (id:string) => { if (!window.confirm('Delete this mapping?')) return; try { await deleteErp('item-mappings', id); setMappings((items) => items.filter((item) => item.id !== id)); showToast('Mapping deleted.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to delete mapping.') } }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Item Mapping</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Link2 size={14} className="text-indigo-400"/>Map supplier items to your canonical item master</p></div>
        <button onClick={addMapping} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md"><Plus size={16}/> New Mapping</button>
      </div>
      <div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" placeholder="Search mapping..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500"/></div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3"></th><th className="text-left px-4 py-3 font-medium">Supplier Item Code</th><th className="px-4 py-3"></th><th className="text-left px-4 py-3 font-medium">Canonical Item</th><th className="text-left px-4 py-3 font-medium">Packing</th><th className="text-right px-4 py-3 font-medium">MRP</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="w-10 px-4 py-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {filtered.map(m=>(<tr key={m.id} className="hover:bg-slate-900/30">
            <td className="px-4 py-3 font-medium text-white">{m.supplier}</td>
            <td className="px-4 py-3 text-center text-slate-600"><Link2 size={12}/></td>
            <td className="px-4 py-3 font-mono text-amber-400">{m.supplierItem}</td>
            <td className="px-4 py-3 text-center text-slate-600">&#8594;</td>
            <td className="px-4 py-3 font-mono text-emerald-400">{m.canonicalItem}</td>
            <td className="px-4 py-3 text-slate-400">{m.packing}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(m.mrp)}</td>
            <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize',m.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400')}>{m.status}</span></td>
            <td className="px-4 py-3"><button aria-label={`Delete ${m.supplierItem}`} onClick={() => removeMapping(m.id)} className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={13}/></button></td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
