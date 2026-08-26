import { useState } from 'react'
import { Save, Truck, Trash2, Printer } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface AvailableItem { name:string; batch:string; rate:number; stock:number }
interface Line { id:string; name:string; batch:string; qty:number; rate:number }

export default function ChallanEntry() {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [parties, setParties] = useState<string[]>([])
  const [party,setParty] = useState('')
  const [lines,setLines] = useState<Line[]>([])
  const [transport,setTransport] = useState('Surface')
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')]).then(([partyRows, productRows]) => { setParties(partyRows.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => p.name)); setAvailableItems(productRows.flatMap((p) => (p.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => ({ name: p.name, batch: b.batch, rate: p.saleRate, stock: b.stock })))) }).catch((e) => showToast(e.message)) }, [showToast])
  const addItem = (i:AvailableItem) => setLines([...lines,{id:Date.now().toString(),name:i.name,batch:i.batch,qty:1,rate:i.rate}])
  const totalQty = lines.reduce((a,l)=>a+l.qty,0)
  const saveChallan = async () => { try { setSaving(true); const saved = await postErp<{ id: string }>('challans', { party, transport, lines }); showToast(`Challan ${saved.id} saved.`); setLines([]) } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save challan.') } finally { setSaving(false) } }
  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Delivery Challan" />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Delivery Challan</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Truck size={14} className="text-cyan-400"/>Goods without invoice | CH-0113</p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white font-medium no-print"><Printer size={16} /></button>
          <button onClick={saveChallan} disabled={saving || !party || !lines.length} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md no-print"><Save size={16}/>{saving ? 'Saving…' : 'Save Challan'}</button>
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Party</label>
          <input list="challan-parties" value={party} onChange={e=>setParty(e.target.value)} placeholder="Search party..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"/><datalist id="challan-parties">{parties.map((name) => <option key={name} value={name} />)}</datalist></div>
        <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Transport</label>
          <select value={transport} onChange={e=>setTransport(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none"><option>Surface</option><option>DTDC</option><option>BlueDart</option><option>Hand Delivery</option></select></div>
        <div className="flex items-end"><div className="bg-slate-950 border border-slate-800 rounded-lg p-2 w-full"><div className="text-[10px] text-slate-400 uppercase">Items</div><div className="text-lg font-bold text-white">{lines.length}</div></div></div>
        <div className="flex items-end"><div className="bg-slate-950 border border-slate-800 rounded-lg p-2 w-full"><div className="text-[10px] text-slate-400 uppercase">Total Qty</div><div className="text-lg font-bold text-cyan-400">{totalQty}</div></div></div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Add Items</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {availableItems.map(i=>(<button key={i.batch} onClick={()=>addItem(i)} className="text-left p-3 rounded-lg border border-cyan-800/50 hover:bg-cyan-900/20 transition">
            <div className="text-sm font-medium text-white">{i.name}</div>
            <div className="text-xs text-slate-500 font-mono">{i.batch} | Stock: {i.stock}</div>
          </button>))}
        </div>
      </div>
      {lines.length>0 && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="px-4 py-3" />
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {lines.map(l=>(<tr key={l.id}><td className="px-4 py-3 font-medium text-white">{l.name}</td><td className="px-4 py-3 font-mono text-slate-400">{l.batch}</td><td className="px-4 py-3 text-right"><input type="number" min="1" value={l.qty} onChange={(e) => setLines((rows) => rows.map((row) => row.id === l.id ? { ...row, qty: Number(e.target.value) } : row))} className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right" /></td><td className="px-4 py-3 text-right"><button aria-label={`Remove ${l.name}`} onClick={() => setLines((rows) => rows.filter((row) => row.id !== l.id))} className="text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button></td></tr>))}
        </tbody></table></div>)}
    </div>
  )
}
