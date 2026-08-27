import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Save, Printer, ArrowLeft } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import Typeahead from '../../components/ui/Typeahead'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { calculateInvoice } from '../../lib/invoiceCalculations'

interface LineItem { id: string; name: string; batch: string; stock: number; qty: number; free: number; rate: number; disc: number; gst: number; amount: number }
type CustomerOption = { label: string; value: string }
type ItemOption = { label: string; batch: string; stock: number; rate: number; gst: number }

export default function SaleEntry() {
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [items, setItems] = useState<LineItem[]>([])
  const [customer, setCustomer] = useState('')
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [prescriberName, setPrescriberName] = useState('')
  const [prescriptionReference, setPrescriptionReference] = useState('')
  const showToast = useUIStore((s) => s.showToast)
  const totals = items.length ? calculateInvoice(items.map((item) => ({ qty: item.qty, rate: item.rate, discount: item.disc, gstRate: item.gst }))) : calculateInvoice([])

  useEffect(() => {
    Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')]).then(([parties, products]) => {
      setCustomerOptions(parties.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => ({ label: p.name, value: p.name })))
      setItemOptions(products.flatMap((p) => (p.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => ({ label: p.name, batch: b.batch, stock: b.stock, rate: p.saleRate, gst: p.gstRate }))))
    }).catch((error) => showToast(error.message))
  }, [showToast])
  
  const addRow = (item: ItemOption) => {
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
  const saveInvoice = async () => { try { setSaving(true); const lines = items.map((item) => ({ ...item, freeQty: item.free, discount: item.disc, gstRate: item.gst })); const saved = await postErp<{ id: string }>('sales', { party: customer, lines, grandTotal: totals.grandTotal, patientName, prescriberName, prescriptionReference }); showToast(`Invoice ${saved.id} saved and posted to the customer ledger.`); setItems([]); setPatientName(''); setPrescriberName(''); setPrescriptionReference('') } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save invoice.') } finally { setSaving(false) } }
  const updateLine = (id: string, field: 'qty' | 'free' | 'rate' | 'disc', value: number) => setItems((rows) => rows.map((row) => { if (row.id !== id) return row; const next = { ...row, [field]: value }; next.amount = calculateInvoice([{ qty: Math.max(next.qty, 0.001), rate: Math.max(next.rate, 0), discount: Math.min(100, Math.max(next.disc, 0)), gstRate: next.gst }]).lines[0].total; return next }))

  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if (event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); if (customer && items.length && !saving) void saveInvoice() } if (event.key === 'F2') { event.preventDefault(); setShowItemSearch(true) } if (event.key === 'Escape') setShowItemSearch(false) }; window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut) })

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Tax Invoice" />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Sale Invoice (Alt+N)</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white font-medium"><Printer size={16} /></button>
          <button onClick={saveInvoice} disabled={saving || !customer || !items.length} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm text-white font-semibold">{saving ? 'Saving…' : 'Save (Alt+S)'}</button>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-xs text-slate-400 block mb-1">Customer</label>
        <Typeahead options={customerOptions} value={customer} onChange={setCustomer} placeholder="Search customer (Tab/Enter)..." autoFocus />
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
        <label className="text-xs text-slate-400">Patient (required for Schedule H/H1/X/NDPS)<input value={patientName} onChange={(e)=>setPatientName(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-white" /></label>
        <label className="text-xs text-slate-400">Prescriber<input value={prescriberName} onChange={(e)=>setPrescriberName(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-white" /></label>
        <label className="text-xs text-slate-400">Prescription reference<input value={prescriptionReference} onChange={(e)=>setPrescriptionReference(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-white" /></label>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-slate-300">
          <thead><tr className="bg-slate-950 border-b border-slate-800 uppercase text-slate-400"><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Free</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Disc%</th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-800">
                <td className="p-3">{item.name}</td>
                <td className="p-3 text-right"><input id={`row-${i}-qty`} min="1" max={item.stock} type="number" value={item.qty} onChange={(e) => updateLine(item.id, 'qty', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'qty')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-free`} min="0" type="number" value={item.free} onChange={(e) => updateLine(item.id, 'free', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'free')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-rate`} min="0" type="number" value={item.rate} onChange={(e) => updateLine(item.id, 'rate', Number(e.target.value))} className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'rate')} /></td>
                <td className="p-3 text-right"><input id={`row-${i}-disc`} min="0" max="100" type="number" value={item.disc} onChange={(e) => updateLine(item.id, 'disc', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right" onKeyDown={(e) => handleKeyDown(e, i, 'disc')} /></td>
                <td className="p-3 text-right font-mono">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ml-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
        <span className="text-slate-400">Subtotal</span><span className="text-right font-mono">{formatCurrency(totals.subtotal)}</span>
        <span className="text-slate-400">Discount</span><span className="text-right font-mono">-{formatCurrency(totals.discountTotal)}</span>
        <span className="text-slate-400">GST</span><span className="text-right font-mono">{formatCurrency(totals.taxTotal)}</span>
        <span className="text-slate-400">Rounding</span><span className="text-right font-mono">{formatCurrency(totals.roundingAdjustment)}</span>
        <span className="font-semibold text-white">Grand total</span><span className="text-right font-mono font-semibold text-white">{formatCurrency(totals.grandTotal)}</span>
      </div>
      
      {showItemSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 w-full max-w-md mx-4 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-semibold mb-3">Add Item</h3>
            {itemOptions.map((item, i) => (
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
