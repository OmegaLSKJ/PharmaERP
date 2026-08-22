import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Trash2, Save, Printer } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface LineItem {
  id: string; itemName: string; packing: string; batch: string; expiry: string;
  qty: number; freeQty: number; purchaseRate: number; discount: number;
  scheme: number; gstRate: number; amount: number; saleRate: number; mrp: number
}

const SUPPLIER_OPTIONS = [
  { name: 'Sun Pharma Industries', gstin: '27DDDSS3456J1Z4', outstanding: 230000 },
  { name: 'Cipla Ltd', gstin: '27EEECI7890K1Z7', outstanding: 560000 },
  { name: 'Dr. Reddy\'s Laboratories', gstin: '36GGGDR5678M1Z3', outstanding: 180000 },
  { name: 'Ranbaxy Laboratories', gstin: '06IIIRB3456P1Z9', outstanding: 95000 },
]

const ITEM_OPTIONS = [
  { name: 'Amoxicillin 500mg', packing: '10x10', mrp: 180, purchaseRate: 85, saleRate: 152, gstRate: 12 },
  { name: 'Paracetamol 650mg', packing: '10x10', mrp: 90, purchaseRate: 35, saleRate: 76, gstRate: 12 },
  { name: 'Azithromycin 250mg', packing: '10x6', mrp: 240, purchaseRate: 120, saleRate: 202, gstRate: 12 },
  { name: 'Cetirizine 10mg', packing: '10x10', mrp: 75, purchaseRate: 28, saleRate: 63, gstRate: 12 },
  { name: 'Metformin 500mg', packing: '10x10', mrp: 120, purchaseRate: 55, saleRate: 101, gstRate: 12 },
  { name: 'Pantoprazole 40mg', packing: '10x10', mrp: 150, purchaseRate: 68, saleRate: 126, gstRate: 12 },
]

