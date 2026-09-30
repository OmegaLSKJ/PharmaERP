import { useState, useEffect, useCallback } from 'react'
import { Save, Truck, Trash2, Printer, Plus, Minus, X, Edit3, ExternalLink, Info, Sparkles } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import Typeahead, { TOption } from '../../components/ui/Typeahead'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import { getGstRateForHsn } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import PrintButton from '../../components/common/PrintButton'
import InvoiceOcrModal from '../../components/ocr/InvoiceOcrModal'
import { ExtractedInvoice } from '../../lib/ocr/types'

interface AvailableItem {
  name: string
  batch: string
  rate: number
  stock: number
  gstRate?: number
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
  gstRate?: number
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
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [transport, setTransport] = useState('Surface')
  const [saving, setSaving] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [savedChallans, setSavedChallans] = useState<SavedChallan[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  const handleApplyOcrData = useCallback((ocrData: ExtractedInvoice) => {
    if (ocrData.supplierName && !party) {
      const match = parties.find(
        (p) =>
          p.toLowerCase().includes(ocrData.supplierName.toLowerCase()) ||
          ocrData.supplierName.toLowerCase().includes(p.toLowerCase())
      )
      if (match) setParty(match)
    }

    if (ocrData.items && ocrData.items.length > 0) {
      const newLines: Line[] = ocrData.items.map((it, idx) => {
        const matched = availableItems.find(
          (a) =>
            (it.mappedItemId && a.name.toLowerCase() === (it.mappedItemName || '').toLowerCase()) ||
            a.name.toLowerCase().includes(it.itemName.toLowerCase()) ||
            it.itemName.toLowerCase().includes(a.name.toLowerCase())
        )

        const qty = it.qty > 0 ? it.qty : 1
        const rate = it.saleRate > 0 ? it.saleRate : (matched?.rate || it.purchaseRate || 100)

        return {
          id: `ocr-ch-${Date.now()}-${idx}`,
          name: matched?.name || it.mappedItemName || it.itemName,
          batch: it.batch || matched?.batch || 'CH-BAT',
          qty,
          rate,
          gstRate: it.gstRate || matched?.gstRate || 12,
          stock: matched?.stock || 50,
          mrp: it.mrp || matched?.mrp || Math.round(rate * 1.2 * 100) / 100,
          purchaseRate: it.purchaseRate || matched?.purchaseRate || Math.round(rate * 0.8 * 100) / 100,
          packing: it.packing || matched?.packing || '10x10',
          manufacturer: matched?.manufacturer,
          salt: matched?.salt,
          hsn: it.hsn || matched?.hsn || '30049099',
          expiry: it.expiry || matched?.expiry || '12/28'
        }
      })

      setLines((prev) => [...prev, ...newLines])
      showToast(`Added ${newLines.length} confirmed medicine items from OCR scan`)
    }
  }, [party, parties, availableItems, showToast])

  useEffect(() => {
    document.title = editingId ? `Edit Challan ${editingId} · Borgang ERP` : 'Delivery Challan · Borgang ERP'
  }, [editingId])

  const loadChallanData = useCallback((force = false) => {
    Promise.all([
      getErp<any[]>('parties', undefined, force ? { forceRefresh: true } : undefined),
      getErp<any[]>('items', undefined, force ? { forceRefresh: true } : undefined),
      getErp<SavedChallan[]>('challans', undefined, force ? { forceRefresh: true } : undefined)
    ])
      .then(([partyRows, productRows, challanRows]) => {
        setParties(partyRows.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => p.name))
        setAvailableItems(
          productRows.flatMap((p) =>
            (p.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => {
              const batchMrp = Number(b.mrp || p.mrp || 0)
              const batchSaleRate = Number(b.salePrice ?? b.saleRate ?? b.rate ?? p.saleRate ?? 0)
              const autoRate = batchSaleRate > 0 ? batchSaleRate : batchMrp

              return {
                name: p.name,
                batch: b.batch,
                rate: autoRate,
                stock: b.stock,
                mrp: batchMrp,
                purchaseRate: Number(b.purchasePrice ?? b.purchaseRate ?? p.purchaseRate ?? 0),
                packing: p.packing || '',
                manufacturer: p.manufacturer || p.company || '',
                salt: p.salt || p.composition || '',
                hsn: p.hsn || '',
                gstRate: p.gstRate !== undefined && p.gstRate !== null ? Number(p.gstRate) : getGstRateForHsn(p.hsn),
                expiry: b.expiry || '',
              }
            })
          )
        )
        setSavedChallans(challanRows || [])
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  useEffect(() => {
    loadChallanData()
  }, [loadChallanData])

  useErpAutoRefresh(['challans', 'parties', 'items'], () => loadChallanData(true))

  const addItem = (i: AvailableItem) => {
    const existingIndex = lines.findIndex((l) => l.name === i.name && l.batch === i.batch)
    if (existingIndex >= 0) {
      setLines((prev) => prev.map((l, idx) => (idx === existingIndex ? { ...l, qty: l.qty + 1 } : l)))
      setActiveIndex(existingIndex)
    } else {
      const effectiveRate = Number(i.rate > 0 ? i.rate : (i.mrp || 0))
      const newLine: Line = {
        id: Date.now().toString(),
        name: i.name,
        batch: i.batch,
        qty: 1,
        rate: effectiveRate,
        gstRate: i.gstRate ?? getGstRateForHsn(i.hsn),
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Delivery Challan</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <Truck size={14} className="text-cyan-500 dark:text-cyan-400" /> Goods dispatch without invoice
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => setShowOcrModal(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 no-print transition shadow-xs active:scale-[0.98] cursor-pointer"
            title="Scan physical delivery challan or dispatch slip with free OCR"
          >
            <Sparkles size={14} className="text-indigo-500" />
            <span>Scan Challan (OCR)</span>
          </button>
          <button
            type="button"
            onClick={() => openTransactionWindow(window.location.pathname)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 bg-secondary hover:bg-secondary/80 rounded-lg text-xs sm:text-sm text-foreground font-semibold no-print transition border border-border shadow-xs active:scale-[0.98] cursor-pointer"
            title="Open another instance in a separate window"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">New Window</span>
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 sm:px-4 bg-secondary hover:bg-secondary/80 rounded-lg text-xs sm:text-sm text-foreground font-semibold no-print transition border border-border shadow-xs active:scale-[0.98] cursor-pointer"
            title="Print Delivery Challan"
          >
            <Printer size={15} className="text-muted-foreground" /> <span>Print Challan</span>
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

      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 shadow-xs">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Party / Consignee *</label>
          <Typeahead options={partyOptions} value={party} onChange={setParty} placeholder="Search party..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Transport Mode</label>
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-cyan-500 transition"
          >
            <option>Surface</option>
            <option>DTDC</option>
            <option>BlueDart</option>
            <option>Hand Delivery</option>
          </select>
        </div>
        <div className="flex gap-2">
          <div className="bg-secondary/40 border border-border rounded-lg p-2 flex-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Items</div>
            <div className="text-base sm:text-lg font-bold text-foreground">{lines.length}</div>
          </div>
          <div className="bg-secondary/40 border border-border rounded-lg p-2 flex-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Total Qty</div>
            <div className="text-base sm:text-lg font-bold text-cyan-600 dark:text-cyan-400">{totalQty}</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3 shadow-xs">
        <label className="block text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Quick Search & Add Items</label>
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
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Dispatched Items ({lines.length})</h3>

          {/* Mobile Card View */}
          <div className="space-y-2.5 block md:hidden">
            {lines.map((l, idx) => {
              const isActive = idx === activeIndex
              return (
                <div
                  key={l.id}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    'bg-card border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition',
                    isActive ? 'border-cyan-500 ring-1 ring-cyan-500/50' : 'border-border'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{l.name}</div>
                    <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">Batch: {l.batch}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-secondary rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(l.id, l.qty - 1)
                        }}
                        className="px-2 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="w-12 text-center bg-transparent text-xs font-mono text-foreground outline-none py-1"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(l.id, l.qty + 1)
                        }}
                        className="px-2 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
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
                      className="p-1.5 text-muted-foreground hover:text-rose-500 cursor-pointer"
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
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium min-w-[240px]">Item</th>
                  <th className="text-left px-4 py-3 font-medium w-36 min-w-[130px]">Batch</th>
                  <th className="text-right px-4 py-3 font-medium w-28 min-w-[100px]">Qty</th>
                  <th className="px-4 py-3 w-16 min-w-[60px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {lines.map((l, idx) => {
                  const isActive = idx === activeIndex
                  return (
                    <tr
                      key={l.id}
                      onClick={() => {
                        setActiveIndex(idx)
                        setDetailModalOpen(true)
                      }}
                      className={cn(
                        'transition cursor-pointer',
                        isActive ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/40 border-l-4 border-l-cyan-500' : 'hover:bg-secondary/40'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-foreground min-w-[240px]">
                        {l.name}
                        {l.packing && <span className="block text-[11px] text-muted-foreground font-normal">{l.packing}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-600 dark:text-cyan-400 font-medium min-w-[130px]">{l.batch}</td>
                      <td className="px-4 py-3 text-right min-w-[100px]">
                        <input
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => updateQty(l.id, Number(e.target.value))}
                          onFocus={(e) => {
                            e.target.select()
                            setActiveIndex(idx)
                          }}
                          className="w-full min-w-[80px] bg-background border border-border rounded px-2.5 py-1.5 text-right text-foreground font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-label={`Inspect ${l.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveIndex(idx)
                            setDetailModalOpen(true)
                          }}
                          className="mr-1 text-slate-400 hover:text-indigo-600 p-1 cursor-pointer transition"
                          title="Inspect Product & Batch"
                        >
                          <Info size={14} />
                        </button>
                        <button
                          aria-label={`Remove ${l.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeLine(l.id)
                          }}
                          className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
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

          {/* Marg ERP Style Pop-up Product Description & Inspection Panel */}
          <ActiveProductDetailPanel
            open={detailModalOpen}
            onClose={() => setDetailModalOpen(false)}
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

      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <div className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Saved Challans</h2></div>
        <table className="min-w-[680px] w-full text-xs">
          <thead className="text-muted-foreground bg-secondary/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 min-w-[120px]">Number</th>
              <th className="text-left px-4 py-3 min-w-[200px]">Party</th>
              <th className="text-left px-4 py-3 min-w-[110px]">Date</th>
              <th className="text-left px-4 py-3 min-w-[130px]">Transport</th>
              <th className="text-right px-4 py-3 min-w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {savedChallans.map((challan) => (
              <tr key={challan.dbId} className="text-foreground hover:bg-secondary/40">
                <td className="px-4 py-3 font-mono text-cyan-600 dark:text-cyan-400 font-medium min-w-[120px]">{challan.id}</td>
                <td className="px-4 py-3 min-w-[200px]">{challan.party}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground min-w-[110px]">{challan.date}</td>
                <td className="px-4 py-3 text-muted-foreground min-w-[130px]">{challan.transport}</td>
                <td className="px-4 py-3 min-w-[90px]"><div className="flex justify-end gap-1"><button onClick={() => editChallan(challan)} className="p-1.5 text-amber-500 hover:bg-secondary rounded cursor-pointer" aria-label={`Edit ${challan.id}`}><Edit3 size={14}/></button><button onClick={() => removeChallan(challan)} className="p-1.5 text-rose-500 hover:bg-secondary rounded cursor-pointer" aria-label={`Delete ${challan.id}`}><Trash2 size={14}/></button></div></td>
              </tr>
            ))}
            {!savedChallans.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No challans saved yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Sticky Bottom Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border p-3 flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Qty ({lines.length} items)</div>
          <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-base">{totalQty} units</div>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="bg-card border border-border text-foreground w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">Delivery Challan Bill Preview</h2>
                <p className="text-xs text-muted-foreground">
                  Official goods dispatch note ready for print or PDF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PrintButton
                  label="Print Challan"
                  variant="secondary"
                  autoOrientationHint="portrait"
                  size="sm"
                />
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary transition cursor-pointer"
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
                    gstRate: l.gstRate ?? getGstRateForHsn(l.hsn, 5),
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
      <div className="hidden print:block w-full mx-auto">
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
              gstRate: l.gstRate ?? getGstRateForHsn(l.hsn, 5),
              amount: l.qty * l.rate,
            })),
            grandTotal: lines.reduce((a, l) => a + l.qty * l.rate, 0),
          }}
        />
      </div>

      {/* Free Local OCR Challan Scanner */}
      <InvoiceOcrModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onApply={handleApplyOcrData}
        masterItems={availableItems.map((a) => ({
          name: a.name,
          label: a.name,
          batch: a.batch,
          rate: a.rate,
          stock: a.stock,
          mrp: a.mrp,
          purchaseRate: a.purchaseRate,
          packing: a.packing,
          manufacturer: a.manufacturer,
          salt: a.salt,
          hsn: a.hsn,
          gstRate: a.gstRate
        }))}
        mode="challan"
      />
    </div>
  )
}
