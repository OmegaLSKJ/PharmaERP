import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon,
  FileText,
  Download,
  Search,
  Plus,
  ShieldCheck,
  Package,
  MapPin,
  RefreshCw,
  ExternalLink,
  Sliders,
  X,
  CheckCircle,
  Truck
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp, postErp, patchErp } from '../../lib/erpApi'

export interface NegativeStockRow {
  id: string
  itemId?: string
  name: string
  packing?: string
  batch: string
  location: string
  qty: number // negative value
  rate: number
  mrp: number
  cause?: string
  dateDetected: string
}

const STORAGE_KEY_RECONCILED = 'pharma_erp_negative_reconciled_ids'

export default function NegativeStock() {
  const navigate = useNavigate()
  const [data, setData] = useState<NegativeStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [itemsList, setItemsList] = useState<any[]>([])
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [targetRow, setTargetRow] = useState<NegativeStockRow | null>(null)
  const addToast = useUIStore((s) => s.addToast)

  // Reconcile modal inputs
  const [reconcileQty, setReconcileQty] = useState<number>(0)
  const [reconcileReason, setReconcileReason] = useState('Physical Inventory Count Correction')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')

  // Load live stock data and find negative balances
  const loadData = () => {
    setLoading(true)
    Promise.all([
      getErp<any[]>('report-stock').catch(() => []),
      getErp<any[]>('items').catch(() => [])
    ])
      .then(([stockRows, items]) => {
        setItemsList(items || [])

        // Load IDs of already reconciled entries from localStorage
        const reconciledIds: string[] = JSON.parse(
          localStorage.getItem(STORAGE_KEY_RECONCILED) || '[]'
        )

        const negativeRows: NegativeStockRow[] = []
        const seenKeys = new Set<string>()

        // 1. Check stock report
        ;(stockRows || []).forEach((row: any, idx: number) => {
          const q = Number(row.qty || 0)
          if (q < 0) {
            const rowId = row.id || `rep-${row.name}-${row.batch || idx}`
            if (!reconciledIds.includes(rowId)) {
              seenKeys.add(`${row.name}-${row.batch}`)
              negativeRows.push({
                id: rowId,
                name: row.name,
                batch: row.batch || 'DEFAULT',
                location: row.location || 'Main Warehouse',
                qty: q,
                rate: Number(row.rate || 0),
                mrp: Number(row.mrp || 0),
                cause: 'Oversold at Billing / Inward Pending',
                dateDetected: new Date().toISOString().slice(0, 10)
              })
            }
          }
        })

        // 2. Cross check items master batches
        ;(items || []).forEach((item: any) => {
          const itemRate = Number(item.purchaseRate || item.saleRate * 0.8 || 50)
          const itemMrp = Number(item.mrp || 80)
          const batches = item.batches && item.batches.length > 0 ? item.batches : []

          batches.forEach((b: any, bIdx: number) => {
            const bQty = Number(b.stock ?? b.qty ?? 0)
            const key = `${item.name}-${b.batch}`
            if (bQty < 0 && !seenKeys.has(key)) {
              const rowId = `item-batch-${item.id}-${b.batch || bIdx}`
              if (!reconciledIds.includes(rowId)) {
                seenKeys.add(key)
                negativeRows.push({
                  id: rowId,
                  itemId: item.id,
                  name: item.name,
                  packing: item.packing || '10T',
                  batch: b.batch || 'BT-DEF',
                  location: 'Main Warehouse',
                  qty: bQty,
                  rate: Number(b.purchaseRate || itemRate),
                  mrp: Number(b.mrp || itemMrp),
                  cause: 'Batch quantity depleted below zero',
                  dateDetected: new Date().toISOString().slice(0, 10)
                })
              }
            }
          })

          // Also check overall item stock
          const overallStock = Number(item.stock || 0)
          if (overallStock < 0 && !seenKeys.has(`${item.name}-overall`)) {
            const rowId = `item-overall-${item.id}`
            if (!reconciledIds.includes(rowId)) {
              negativeRows.push({
                id: rowId,
                itemId: item.id,
                name: item.name,
                packing: item.packing || '10T',
                batch: 'OVERALL',
                location: 'Main Warehouse',
                qty: overallStock,
                rate: itemRate,
                mrp: itemMrp,
                cause: 'Total sales exceeded total inward stock',
                dateDetected: new Date().toISOString().slice(0, 10)
              })
            }
          }
        })

        setData(negativeRows)
        setLoading(false)
      })
      .catch((e) => {
        addToast(e.message, 'error')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return data
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.batch.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        (d.cause && d.cause.toLowerCase().includes(q))
    )
  }, [data, search])

  // Key metrics
  const totalShortfallVal = filtered.reduce((a, d) => a + Math.abs(d.qty) * d.rate, 0)
  const totalNegativeUnits = filtered.reduce((a, d) => a + Math.abs(d.qty), 0)
  const locationsCount = new Set(filtered.map((d) => d.location)).size

  // Open adjustment modal for specific row
  const openReconcileForRow = (row: NegativeStockRow) => {
    setTargetRow(row)
    setSelectedItemId(row.itemId || '')
    setSelectedBatch(row.batch)
    setReconcileQty(Math.abs(row.qty)) // default to adding the shortfall
    setShowAdjustModal(true)
  }

  // Submit stock adjustment / reconciliation
  const handleSaveAdjustment = async () => {
    const row = targetRow
    const targetName = row ? row.name : itemsList.find((i) => i.id === selectedItemId)?.name || 'Item'
    const targetBatchNo = row ? row.batch : selectedBatch || 'BATCH-01'

    // Post to inventory adjustments
    try {
      await postErp('inventory-adjustments', {
        date: new Date().toISOString().slice(0, 10),
        reason: reconcileReason,
        lines: [
          {
            name: targetName,
            batch: targetBatchNo,
            adjustedQty: reconcileQty,
            note: 'Negative stock shortfall resolved via Physical Adjustment'
          }
        ]
      })

      // If tied to an existing row, mark as reconciled
      if (row) {
        const existingIds: string[] = JSON.parse(
          localStorage.getItem(STORAGE_KEY_RECONCILED) || '[]'
        )
        existingIds.push(row.id)
        localStorage.setItem(STORAGE_KEY_RECONCILED, JSON.stringify(existingIds))

        // Update local state
        setData((prev) => prev.filter((d) => d.id !== row.id))

        // Also update items stock in ERP if itemId is present
        if (row.itemId) {
          try {
            await patchErp('items', row.itemId, {
              stock: Math.max(0, row.qty + reconcileQty)
            })
          } catch {}
        }
      }

      addToast(`Reconciled stock for ${targetName} (${targetBatchNo}) successfully!`, 'success')
      setShowAdjustModal(false)
      setTargetRow(null)
    } catch (e: any) {
      addToast(e.message || 'Failed to save adjustment', 'error')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader
        title="Negative Stock Discrepancy Report"
        subtitle="Oversold batches requiring physical inventory count adjustment or inward purchase entry"
      />

      {/* Screen Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Negative Stock Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <AlertOctagon size={14} className="text-rose-500" />
            Items sold beyond available batch quantity &bull; Needs physical reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 h-9 px-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-semibold shadow-xs transition border border-border cursor-pointer"
            title="Refresh stock analysis"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            <span>Sync Stock</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('negative-stock-report', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition border border-border cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => {
              setTargetRow(null)
              setShowAdjustModal(true)
            }}
            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-emerald-500/30 cursor-pointer"
          >
            <Plus size={16} /> Reconcile Stock Shortfall
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Negative Items</span>
            <Package size={13} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
            {filtered.length}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalNegativeUnits} total oversold units
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Locations Affected</span>
            <MapPin size={13} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono mt-1">
            {locationsCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Warehouse sections / racks</div>
        </div>

        <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold flex items-center justify-between">
            <span>Value to Adjust</span>
            <AlertOctagon size={13} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
            {formatCurrency(totalShortfallVal)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Valued at purchase cost rate</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="no-print flex items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search oversold medicine, batch, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-indigo-600 transition shadow-2xs"
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Showing {filtered.length} discrepancy records
        </div>
      </div>

      {/* Main Table or Clean Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {search ? 'No matching negative stock records' : 'No Negative Stock Detected'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {search
                ? `No oversold items match "${search}".`
                : 'All pharmaceutical warehouse items have positive, reconciled physical inventory balances. No products are currently oversold.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => {
                setTargetRow(null)
                setShowAdjustModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus size={14} /> Record Physical Inventory Adjustment
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[880px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                <th className="text-left px-4 py-3 min-w-[200px]">Item / Description</th>
                <th className="text-left px-3 py-3 w-28">Batch</th>
                <th className="text-left px-3 py-3 w-32">Location</th>
                <th className="text-right px-3 py-3 w-24">Negative Qty</th>
                <th className="text-right px-3 py-3 w-28">Purc. Rate</th>
                <th className="text-right px-4 py-3 w-32">Shortfall Value</th>
                <th className="text-left px-4 py-3 min-w-[180px]">Cause / Discrepancy</th>
                <th className="text-right px-4 py-3 w-40">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{d.name}</div>
                    {d.packing && (
                      <span className="text-[10px] text-muted-foreground font-normal">{d.packing}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-foreground">{d.batch}</td>
                  <td className="px-3 py-3 text-muted-foreground">{d.location}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {d.qty}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(d.rate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {formatCurrency(Math.abs(d.qty * d.rate))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">
                    <div className="line-clamp-1" title={d.cause}>{d.cause || 'Billing shortfall'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => navigate('/transactions/purchase/new')}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-semibold transition"
                        title="Inward Missing Stock via Purchase Entry"
                      >
                        <Truck size={13} />
                      </button>
                      <button
                        onClick={() => openReconcileForRow(d)}
                        className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                        title="Adjust and reconcile this shortfall"
                      >
                        <Sliders size={12} /> Reconcile
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Reconciliation Adjustment Modal */}
      {showAdjustModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto no-print"
          onClick={() => setShowAdjustModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <Sliders size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">Stock Reconciliation Adjustment</h3>
                  <p className="text-xs text-muted-foreground">
                    Adjusts physical warehouse quantity to resolve negative discrepancy
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {targetRow ? (
                <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Target Product</div>
                  <div className="text-sm font-bold text-foreground">{targetRow.name}</div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span>Batch: <b className="text-foreground">{targetRow.batch}</b></span>
                    <span>Current Stock: <b className="text-rose-500">{targetRow.qty}</b></span>
                    <span>Deficit: <b className="text-amber-500">{Math.abs(targetRow.qty)} units</b></span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Select Product to Adjust *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(e.target.value)
                      const found = itemsList.find((i) => i.id === e.target.value)
                      if (found) {
                        setSelectedBatch(found.batches?.[0]?.batch || 'DEFAULT')
                        setReconcileQty(Math.max(10, Math.abs(found.stock || 0)))
                      }
                    }}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none focus:border-indigo-600"
                  >
                    <option value="">-- Choose item from stock --</option>
                    {itemsList.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.packing || '10T'}) - Current Stock: {it.stock || 0}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Adjustment Qty */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Quantity to Add / Inward to Stock *
                </label>
                <input
                  type="number"
                  min="1"
                  value={reconcileQty}
                  onChange={(e) => setReconcileQty(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-foreground font-bold text-sm outline-none focus:border-indigo-600"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Adding {reconcileQty} units will balance the physical ledger and clear the shortfall.
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Adjustment Reason *
                </label>
                <select
                  value={reconcileReason}
                  onChange={(e) => setReconcileReason(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-indigo-600"
                >
                  <option value="Physical Inventory Count Correction">Physical Inventory Count Correction</option>
                  <option value="Delayed Purchase GRN Inward Entry">Delayed Purchase GRN Inward Entry</option>
                  <option value="Barcode Double-Scan Correction">Barcode Double-Scan Correction</option>
                  <option value="Customer Return Stock Restocked">Customer Return Stock Restocked</option>
                  <option value="Warehouse Shelf Re-audit">Warehouse Shelf Re-audit</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustment}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle size={14} /> Confirm &amp; Balance Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
