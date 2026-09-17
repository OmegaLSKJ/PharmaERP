import { useState, useEffect } from 'react'
import { Save, Truck, Trash2, Printer, Plus, Minus, X, Edit3 } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import Typeahead, { TOption } from '../../components/ui/Typeahead'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'

interface AvailableItem {
  name: string
  batch: string
  rate: number
  stock: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
}
interface Line {
  id: string
  name: string
  batch: string
  qty: number
  rate: number
  stock?: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
}
interface SavedChallan { id: string; dbId: string; party: string; date: string; transport: string; status: string; lines: Line[] }

export default function ChallanEntry() {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [parties, setParties] = useState<string[]>([])
  const [party, setParty] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [transport, setTransport] = useState('Surface')
  const [saving, setSaving] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [savedChallans, setSavedChallans] = useState<SavedChallan[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  useEffect(() => {
    Promise.all([getErp<any[]>('parties'), getErp<any[]>('items'), getErp<SavedChallan[]>('challans')])
      .then(([partyRows, productRows, challanRows]) => {
        setParties(partyRows.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => p.name))
        setAvailableItems(
          productRows.flatMap((p) =>
            (p.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => ({
              name: p.name,
              batch: b.batch,
              rate: p.saleRate,
              stock: b.stock,
              mrp: b.mrp || p.mrp || 0,
              purchaseRate: b.purchaseRate || p.purchaseRate || 0,
              packing: p.packing || '',
              manufacturer: p.manufacturer || p.company || '',
              salt: p.salt || p.composition || '',
              hsn: p.hsn || '',
              expiry: b.expiry || '',
            }))
          )
        )
        setSavedChallans(challanRows || [])
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  const addItem = (i: AvailableItem) => {
    const existingIndex = lines.findIndex((l) => l.name === i.name && l.batch === i.batch)
    if (existingIndex >= 0) {
      setLines((prev) => prev.map((l, idx) => (idx === existingIndex ? { ...l, qty: l.qty + 1 } : l)))
      setActiveIndex(existingIndex)
    } else {
      const newLine: Line = {
        id: Date.now().toString(),
        name: i.name,
        batch: i.batch,
        qty: 1,
        rate: i.rate,
        stock: i.stock,
        mrp: i.mrp,
        purchaseRate: i.purchaseRate,
        packing: i.packing,
        manufacturer: i.manufacturer,
        salt: i.salt,
        hsn: i.hsn,
        expiry: i.expiry,
      }
      setLines((prev) => {
        const next = [...prev, newLine]
        setActiveIndex(next.length - 1)
        return next
      })
    }
  }

  const removeLine = (id: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id)
      if (activeIndex >= next.length) {
        setActiveIndex(Math.max(0, next.length - 1))
      }
      return next
    })
  }

  const updateQty = (id: string, qty: number) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)))
  }

  const totalQty = lines.reduce((a, l) => a + l.qty, 0)
  const saveChallan = async () => {
    try {
      setSaving(true)
      const payload = { party, transport, lines, date: new Date().toISOString().split('T')[0] }
      if (editingId) {
        await patchErp('challans', editingId, payload)
        showToast('Challan updated.')
      } else {
        const saved = await postErp<{ id: string }>('challans', payload)
        showToast(`Challan ${saved.id} saved.`)
      }
      incrementLedgerVersion()
      setLines([])
      setParty('')
      setEditingId(null)
      setSavedChallans(await getErp<SavedChallan[]>('challans'))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save challan.')
    } finally {
      setSaving(false)
    }
  }

  const editChallan = (challan: SavedChallan) => {
    setEditingId(challan.dbId)
    setParty(challan.party)
    setTransport(challan.transport || 'Surface')
    setLines(challan.lines || [])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeChallan = async (challan: SavedChallan) => {
    if (!window.confirm(`Delete challan ${challan.id}?`)) return
    try {
      await deleteErp('challans', challan.dbId)
      setSavedChallans((rows) => rows.filter((row) => row.dbId !== challan.dbId))
      showToast(`Challan ${challan.id} deleted.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete challan.')
    }
  }

  const partyOptions: TOption[] = parties.map((p) => ({ label: p }))
  const itemOptions: TOption[] = availableItems.map((i) => ({
    label: i.name,
    sub: `Batch: ${i.batch} | Stock: ${i.stock}`,
    right: formatCurrency(i.rate),
  }))

  const activeLine = lines[activeIndex] || (lines.length > 0 ? lines[lines.length - 1] : null)
  const totalValue = lines.reduce((sum, l) => sum + (Number(l.rate) || 0) * (Number(l.qty) || 0), 0)
  const totalMrp = lines.reduce((sum, l) => sum + (Number(l.mrp) || Number(l.rate) || 0) * (Number(l.qty) || 0), 0)

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen Form (Hidden when printing) */}
      <div className="no-print space-y-4">
      <PrintHeader title="Delivery Challan" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Delivery Challan</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-2">
            <Truck size={14} className="text-cyan-400" /> Goods dispatch without invoice
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center">
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 sm:px-4 bg-black hover:bg-neutral-900 rounded-lg text-xs sm:text-sm text-white font-semibold no-print transition border border-black shadow-sm active:scale-[0.98] cursor-pointer"
            title="Print Delivery Challan"
          >
            <Printer size={15} className="text-white" /> <span>Print Challan</span>
          </button>
          <button
            onClick={saveChallan}
            disabled={saving || !party || !lines.length}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 sm:px-4 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm no-print active:scale-[0.98] transition cursor-pointer"
          >
            <Save size={15} /> <span>{saving ? 'Saving…' : 'Save Challan'}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 shadow-sm">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Party / Consignee *</label>
          <Typeahead options={partyOptions} value={party} onChange={setParty} placeholder="Search party..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Transport Mode</label>
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500 transition"
          >
            <option>Surface</option>
            <option>DTDC</option>
            <option>BlueDart</option>
            <option>Hand Delivery</option>
          </select>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex-1 text-center">
            <div className="text-[10px] text-slate-400 uppercase">Items</div>
            <div className="text-base sm:text-lg font-bold text-white">{lines.length}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex-1 text-center">
            <div className="text-[10px] text-slate-400 uppercase">Total Qty</div>
            <div className="text-base sm:text-lg font-bold text-cyan-400">{totalQty}</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3 shadow-sm">
        <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider">Quick Search & Add Items</label>
        <Typeahead
          options={itemOptions}
          value=""
          onSelect={(opt) => {
            const selected = availableItems.find(
              (i) => i.name === opt.label && `Batch: ${i.batch} | Stock: ${i.stock}` === opt.sub
            )
            if (selected) addItem(selected)
          }}
          placeholder="Type item name to dispatch..."
        />
      </div>

      {lines.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Dispatched Items ({lines.length})</h3>

          {/* Mobile Card View */}
          <div className="space-y-2.5 block md:hidden">
            {lines.map((l, idx) => {
              const isActive = idx === activeIndex
              return (
                <div
                  key={l.id}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    'bg-slate-950 border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition',
                    isActive ? 'border-cyan-500 ring-1 ring-cyan-500/50' : 'border-slate-800'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{l.name}</div>
                    <div className="text-xs font-mono text-cyan-400 mt-0.5">Batch: {l.batch}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(l.id, l.qty - 1)
                        }}
                        className="px-2 py-1.5 text-slate-400 hover:text-white"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={l.qty}
                        onChange={(e) => updateQty(l.id, Number(e.target.value))}
                        onFocus={(e) => {
                          e.target.select()
                          setActiveIndex(idx)
                        }}
                        className="w-12 text-center bg-transparent text-xs font-mono text-white outline-none py-1"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(l.id, l.qty + 1)
                        }}
                        className="px-2 py-1.5 text-slate-400 hover:text-white"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLine(l.id)
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400"
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Item</th>
                  <th className="text-left px-4 py-3 font-medium">Batch</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {lines.map((l, idx) => {
                  const isActive = idx === activeIndex
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        'transition cursor-pointer',
                        isActive ? 'bg-cyan-950/40 ring-1 ring-inset ring-cyan-500/40 border-l-4 border-l-cyan-500' : 'hover:bg-slate-800/30'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {l.name}
                        {l.packing && <span className="block text-[11px] text-slate-500 font-normal">{l.packing}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-400">{l.batch}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => updateQty(l.id, Number(e.target.value))}
                          onFocus={(e) => {
                            e.target.select()
                            setActiveIndex(idx)
                          }}
                          className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white font-mono"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          aria-label={`Remove ${l.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeLine(l.id)
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Marg ERP Style Active Product Description & Inspection Panel */}
          <ActiveProductDetailPanel
            activeProduct={
              activeLine
                ? {
                    name: activeLine.name,
                    packing: activeLine.packing,
                    manufacturer: activeLine.manufacturer,
                    salt: activeLine.salt,
                    hsn: activeLine.hsn,
                    batch: activeLine.batch,
                    expiry: activeLine.expiry,
                    stock: activeLine.stock,
                    saleRate: activeLine.rate,
                    mrp: activeLine.mrp,
                    purchaseRate: activeLine.purchaseRate,
                    refNo: editingId ? `CH-${editingId}` : 'CH-NEW',
                    date: new Date().toISOString().split('T')[0],
                  }
                : null
            }
            billSummary={{
              title: 'Challan Dispatch Values',
              partyLabel: 'Consignee',
              partyName: party,
              mrpValue: totalMrp,
              valueOfGoods: totalValue,
              grandTotal: totalValue,
            }}
            totalRows={lines.length}
            activeIndex={activeIndex}
            emptyMessage="Click any dispatched item to inspect live batch, warehouse stock, rates, composition and margins."
          />
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800"><h2 className="text-sm font-semibold text-white">Saved Challans</h2></div>
        <table className="min-w-[620px] w-full text-xs">
          <thead className="text-slate-400 bg-slate-900/80"><tr><th className="text-left px-4 py-3">Number</th><th className="text-left px-4 py-3">Party</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Transport</th><th className="text-right px-4 py-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {savedChallans.map((challan) => (
              <tr key={challan.dbId} className="text-slate-300 hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono text-cyan-400">{challan.id}</td><td className="px-4 py-3">{challan.party}</td><td className="px-4 py-3">{challan.date}</td><td className="px-4 py-3">{challan.transport}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => editChallan(challan)} className="p-1.5 text-amber-400 hover:bg-slate-800 rounded" aria-label={`Edit ${challan.id}`}><Edit3 size={14}/></button><button onClick={() => removeChallan(challan)} className="p-1.5 text-rose-400 hover:bg-slate-800 rounded" aria-label={`Delete ${challan.id}`}><Trash2 size={14}/></button></div></td>
              </tr>
            ))}
            {!savedChallans.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No challans saved yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Sticky Bottom Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-3 flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Qty ({lines.length} items)</div>
          <div className="font-mono font-bold text-cyan-400 text-base">{totalQty} units</div>
        </div>
        <button
          type="button"
          onClick={saveChallan}
          disabled={saving || !party || !lines.length}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-md active:scale-[0.98] transition cursor-pointer"
        >
          <Save size={14} /> <span>{saving ? 'Saving…' : 'Save Challan'}</span>
        </button>
      </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Delivery Challan Bill Preview</h2>
                <p className="text-xs text-slate-400">
                  Official goods dispatch note ready for print or PDF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-neutral-900 text-white rounded-lg text-xs font-bold shadow transition border border-black cursor-pointer"
                >
                  <Printer size={14} className="text-white" /> Print Challan
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
              <TaxInvoicePrint
                data={{
                  title: 'DELIVERY CHALLAN',
                  copyType: 'Original for Consignee',
                  invoiceNo: `DC-${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`,
                  invoiceDate: new Date().toISOString().split('T')[0],
                  paymentMode: `Dispatch (${transport})`,
                  buyer: {
                    name: party || 'Consignee / Recipient',
                    address: 'Local / Dispatch Consignee',
                  },
                  items: lines.map((l) => ({
                    name: l.name,
                    packing: '1x10',
                    mfr: l.manufacturer,
                    batch: l.batch,
                    qty: l.qty,
                    rate: l.rate,
                    gstRate: 12,
                    amount: l.qty * l.rate,
                  })),
                  grandTotal: lines.reduce((a, l) => a + l.qty * l.rate, 0),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      <div className="hidden print:block w-full">
        <TaxInvoicePrint
          data={{
            title: 'DELIVERY CHALLAN',
            copyType: 'Original for Consignee',
            invoiceNo: `DC-${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`,
            invoiceDate: new Date().toISOString().split('T')[0],
            paymentMode: `Dispatch (${transport})`,
            buyer: {
              name: party || 'Consignee / Recipient',
              address: 'Local / Dispatch Consignee',
            },
            items: lines.map((l) => ({
              name: l.name,
              packing: '1x10',
              mfr: l.manufacturer,
              batch: l.batch,
              qty: l.qty,
              rate: l.rate,
              gstRate: 12,
              amount: l.qty * l.rate,
            })),
            grandTotal: lines.reduce((a, l) => a + l.qty * l.rate, 0),
          }}
        />
      </div>
    </div>
  )
}
