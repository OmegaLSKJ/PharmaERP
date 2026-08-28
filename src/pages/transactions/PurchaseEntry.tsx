import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Trash2, Save, Printer } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

interface LineItem {
  id: string
  itemName: string
  packing: string
  batch: string
  expiry: string
  qty: number
  freeQty: number
  purchaseRate: number
  discount: number
  scheme: number
  gstRate: number
  amount: number
  saleRate: number
  mrp: number
}

type SupplierOption = { name: string; gstin: string; outstanding: number }
type ItemOption = { name: string; packing: string; mrp: number; purchaseRate: number; saleRate: number; gstRate: number }

export default function PurchaseEntry() {
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<LineItem[]>([])
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [showSupplierSearch, setShowSupplierSearch] = useState(false)
  const [itemQuery, setItemQuery] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')

  const supplierRef = useRef<HTMLInputElement>(null)
  const invoiceNoRef = useRef<HTMLInputElement>(null)
  const invoiceDateRef = useRef<HTMLInputElement>(null)
  const entryDateRef = useRef<HTMLInputElement>(null)
  const itemRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const addToast = useUIStore((s) => s.addToast)

  // Fetch initial suppliers & items
  useEffect(() => {
    Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')])
      .then(([parties, products]) => {
        setSupplierOptions(
          parties
            .filter((p) => p.type === 'supplier' || p.type === 'both')
            .map((p) => ({ name: p.name, gstin: p.gstin ?? '', outstanding: Math.abs(Number(p.balance ?? 0)) }))
        )
        setItemOptions(
          products.map((p) => ({
            name: p.name,
            packing: p.packing ?? '',
            mrp: Number(p.mrp),
            purchaseRate: Number(p.purchaseRate),
            saleRate: Number(p.saleRate),
            gstRate: Number(p.gstRate)
          }))
        )
      })
      .catch((error) => addToast(error.message, 'error'))
  }, [addToast])

  // Focus Supplier input on initial load
  useEffect(() => {
    supplierRef.current?.focus()
  }, [])

  // Refocus input in modal when opened
  useEffect(() => {
    if (showItemSearch && itemRef.current) {
      setTimeout(() => itemRef.current?.focus(), 50)
    }
  }, [showItemSearch])

  const addItem = (item: ItemOption) => {
    const newId = Date.now().toString()
    setItems([
      ...items,
      {
        id: newId,
        itemName: item.name,
        packing: item.packing,
        batch: '',
        expiry: '',
        qty: 1,
        freeQty: 0,
        purchaseRate: item.purchaseRate,
        discount: 0,
        scheme: 0,
        gstRate: item.gstRate,
        amount: item.purchaseRate,
        saleRate: item.saleRate,
        mrp: item.mrp
      }
    ])
    setShowItemSearch(false)
    setItemQuery('')

    // Automatically focus the Batch input of the newly added row item
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[placeholder="Batch"]') as NodeListOf<HTMLInputElement>
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1]
        lastInput?.focus()
        lastInput?.select()
      }
    }, 80)
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        updated.amount = updated.purchaseRate * (1 - updated.discount / 100) * (1 - updated.scheme / 100) * updated.qty
        return updated
      })
    )
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const totalGst = items.reduce((sum, i) => sum + (i.amount * i.gstRate) / 100, 0)
  const grandTotal = subtotal + totalGst
  const totalValue = items.reduce((sum, i) => sum + i.mrp * (i.qty + i.freeQty), 0)

  const filteredItems = itemOptions.filter((i) => i.name.toLowerCase().includes(itemQuery.toLowerCase()))
  const filteredSuppliers = supplierOptions.filter((s) => s.name.toLowerCase().includes(supplierQuery.toLowerCase()))

  const savePurchase = async () => {
    if (!supplier || !items.length || !invoiceNo || !invoiceDate) {
      addToast('Supplier, invoice details and at least one item are required.', 'error')
      return
    }
    if (items.some((item) => !item.batch || !item.expiry || item.qty <= 0)) {
      addToast('Batch, expiry and a positive quantity are required for every item.', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await postErp<{ id: string }>('purchases', {
        party: supplier,
        supplierInvoice: invoiceNo,
        date: invoiceDate,
        subtotal,
        taxTotal: totalGst,
        total: grandTotal,
        lines: items.map((item) => ({
          name: item.itemName,
          batch: item.batch,
          expiry: item.expiry,
          qty: item.qty,
          freeQty: item.freeQty,
          rate: item.purchaseRate,
          discount: item.discount,
          gstRate: item.gstRate,
          mrp: item.mrp,
          amount: item.amount
        }))
      })
      addToast(`Purchase ${saved.id} posted`, 'success')
      setItems([])
      setSupplier('')
      setInvoiceNo('')
      setInvoiceDate('')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to post purchase', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard Navigation: Headers focus flow
  const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSupplierSearch && filteredSuppliers.length > 0) {
        setSupplier(filteredSuppliers[0].name)
        setShowSupplierSearch(false)
      }
      invoiceNoRef.current?.focus()
    }
  }

  // Keyboard Navigation: Row table inputs flow
  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const currentInput = e.target as HTMLInputElement
      const row = currentInput.closest('tr')
      if (!row) return

      const rowInputs = Array.from(row.querySelectorAll('input'))
      const index = rowInputs.indexOf(currentInput)

      if (index !== -1 && index < rowInputs.length - 1) {
        // Move to the next input cell in the same row
        rowInputs[index + 1].focus()
        rowInputs[index + 1].select?.()
      } else if (index === rowInputs.length - 1) {
        // We reached the last input (Scheme). Automatically trigger modal to add the next item!
        setShowItemSearch(true)
      }
    }
  }

  // Keyboard Selection: Modal item selection
  const handleModalItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems.length > 0) {
        addItem(filteredItems[0])
      }
    }
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Purchase Invoice" />
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Purchase Entry</h1>
          <p className="text-sm text-muted-foreground mt-1">Inward stock from supplier &bull; Batch + Expiry mandatory</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={savePurchase}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground disabled:opacity-50 rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Save size={16} /> {saving ? 'Posting…' : 'Post Purchase'}
          </button>
        </div>
      </div>

      {/* Header Fields Panel */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Supplier</label>
            <div className="relative">
              <input
                ref={supplierRef}
                type="text"
                value={supplier}
                onChange={(e) => {
                  setSupplier(e.target.value)
                  setSupplierQuery(e.target.value)
                  setShowSupplierSearch(true)
                }}
                onKeyDown={handleSupplierKeyDown}
                placeholder="Search supplier..."
                className="w-full bg-card border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-primary transition"
              />
              {showSupplierSearch && supplierQuery && (
                <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => {
                        setSupplier(s.name)
                        setShowSupplierSearch(false)
                        invoiceNoRef.current?.focus()
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary text-foreground transition-colors"
                    >
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">Outstanding: {formatCurrency(s.outstanding)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Supplier Invoice No.</label>
            <input
              ref={invoiceNoRef}
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invoiceDateRef.current?.focus()}
              placeholder="e.g. SI-2026/045"
              className="w-full bg-card border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-primary transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Invoice Date</label>
            <input
              ref={invoiceDateRef}
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entryDateRef.current?.focus()}
              className="w-full bg-card border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-primary transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Entry Date</label>
            <input
              ref={entryDateRef}
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setShowItemSearch(true)}
              className="w-full bg-card border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-primary transition"
            />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Line Items ({items.length})</h3>
          <button
            onClick={() => setShowItemSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
                <th className="p-3 text-left w-10">#</th>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left w-32">Batch</th>
                <th className="p-3 text-left w-36">Expiry</th>
                <th className="p-3 text-right w-20">Qty</th>
                <th className="p-3 text-right w-16">Free</th>
                <th className="p-3 text-right w-24">Purc. Rate</th>
                <th className="p-3 text-right w-16">Disc%</th>
                <th className="p-3 text-right w-20">Scheme%</th>
                <th className="p-3 text-right w-16">GST%</th>
                <th className="p-3 text-right w-28">Amount</th>
                <th className="p-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="p-3 text-muted-foreground">{idx + 1}</td>
                  <td className="p-3 font-semibold text-foreground">
                    {item.itemName}
                    <br />
                    <span className="text-muted-foreground font-normal">{item.packing}</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={item.batch}
                      onChange={(e) => updateItem(item.id, 'batch', e.target.value)}
                      onKeyDown={handleRowKeyDown}
                      placeholder="Batch"
                      className="w-full bg-card border border-border rounded p-1 text-foreground outline-none focus:border-primary font-mono text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={item.expiry}
                      onChange={(e) => updateItem(item.id, 'expiry', e.target.value)}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-foreground outline-none focus:border-primary text-xs"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-right text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      value={item.freeQty}
                      onChange={(e) => updateItem(item.id, 'freeQty', Number(e.target.value))}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-right text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      value={item.purchaseRate}
                      onChange={(e) => updateItem(item.id, 'purchaseRate', Number(e.target.value))}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-right text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      value={item.discount}
                      onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value))}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-right text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      value={item.scheme}
                      onChange={(e) => updateItem(item.id, 'scheme', Number(e.target.value))}
                      onKeyDown={handleRowKeyDown}
                      className="w-full bg-card border border-border rounded p-1 text-right text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="p-3 text-right text-muted-foreground font-mono">{item.gstRate}%</td>
                  <td className="p-3 text-right font-bold text-foreground font-mono">{formatCurrency(item.amount)}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => setItems(items.filter((i) => i.id !== item.id))} className="text-muted-foreground hover:text-rose-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    No items added. Click "Add Item" to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border p-4 flex justify-end">
          <div className="w-80 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST</span>
              <span className="font-mono">{formatCurrency(totalGst)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>MRP Value</span>
              <span className="font-mono">{formatCurrency(totalValue)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
              <span>Grand Total</span>
              <span className="font-mono text-lg">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Item Search Modal */}
      {showItemSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-50" onClick={() => setShowItemSearch(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/20">
              <Search size={16} className="text-muted-foreground" />
              <input
                ref={itemRef}
                type="text"
                placeholder="Search items..."
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                onKeyDown={handleModalItemKeyDown}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={() => setShowItemSearch(false)} className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground">
                ESC
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/40">
              {filteredItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addItem(item)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition text-left"
                >
                  <div>
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.packing}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium text-foreground">{formatCurrency(item.purchaseRate)}</div>
                    <div className="text-xs text-muted-foreground">MRP: {item.mrp}</div>
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No matching items found.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
