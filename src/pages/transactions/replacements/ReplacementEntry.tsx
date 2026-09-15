import { useState } from 'react'
import { Save, ArrowLeftRight } from 'lucide-react'
import { useEffect } from 'react'
import { cn, formatCurrency } from '../../../lib/utils'
import { getErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Line { id: string; name: string; batch: string; qty: number; rate: number; type: 'issue' | 'receive' }

interface AvailableItem { name: string; batch: string; rate: number }

export default function ReplacementEntry() {
  const [mode, setMode] = useState<'issue' | 'receive'>('issue')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [party, setParty] = useState('')
  const [parties, setParties] = useState<string[]>([])
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => { Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')]).then(([partyRows, itemRows]) => { setParties(partyRows.map((row) => row.name)); setAvailableItems(itemRows.flatMap((item) => (item.batches ?? []).map((batch: any) => ({ name: item.name, batch: batch.batch, rate: item.purchaseRate })))) }).catch((error) => showToast(error.message)) }, [showToast])

  const addItem = (item: AvailableItem) => {
    setLines([...lines, { id: Date.now().toString(), name: item.name, batch: item.batch, qty: 1, rate: item.rate, type: mode }])
  }
  const updateLine = (id: string, field: keyof Line, value: string | number) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
  const totalValue = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const saveReplacement = async () => { if (!party || !lines.length) { showToast('Party and at least one item are required.'); return } setSaving(true); try { const saved = await postErp<{number:string}>('replacements', { party, mode, date, remark, total:totalValue, lines }); showToast(`Replacement ${saved.number} saved.`); setLines([]); setRemark('') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save replacement.') } finally { setSaving(false) } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Replacement Entry</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-2"><ArrowLeftRight size={14} className="text-cyan-400" /> Issue or receive replacement stock</p></div>
        <button onClick={saveReplacement} disabled={saving || !party || !lines.length} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md active:scale-[0.98] transition cursor-pointer"><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Mode</label>
            <div className="flex rounded-lg border border-slate-800 overflow-hidden p-0.5 bg-slate-950/60">
              <button onClick={() => setMode('issue')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98]', mode === 'issue' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}>Issue</button>
              <button onClick={() => setMode('receive')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98]', mode === 'receive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white')}>Receive</button>
            </div></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Party</label>
            <input list="replacement-parties" type="text" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Search party..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /><datalist id="replacement-parties">{parties.map((name) => <option key={name} value={name} />)}</datalist></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex items-end"><div className="bg-slate-950 border border-slate-800 rounded-lg p-2 w-full"><div className="text-[10px] text-slate-400 uppercase">Total</div><div className="text-lg font-bold text-cyan-400">{formatCurrency(totalValue)}</div></div></div>
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white">Available Items</h3>
          <span className="text-xs text-slate-400">{mode === 'issue' ? 'Select items to issue' : 'Select items to receive'}</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {availableItems.map(item => (<button key={item.batch} onClick={() => addItem(item)} className={cn('text-left p-3 rounded-lg border transition', mode === 'issue' ? 'border-rose-800/50 hover:bg-rose-900/20' : 'border-emerald-800/50 hover:bg-emerald-900/20')}>
            <div className="text-sm font-medium text-white">{item.name}</div>
            <div className="text-xs text-slate-500 font-mono">{item.batch} | Rate: {formatCurrency(item.rate)}</div>
          </button>))}
        </div>
      </div>
      {lines.length > 0 && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Rate</th><th className="text-right px-4 py-3 font-medium">Value</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {lines.map(l => (<tr key={l.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 font-medium text-white">{l.name}</td><td className="px-4 py-3 font-mono text-slate-400">{l.batch}</td>
              <td className="px-4 py-3 text-right"><input type="number" value={l.qty} onChange={(e) => updateLine(l.id, 'qty', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none" /></td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(l.rate)}</td>
              <td className="px-4 py-3 text-right font-mono text-cyan-400">{formatCurrency(l.qty * l.rate)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>)}
      <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Remark</label>
        <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" placeholder="Enter remark..." /></div>
    </div>
  )
}
