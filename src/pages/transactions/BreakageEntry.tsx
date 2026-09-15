import { useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface AvailableItem { name: string; batch: string; expiry: string; stock: number; mrp: number; rate: number }
interface Line { id: string; name: string; batch: string; expiry: string; qty: number; rate: number; reason: string }

export default function BreakageEntry() {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [entryType, setEntryType] = useState<'expiry' | 'breakage'>('expiry')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { getErp<any[]>('items').then((items) => setAvailableItems(items.flatMap((item) => (item.batches ?? []).filter((batch:any) => batch.stock > 0).map((batch:any) => ({ name:item.name, batch:batch.batch, expiry:batch.expiry ?? '', stock:batch.stock, mrp:batch.mrp || item.mrp, rate:item.purchaseRate }))))).catch((e) => showToast(e.message)) }, [showToast])

  const addItem = (item: AvailableItem) => {
    setLines([...lines, { id: Date.now().toString(), name: item.name, batch: item.batch, expiry: item.expiry, qty: 1, rate: item.rate, reason: '' }])
  }
  const updateLine = (id: string, field: keyof Line, value: string | number) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
  const totalValue = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const saveEntry = async () => { if (!lines.length) { showToast('Add at least one stock line.'); return } setSaving(true); try { const saved = await postErp<{number:string}>('breakages', { entryType, date, remark, total:totalValue, lines }); showToast(`${saved.number} posted and inventory adjusted.`); setLines([]); setRemark('') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to post stock adjustment.') } finally { setSaving(false) } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Breakage / Expiry Entry</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /> Record expired or damaged stock</p>
        </div>
        <button onClick={saveEntry} disabled={saving || !lines.length} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md active:scale-[0.98] transition cursor-pointer"><Save size={16} /> {saving ? 'Posting…' : 'Save Entry'}</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Entry Type</label>
            <div className="flex rounded-lg border border-slate-800 overflow-hidden p-0.5 bg-slate-950/60">
              <button onClick={() => setEntryType('expiry')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98]', entryType === 'expiry' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}>Expiry Return</button>
              <button onClick={() => setEntryType('breakage')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98]', entryType === 'breakage' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}>Breakage</button>
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
          {availableItems.map((item) => {
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
