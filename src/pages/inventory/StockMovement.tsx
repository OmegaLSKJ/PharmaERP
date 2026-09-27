import { useState } from 'react'
import { Save, ArrowLeftRight } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface Movement { id: string; itemName: string; batch: string; from: string; to: string; qty: number }
interface StockOption { name: string; batch: string; stock: Record<string, number> }

export default function StockMovement() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [locations, setLocations] = useState<string[]>([])
  const [availableItems, setAvailableItems] = useState<StockOption[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [fromLoc, setFromLoc] = useState('')
  const [toLoc, setToLoc] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => { Promise.all([getErp<any[]>('warehouses'), getErp<any[]>('items')]).then(([warehouses, items]) => { const names = warehouses.map((row) => row.name); setLocations(names); if (names[0]) setFromLoc(names[0]); if (names[1]) setToLoc(names[1]); setAvailableItems(items.flatMap((item) => (item.batches ?? []).map((batch: any) => ({ name: item.name, batch: batch.batch, stock: batch.stockByLocation ?? {} })))) }).catch((e) => showToast(e.message)) }, [showToast])

  const addMovement = (item: StockOption) => {
    if (fromLoc === toLoc) return
    const avail = item.stock[fromLoc as keyof typeof item.stock] || 0
    if (avail <= 0) return
    setMovements([...movements, { id: Date.now().toString(), itemName: item.name, batch: item.batch, from: fromLoc, to: toLoc, qty: Math.min(10, avail) }])
  }
  const updateMovement = (id: string, qty: number) => {
    setMovements(movements.map(m => m.id === id ? { ...m, qty } : m))
  }
  const removeMovement = (id: string) => setMovements(movements.filter(m => m.id !== id))
  const saveTransfer = async () => { if (!movements.length) { showToast('Add at least one transfer line.'); return } setSaving(true); try { const saved = await postErp<{ id: string }>('stock-transfers', { date, lines: movements }); showToast(`Transfer ${saved.id} posted.`); setMovements([]) } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to post transfer.') } finally { setSaving(false) } }

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Stock Movement</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2"><ArrowLeftRight size={14} className="text-cyan-500 dark:text-cyan-400" /> Inter-godown / store transfer</p></div>
        <button onClick={saveTransfer} disabled={saving || !movements.length} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition cursor-pointer"><Save size={16} /> {saving ? 'Posting…' : 'Save Transfer'}</button>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">From Location</label>
            <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500">
              {locations.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div className="flex items-center justify-center"><ArrowLeftRight size={20} className="text-cyan-500 dark:text-cyan-400" /></div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">To Location</label>
            <select value={toLoc} onChange={(e) => setToLoc(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500">
              {locations.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
        </div>
      </div>
      {fromLoc !== toLoc && (<div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Available in {fromLoc}</h3></div>
        <div className="divide-y divide-border">
          {availableItems.filter(i => (i.stock[fromLoc] || 0) > 0).map(item => {
            const avail = item.stock[fromLoc] || 0
            return (<div key={item.batch} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-secondary/40">
              <div><div className="text-sm font-medium text-foreground">{item.name}</div><div className="text-xs text-muted-foreground font-mono">{item.batch}</div></div>
              <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Avail: {avail}</span>
                <button onClick={() => addMovement(item)} className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded text-xs font-semibold transition cursor-pointer">Transfer</button>
              </div>
            </div>)
          })}
        </div>
      </div>)}
      {movements.length > 0 && (<div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Transfer Queue ({movements.length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[550px]">
            <thead><tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">From</th><th className="text-center px-4 py-3 font-medium"><ArrowLeftRight size={12} /></th><th className="text-left px-4 py-3 font-medium">To</th><th className="text-right px-4 py-3 font-medium">Qty</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-foreground">
              {movements.map(m => (<tr key={m.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium text-foreground">{m.itemName}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{m.batch}</td>
                <td className="px-4 py-3 text-cyan-600 dark:text-cyan-400 font-medium">{m.from}</td>
                <td className="px-4 py-3 text-center text-muted-foreground"><ArrowLeftRight size={12} /></td>
                <td className="px-4 py-3 text-purple-600 dark:text-purple-400 font-medium">{m.to}</td>
                <td className="px-4 py-3 text-right"><input type="number" min="1" value={m.qty} onChange={(e) => updateMovement(m.id, Number(e.target.value))} className="w-16 bg-background border border-border rounded p-1 text-right text-foreground outline-none" /><button aria-label={`Remove ${m.itemName}`} onClick={() => removeMovement(m.id)} className="ml-2 text-rose-500 hover:text-rose-600 font-bold cursor-pointer">×</button></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </div>)}
    </div>
  )
}
