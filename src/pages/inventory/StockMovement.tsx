import { useState } from 'react'
import { Save, ArrowLeftRight } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const LOCATIONS = ['Store A', 'Store B', 'Store C']
const ITEMS = [
  { name: 'Amoxicillin 500mg', batch: 'AMX-2026-045', stock: { 'Store A': 240, 'Store B': 0, 'Store C': 0 } },
  { name: 'Paracetamol 650mg', batch: 'PCM-2026-088', stock: { 'Store A': 0, 'Store B': 380, 'Store C': 0 } },
  { name: 'Azithromycin 250mg', batch: 'AZT-2026-012', stock: { 'Store A': 160, 'Store B': 0, 'Store C': 0 } },
  { name: 'Cetirizine 10mg', batch: 'CTZ-2026-077', stock: { 'Store A': 0, 'Store B': 0, 'Store C': 290 } },
  { name: 'Metformin 500mg', batch: 'MTF-2026-034', stock: { 'Store A': 0, 'Store B': 150, 'Store C': 0 } },
]

interface Movement { id: string; itemName: string; batch: string; from: string; to: string; qty: number }

export default function StockMovement() {
  const [date, setDate] = useState('2026-03-16')
  const [movements, setMovements] = useState<Movement[]>([])
  const [fromLoc, setFromLoc] = useState('Store A')
  const [toLoc, setToLoc] = useState('Store B')

  const addMovement = (item: typeof ITEMS[0]) => {
    if (fromLoc === toLoc) return
    const avail = item.stock[fromLoc as keyof typeof item.stock] || 0
    if (avail <= 0) return
    setMovements([...movements, { id: Date.now().toString(), itemName: item.name, batch: item.batch, from: fromLoc, to: toLoc, qty: Math.min(10, avail) }])
  }
  const updateMovement = (id: string, qty: number) => {
    setMovements(movements.map(m => m.id === id ? { ...m, qty } : m))
  }
  const removeMovement = (id: string) => setMovements(movements.filter(m => m.id !== id))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Stock Movement</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><ArrowLeftRight size={14} className="text-cyan-400" /> Inter-godown / store transfer</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"><Save size={16} /> Save Transfer</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">From Location</label>
            <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div className="flex items-center justify-center"><ArrowLeftRight size={20} className="text-cyan-400" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">To Location</label>
            <select value={toLoc} onChange={(e) => setToLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
        </div>
      </div>
      {fromLoc !== toLoc && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Available in {fromLoc}</h3></div>
        <div className="divide-y divide-slate-800">
          {ITEMS.filter(i => (i.stock[fromLoc as keyof typeof i.stock] || 0) > 0).map(item => {
            const avail = item.stock[fromLoc as keyof typeof item.stock] || 0
            return (<div key={item.batch} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30">
              <div><div className="text-sm font-medium text-white">{item.name}</div><div className="text-xs text-slate-500 font-mono">{item.batch}</div></div>
              <div className="flex items-center gap-3"><span className="text-xs text-slate-400">Avail: {avail}</span>
                <button onClick={() => addMovement(item)} className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded text-xs font-semibold transition">Transfer</button>
              </div>
            </div>)
          })}
        </div>
      </div>)}
      {movements.length > 0 && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Transfer Queue ({movements.length})</h3></div>
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">From</th><th className="text-center px-4 py-3 font-medium"><ArrowLeftRight size={12} /></th><th className="text-left px-4 py-3 font-medium">To</th><th className="text-right px-4 py-3 font-medium">Qty</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {movements.map(m => (<tr key={m.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 font-medium text-white">{m.itemName}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{m.batch}</td>
              <td className="px-4 py-3 text-cyan-400">{m.from}</td>
              <td className="px-4 py-3 text-center text-slate-500"><ArrowLeftRight size={12} /></td>
              <td className="px-4 py-3 text-purple-400">{m.to}</td>
              <td className="px-4 py-3 text-right"><input type="number" value={m.qty} onChange={(e) => updateMovement(m.id, Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none" /></td>
            </tr>))}
          </tbody>
        </table>
      </div>)}
    </div>
  )
}
