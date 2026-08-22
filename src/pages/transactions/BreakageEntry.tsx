import { useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'

const ITEMS = [
  { name: 'Amoxicillin 500mg', batch: 'AMX-2025-118', expiry: '2026-04-15', stock: 200, mrp: 180, rate: 85 },
  { name: 'Ciprofloxacin 500mg', batch: 'CIP-2025-042', expiry: '2026-04-20', stock: 150, mrp: 160, rate: 72 },
  { name: 'Metronidazole 400mg', batch: 'MET-2025-091', expiry: '2026-05-01', stock: 300, mrp: 95, rate: 38 },
  { name: 'Omeprazole 20mg', batch: 'OMP-2025-073', expiry: '2026-05-10', stock: 180, mrp: 110, rate: 48 },
]

interface Line { id: string; name: string; batch: string; expiry: string; qty: number; rate: number; reason: string }

export default function BreakageEntry() {
  const [entryType, setEntryType] = useState<'expiry' | 'breakage'>('expiry')
  const [date, setDate] = useState('2026-03-16')
  const [lines, setLines] = useState<Line[]>([])
  const [remark, setRemark] = useState('')

  const addItem = (item: typeof ITEMS[0]) => {
    setLines([...lines, { id: Date.now().toString(), name: item.name, batch: item.batch, expiry: item.expiry, qty: 1, rate: item.rate, reason: '' }])
  }
  const updateLine = (id: string, field: keyof Line, value: string | number) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
  const totalValue = lines.reduce((a, l) => a + l.qty * l.rate, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Breakage / Expiry Entry</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /> Record expired or damaged stock</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"><Save size={16} /> Save Entry</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Entry Type</label>
            <div className="flex rounded-lg border border-slate-800 overflow-hidden">
              <button onClick={() => setEntryType('expiry')} className={cn('flex-1 p-2 text-sm font-medium transition', entryType === 'expiry' ? 'bg-amber-600 text-white' : 'bg-slate-950 text-slate-400')}>Expiry Return</button>
              <button onClick={() => setEntryType('breakage')} className={cn('flex-1 p-2 text-sm font-medium transition', entryType === 'breakage' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400')}>Breakage</button>
            </div></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex items-end"><div className="bg-slate-950 border border-slate-800 rounded-lg p-2 w-full"><div className="text-[10px] text-slate-400 uppercase">Total Value</div><div className="text-lg font-bold text-amber-400">{formatCurrency(totalValue)}</div></div></div>
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Items ({lines.length})</h3></div>
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">Expiry</th><th className="text-right px-4 py-3 font-medium">Days Left</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Rate</th><th className="text-right px-4 py-3 font-medium">Value</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {lines.map((l, i) => {
              const days = daysUntilExpiry(l.expiry)
              return (<tr key={l.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{l.batch}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{l.expiry}</td>
                <td className="px-4 py-3 text-right"><span className={cn('font-medium', days <= 30 ? 'text-red-400' : 'text-amber-400')}>{days}d</span></td>
                <td className="px-4 py-3 text-right"><input type="number" value={l.qty} onChange={(e) => updateLine(l.id, 'qty', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none" /></td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(l.rate)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(l.qty * l.rate)}</td>
              </tr>)
            })}
            {lines.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Select near-expiry items from the list below</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><AlertTriangle size={14} /> Near-Expiry Items</h3></div>
        <div className="divide-y divide-slate-800">
          {ITEMS.map((item) => {
            const days = daysUntilExpiry(item.expiry)
            return (<div key={item.batch} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30">
              <div><div className="text-sm font-medium text-white">{item.name}</div><div className="text-xs text-slate-500 font-mono">{item.batch} | Stock: {item.stock}</div></div>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs font-semibold', days <= 30 ? 'text-red-400' : 'text-amber-400')}>{days}d left</span>
                <span className="text-xs font-mono text-slate-400">Exp: {item.expiry}</span>
                <button onClick={() => addItem(item)} className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded text-xs font-semibold transition">Add</button>
              </div>
            </div>)
          })}
        </div>
      </div>
      <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Remark</label>
        <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" placeholder="Enter remark..." /></div>
    </div>
  )
}