export default function PurchaseEntry() {
  const [supplierOptions, setSupplierOptions] = useState(SUPPLIER_OPTIONS)
  const [itemOptions, setItemOptions] = useState(ITEM_OPTIONS)
  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<LineItem[]>([])
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [showSupplierSearch, setShowSupplierSearch] = useState(false)
  const [itemQuery, setItemQuery] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const itemRef = useRef<HTMLInputElement>(null)
  const supplierRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const addToast = useUIStore((s) => s.addToast)

  useEffect(() => {
    Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')]).then(([parties, products]) => {
      setSupplierOptions(parties.filter((p) => p.type === 'supplier' || p.type === 'both').map((p) => ({ name: p.name, gstin: p.gstin ?? '', outstanding: Math.abs(Number(p.balance ?? 0)) })))
      setItemOptions(products.map((p) => ({ name: p.name, packing: p.packing ?? '', mrp: Number(p.mrp), purchaseRate: Number(p.purchaseRate), saleRate: Number(p.saleRate), gstRate: Number(p.gstRate) })))
    }).catch((error) => addToast(error.message, 'error'))
  }, [addToast])

  useEffect(() => {
    if (showItemSearch && itemRef.current) itemRef.current.focus()
    if (showSupplierSearch && supplierRef.current) supplierRef.current.focus()
  }, [showItemSearch, showSupplierSearch])

  const addItem = (item: typeof ITEM_OPTIONS[0]) => {
    setItems([...items, {
      id: Date.now().toString(), itemName: item.name, packing: item.packing,
      batch: '', expiry: '', qty: 1, freeQty: 0, purchaseRate: item.purchaseRate,
      discount: 0, scheme: 0, gstRate: item.gstRate, amount: item.purchaseRate,
      saleRate: item.saleRate, mrp: item.mrp,
    }])
    setShowItemSearch(false); setItemQuery('')
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.amount = updated.purchaseRate * (1 - updated.discount / 100) * (1 - updated.scheme / 100) * updated.qty
      return updated
    }))
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const totalGst = items.reduce((sum, i) => sum + (i.amount * i.gstRate / 100), 0)
  const grandTotal = subtotal + totalGst
  const totalValue = items.reduce((sum, i) => sum + i.mrp * (i.qty + i.freeQty), 0)

  const filteredItems = itemOptions.filter(i => i.name.toLowerCase().includes(itemQuery.toLowerCase()))
  const filteredSuppliers = supplierOptions.filter(s => s.name.toLowerCase().includes(supplierQuery.toLowerCase()))
  const savePurchase = async () => {
    if (!supplier || !items.length || !invoiceNo || !invoiceDate) { addToast('Supplier, invoice details and at least one item are required.', 'error'); return }
    if (items.some((item) => !item.batch || !item.expiry || item.qty <= 0)) { addToast('Batch, expiry and a positive quantity are required for every item.', 'error'); return }
    setSaving(true)
    try {
      const saved = await postErp<{ id: string }>('purchases', { party: supplier, supplierInvoice: invoiceNo, date: invoiceDate, subtotal, taxTotal: totalGst, total: grandTotal, lines: items.map((item) => ({ name: item.itemName, batch: item.batch, expiry: item.expiry, qty: item.qty, freeQty: item.freeQty, rate: item.purchaseRate, discount: item.discount, gstRate: item.gstRate, mrp: item.mrp, amount: item.amount })) })
      addToast(`Purchase ${saved.id} posted`, 'success'); setItems([]); setSupplier(''); setInvoiceNo(''); setInvoiceDate('')
    } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to post purchase', 'error') } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Entry</h1>
          <p className="text-sm text-slate-400 mt-1">Inward stock from supplier &bull; Batch + Expiry mandatory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
            <Printer size={16} /> Print
          </button>
          <button onClick={savePurchase} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md transition">
            <Save size={16} /> {saving ? 'Posting…' : 'Post Purchase'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:colspan-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Supplier</label>
            <div className="relative">
              <input type="text" value={supplier} onChange={(e) => { setSupplier(e.target.value); setShowSupplierSearch(true) }} placeholder="Search supplier..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
              {showSupplierSearch && supplier && (
                <div className="absolute z-10 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredSuppliers.map(s => (
                    <button key={s.name} onClick={() => { setSupplier(s.name); setShowSupplierSearch(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 text-white">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-slate-400">Outstanding: {formatCurrency(s.outstanding)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Supplier Invoice No.</label>
            <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. SI-2026/045" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Invoice Date</label>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Entry Date</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Line Items ({items.length})</h3>
          <button onClick={() => setShowItemSearch(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">
            <Plus size={14} /> Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">Batch</th>
                <th className="p-3 text-left">Expiry</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Free</th>
                <th className="p-3 text-right">Purc. Rate</th>
                <th className="p-3 text-right">Disc%</th>
                <th className="p-3 text-right">Scheme%</th>
                <th className="p-3 text-right">GST%</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-900/30">
                  <td className="p-3 text-slate-500">{idx + 1}</td>
                  <td className="p-3 font-medium text-white">{item.itemName}<br/><span className="text-slate-500">{item.packing}</span></td>
                  <td className="p-3"><input type="text" value={item.batch} onChange={(e) => updateItem(item.id, 'batch', e.target.value)} placeholder="Batch" className="w-28 bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none focus:border-indigo-500 font-mono text-[10px]" /></td>
                  <td className="p-3"><input type="date" value={item.expiry} onChange={(e) => updateItem(item.id, 'expiry', e.target.value)} className="w-28 bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none focus:border-indigo-500 text-[10px]" /></td>
                  <td className="p-3 text-right"><input type="number" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))} className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none focus:border-indigo-500" /></td>
                  <td className="p-3 text-right"><input type="number" value={item.freeQty} onChange={(e) => updateItem(item.id, 'freeQty', Number(e.target.value))} className="w-14 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none focus:border-indigo-500" /></td>
                  <td className="p-3 text-right"><input type="number" value={item.purchaseRate} onChange={(e) => updateItem(item.id, 'purchaseRate', Number(e.target.value))} className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none focus:border-indigo-500" /></td>
                  <td className="p-3 text-right"><input type="number" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value))} className="w-14 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none focus:border-indigo-500" /></td>
                  <td className="p-3 text-right"><input type="number" value={item.scheme} onChange={(e) => updateItem(item.id, 'scheme', Number(e.target.value))} className="w-14 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white outline-none focus:border-indigo-500" /></td>
                  <td className="p-3 text-right text-slate-400">{item.gstRate}%</td>
                  <td className="p-3 text-right font-medium text-white">{formatCurrency(item.amount)}</td>
                  <td className="p-3 text-center"><button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-slate-500">No items added. Click "Add Item" to begin.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-800 p-4 flex justify-end">
          <div className="w-80 space-y-2">
            <div className="flex justify-between text-sm text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-slate-400"><span>GST</span><span>{formatCurrency(totalGst)}</span></div>
            <div className="flex justify-between text-sm text-slate-400"><span>MRP Value</span><span>{formatCurrency(totalValue)}</span></div>
            <div className="flex justify-between text-lg font-bold text-white border-t border-slate-700 pt-2"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
          </div>
        </div>
      </div>

      {/* Item Search Modal */}
      {showItemSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-50" onClick={() => setShowItemSearch(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
              <Search size={16} className="text-slate-400" />
              <input ref={itemRef} type="text" placeholder="Search items..." value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-500" />
              <button onClick={() => setShowItemSearch(false)} className="text-xs border border-slate-700 rounded px-1.5 py-0.5 text-slate-400 hover:text-white">ESC</button>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredItems.map((item) => (
                <button key={item.name} onClick={() => addItem(item)} className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition text-left">
                  <div><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.packing}</div></div>
                  <div className="text-right"><div className="font-mono">{formatCurrency(item.purchaseRate)}</div><div className="text-xs text-slate-500">MRP: {item.mrp}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
