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
    <div className="p-3 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Replacement Entry</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2"><ArrowLeftRight size={14} className="text-cyan-500 dark:text-cyan-400" /> Issue or receive replacement stock</p></div>
        <button onClick={saveReplacement} disabled={saving || !party || !lines.length} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md active:scale-[0.98] transition cursor-pointer"><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Mode</label>
            <div className="flex rounded-lg border border-border overflow-hidden p-0.5 bg-secondary/50">
              <button onClick={() => setMode('issue')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98] cursor-pointer', mode === 'issue' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground')}>Issue</button>
              <button onClick={() => setMode('receive')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md transition active:scale-[0.98] cursor-pointer', mode === 'receive' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground')}>Receive</button>
            </div></div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Party</label>
            <input list="replacement-parties" type="text" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Search party..." className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500" /><datalist id="replacement-parties">{parties.map((name) => <option key={name} value={name} />)}</datalist></div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex items-end"><div className="bg-secondary/40 border border-border rounded-lg p-2 w-full"><div className="text-[10px] text-muted-foreground uppercase font-medium">Total</div><div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(totalValue)}</div></div></div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-foreground">Available Items</h3>
          <span className="text-xs text-muted-foreground">{mode === 'issue' ? 'Select items to issue' : 'Select items to receive'}</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {availableItems.map(item => (<button key={item.batch} onClick={() => addItem(item)} className={cn('text-left p-3 rounded-lg border transition cursor-pointer', mode === 'issue' ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10')}>
            <div className="text-sm font-medium text-foreground">{item.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{item.batch} | Rate: {formatCurrency(item.rate)}</div>
          </button>))}
        </div>
      </div>
      {lines.length > 0 && (<div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[680px]">
            <thead><tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium min-w-[220px]">Item</th>
              <th className="text-left px-4 py-3 font-medium min-w-[120px]">Batch</th>
              <th className="text-right px-4 py-3 font-medium min-w-[80px]">Qty</th>
              <th className="text-right px-4 py-3 font-medium min-w-[90px]">Rate</th>
              <th className="text-right px-4 py-3 font-medium min-w-[100px]">Value</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-foreground">
              {lines.map(l => (<tr key={l.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium text-foreground min-w-[220px]">{l.name}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground min-w-[120px]">{l.batch}</td>
                <td className="px-4 py-3 text-right min-w-[80px]">
                  <input
                    type="number"
                    value={l.qty}
                    onChange={(e) => updateLine(l.id, 'qty', Number(e.target.value))}
                    className="w-20 bg-background border border-border rounded p-1 text-right text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono min-w-[90px]">{formatCurrency(l.rate)}</td>
                <td className="px-4 py-3 text-right font-mono text-cyan-600 dark:text-cyan-400 font-semibold min-w-[100px] whitespace-nowrap">{formatCurrency(l.qty * l.rate)}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </div>)}
      <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Remark</label>
        <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500" placeholder="Enter remark..." /></div>
    </div>
  )
}
