import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Save, Printer, ArrowLeft } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import Typeahead from '../../components/ui/Typeahead'
import { postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface LineItem { id: string; name: string; batch: string; stock: number; qty: number; free: number; rate: number; disc: number; gst: number; amount: number }

const CUSTOMERS = [{ label: 'MediCare Pharma', value: '1' }, { label: 'HealthFirst', value: '2' }, { label: 'CareWell', value: '3' }]
const ITEMS = [{ label: 'Amoxicillin 500mg', batch: 'AMX-001', stock: 240, rate: 152, gst: 12 }, { label: 'Paracetamol 650mg', batch: 'PCM-002', stock: 380, rate: 76, gst: 12 }]

export default function SaleEntry() {
  const [items, setItems] = useState<LineItem[]>([])
  const [customer, setCustomer] = useState('')
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  
  const addRow = (item: typeof ITEMS[0]) => {
    setItems([...items, { id: Date.now().toString(), name: item.label, batch: item.batch, stock: item.stock, qty: 1, free: 0, rate: item.rate, disc: 0, gst: item.gst, amount: item.rate }])
    setShowItemSearch(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent, row: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextField = field === 'qty' ? 'free' : field === 'free' ? 'rate' : field === 'rate' ? 'disc' : null
      if (nextField) document.getElementById(`row-${row}-${nextField}`)?.focus()
      else setShowItemSearch(true)
    }
    if (e.key === 'F2') setShowItemSearch(true)
  }
  const saveInvoice = async () => { try { setSaving(true); const total = items.reduce((sum, item) => sum + item.amount, 0); const saved = await postErp<{ id: string }>('sales', { party: customer, lines: items, total }); showToast(`Invoice ${saved.id} saved and posted to the customer ledger.`); setItems([]) } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save invoice.') } finally { setSaving(false) } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Sale Invoice (Alt+N)</h1>
        <div className="flex gap-2">
          <button onClick={saveInvoice} disabled={saving || !customer || !items.length} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm text-white font-semibold">{saving ? 'Saving…' : 'Save (Alt+S)'}</button>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-xs text-slate-400 block mb-1">Customer</label>
        <Typeahead options={CUSTOMERS} value={customer} onChange={setCustomer} placeholder="Search customer (Tab/Enter)..." autoFocus />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-slate-300">
          <thead><tr className="bg-slate-950 border-b border-slate-800 uppercase text-slate-400"><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Free</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Disc%</th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-800">
                <td className="p-3">{item.name}</td>
                <td className="p-3 text-right"><input id={`row-${i}-qty`} type="number" value={item.qty} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'qty')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-free`} type="number" value={item.free} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'free')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-rate`} type="number" value={item.rate} className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'rate')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-disc`} type="number" value={item.disc} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'disc')} /></td>
                <td className="p-3 text-right font-mono">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showItemSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-900 w-96 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-semibold mb-3">Add Item</h3>
            {ITEMS.map((item, i) => (
              <button key={item.label} onClick={() => addRow(item)} className={cn("w-full p-2 text-left rounded-lg text-sm", activeIndex === i ? "bg-indigo-900" : "hover:bg-slate-800")}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 p-2 text-[10px] text-center uppercase tracking-widest text-slate-400">
        F2: Item Search | Enter: Next Field/Row | Alt+S: Save | Esc: Cancel
      </div>
    </div>
  )
}
