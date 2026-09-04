import { useState, useEffect } from 'react'
import { Save, Truck, Trash2, Printer, Plus, Minus, Package, X } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import Typeahead, { TOption } from '../../components/ui/Typeahead'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'

interface AvailableItem { name: string; batch: string; rate: number; stock: number }
interface Line { id: string; name: string; batch: string; qty: number; rate: number }

export default function ChallanEntry() {
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [parties, setParties] = useState<string[]>([])
  const [party, setParty] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [transport, setTransport] = useState('Surface')
  const [saving, setSaving] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  useEffect(() => {
    Promise.all([getErp<any[]>('parties'), getErp<any[]>('items')])
      .then(([partyRows, productRows]) => {
        setParties(partyRows.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => p.name))
        setAvailableItems(
          productRows.flatMap((p) =>
            (p.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => ({
              name: p.name,
              batch: b.batch,
              rate: p.saleRate,
              stock: b.stock,
            }))
          )
        )
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  const addItem = (i: AvailableItem) => {
    const existing = lines.find((l) => l.name === i.name && l.batch === i.batch)
    if (existing) {
      setLines(lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + 1 } : l)))
    } else {
      setLines([...lines, { id: Date.now().toString(), name: i.name, batch: i.batch, qty: 1, rate: i.rate }])
    }
  }

  const removeLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id))
  }

  const updateQty = (id: string, qty: number) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)))
  }

  const totalQty = lines.reduce((a, l) => a + l.qty, 0)
  const saveChallan = async () => {
    try {
      setSaving(true)
      const saved = await postErp<{ id: string }>('challans', { party, transport, lines })
      showToast(`Challan ${saved.id} saved.`)
      incrementLedgerVersion()
      setLines([])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save challan.')
    } finally {
      setSaving(false)
    }
  }

  const partyOptions: TOption[] = parties.map((p) => ({ label: p }))
  const itemOptions: TOption[] = availableItems.map((i) => ({
    label: i.name,
    sub: `Batch: ${i.batch} | Stock: ${i.stock}`,
    right: formatCurrency(i.rate),
  }))

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-neutral-900 rounded-lg text-sm text-white font-semibold no-print transition border border-black shadow-md cursor-pointer"
            title="Print Delivery Challan"
          >
            <Printer size={16} className="text-white" /> <span>Print Challan</span>
          </button>
          <button
            onClick={saveChallan}
            disabled={saving || !party || !lines.length}
            className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md no-print transition"
          >
            <Save size={16} /> {saving ? 'Saving…' : 'Save Challan'}
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
            {lines.map((l) => (
              <div key={l.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{l.name}</div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">Batch: {l.batch}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQty(l.id, l.qty - 1)}
                      className="px-2 py-1.5 text-slate-400 hover:text-white"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={l.qty}
                      onChange={(e) => updateQty(l.id, Number(e.target.value))}
                      className="w-12 text-center bg-transparent text-xs font-mono text-white outline-none py-1"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(l.id, l.qty + 1)}
                      className="px-2 py-1.5 text-slate-400 hover:text-white"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
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
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{l.batch}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={l.qty}
                        onChange={(e) => updateQty(l.id, Number(e.target.value))}
                        className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-right text-white font-mono"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        aria-label={`Remove ${l.name}`}
                        onClick={() => removeLine(l.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-md transition"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Challan'}
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
