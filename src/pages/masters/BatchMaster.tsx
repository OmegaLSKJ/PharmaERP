import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Edit2,
  Eye,
  Plus,
  Save,
  Trash2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Layers
} from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import { cn } from '../../lib/utils'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import TopTableScroller from '../../components/common/TopTableScroller'

type Item = { id: string; code: string; name: string }
type Batch = {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  batchNumber: string
  expiryOn: string
  receivedOn: string
  manufacturedOn: string
  mrp: number
  costPrice: number
  purchasePrice: number
  salePrice: number
  salesSchemeDeal: number
  salesSchemeFree: number
  purchaseSchemeDeal: number
  purchaseSchemeFree: number
  supplier: string
  supplierInvoiceNumber: string
  supplierInvoiceDate: string
  rackNumber: string
  sourceReportValue: number
  stock: number
}
type BatchForm = Omit<Batch, 'id' | 'itemCode' | 'itemName' | 'stock'>

const empty = (): BatchForm => ({
  itemId: '',
  batchNumber: '',
  expiryOn: '',
  receivedOn: '',
  manufacturedOn: '',
  mrp: 0,
  costPrice: 0,
  purchasePrice: 0,
  salePrice: 0,
  salesSchemeDeal: 0,
  salesSchemeFree: 0,
  purchaseSchemeDeal: 0,
  purchaseSchemeFree: 0,
  supplier: '',
  supplierInvoiceNumber: '',
  supplierInvoiceDate: '',
  rackNumber: '',
  sourceReportValue: 0,
})

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

const BATCH_SHORTCUTS = [
  { label: 'Item / Batch', offsetPercent: 0 },
  { label: 'Stock & Expiry', offsetPercent: 0.22 },
  { label: 'Rates & MRP', offsetPercent: 0.45 },
  { label: 'Schemes', offsetPercent: 0.65 },
  { label: 'Supplier & Inv', offsetPercent: 0.82 },
  { label: 'Rack & Actions', offsetPercent: 1.0 },
]

export default function BatchMaster() {
  const [items, setItems] = useState<Item[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState<BatchForm>(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Chunking and pagination controls to eliminate scrolling lag and DOM jitter
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const showToast = useUIStore((state) => state.showToast)

  const load = useCallback(
    (quiet = false) => {
      if (!quiet) {
        setBatches((curr) => {
          if (curr.length === 0) setLoading(true)
          return curr
        })
      } else {
        setRefreshing(true)
      }

      return Promise.all([getErp<Item[]>('items'), getErp<Batch[]>('item-batches')])
        .then(([itemRows, batchRows]) => {
          setItems(itemRows || [])
          setBatches(batchRows || [])
        })
        .catch((error) => {
          showToast(error instanceof Error ? error.message : 'Could not load batches.')
        })
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    },
    [showToast]
  )

  useEffect(() => {
    load(false)
  }, [load])

  // Quiet background sync without flashing loading state or wiping existing rows
  useErpAutoRefresh(['item-batches', 'items'], () => {
    load(true)
  })

  // Memoized filtered batches
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return batches
    return batches.filter((batch) =>
      [
        batch.itemName,
        batch.itemCode,
        batch.batchNumber,
        batch.supplier,
        batch.rackNumber,
        batch.supplierInvoiceNumber,
      ].some((value) => value && value.toLowerCase().includes(term))
    )
  }, [batches, search])

  // Reset pagination on search / pageSize change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, pageSize])

  const totalItems = filtered.length
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / pageSize) || 1

  // Displayed paginated batches for buttery-smooth rendering
  const displayedBatches = useMemo(() => {
    if (pageSize === 0) return filtered
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const startIdx = totalItems === 0 ? 0 : pageSize === 0 ? 1 : (currentPage - 1) * pageSize + 1
  const endIdx = pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems)

  const activeBatch = filtered[activeIndex] || (filtered.length > 0 ? filtered[0] : null)

  // Memoize valuation totals to avoid expensive recalculation on render
  const valuationTotals = useMemo(() => {
    const sum = filtered.reduce((s, b) => s + (b.stock || 0) * (b.purchasePrice || 0), 0)
    return { valueOfGoods: sum, grandTotal: sum }
  }, [filtered])

  // Memoize item dropdown options so large lists don't re-render on keystrokes
  const itemOptions = useMemo(() => {
    return items.map((item) => (
      <option key={item.id} value={item.id}>
        {item.code} — {item.name}
      </option>
    ))
  }, [items])

  const set = <K extends keyof BatchForm>(key: K, value: BatchForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const reset = () => {
    setForm(empty())
    setEditingId(null)
  }

  const edit = (batch: Batch) => {
    setEditingId(batch.id)
    setForm({
      itemId: batch.itemId,
      batchNumber: batch.batchNumber,
      expiryOn: batch.expiryOn,
      receivedOn: batch.receivedOn,
      manufacturedOn: batch.manufacturedOn,
      mrp: batch.mrp,
      costPrice: batch.costPrice,
      purchasePrice: batch.purchasePrice,
      salePrice: batch.salePrice,
      salesSchemeDeal: batch.salesSchemeDeal,
      salesSchemeFree: batch.salesSchemeFree,
      purchaseSchemeDeal: batch.purchaseSchemeDeal,
      purchaseSchemeFree: batch.purchaseSchemeFree,
      supplier: batch.supplier,
      supplierInvoiceNumber: batch.supplierInvoiceNumber,
      supplierInvoiceDate: batch.supplierInvoiceDate,
      rackNumber: batch.rackNumber,
      sourceReportValue: batch.sourceReportValue,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingId) await patchErp('item-batches', editingId, form)
      else await postErp('item-batches', form)
      showToast(editingId ? 'Batch updated.' : 'Batch created.')
      reset()
      load(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save batch.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (batch: Batch) => {
    if (
      !window.confirm(
        `Delete batch ${batch.batchNumber}? This is only possible when it has no inventory or document history.`
      )
    )
      return
    try {
      await deleteErp('item-batches', batch.id)
      setBatches((current) => current.filter((row) => row.id !== batch.id))
      showToast('Batch deleted.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete batch.')
    }
  }

  return (
    <div className="space-y-4 max-w-[100vw]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Batch Master</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {totalItems.toLocaleString()} Batches
            </span>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Create, edit and review every batch-level rate, scheme, supplier and rack field.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Reload live batches from database"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin text-primary')} />
            <span>{refreshing ? 'Syncing…' : 'Sync Live'}</span>
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-xs transition cursor-pointer"
          >
            <Plus size={16} /> New batch
          </button>
        </div>
      </div>

      {/* Batch Form */}
      <form
        onSubmit={submit}
        className="glass-surface grid grid-cols-1 gap-3.5 rounded-2xl border border-border p-4 sm:p-5 md:grid-cols-2 lg:grid-cols-4 shadow-sm"
      >
        <Field label="Item">
          <select required value={form.itemId} onChange={(event) => set('itemId', event.target.value)}>
            <option value="">Select item</option>
            {itemOptions}
          </select>
        </Field>
        <Field label="Batch number">
          <input required value={form.batchNumber} onChange={(event) => set('batchNumber', event.target.value)} />
        </Field>
        <Field label="MRP">
          <NumberInput value={form.mrp} onChange={(value) => set('mrp', value)} />
        </Field>
        <Field label="Current stock">
          <div className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {editingId
              ? `${batches.find((batch) => batch.id === editingId)?.stock ?? 0} units`
              : 'Created through purchase/opening stock'}
          </div>
        </Field>
        <Field label="Received date">
          <input type="date" value={form.receivedOn} onChange={(event) => set('receivedOn', event.target.value)} />
        </Field>
        <Field label="Manufactured date">
          <input
            type="date"
            value={form.manufacturedOn}
            onChange={(event) => set('manufacturedOn', event.target.value)}
          />
        </Field>
        <Field label="Expiry date">
          <input type="date" value={form.expiryOn} onChange={(event) => set('expiryOn', event.target.value)} />
        </Field>
        <Field label="Rack number">
          <input value={form.rackNumber} onChange={(event) => set('rackNumber', event.target.value)} />
        </Field>
        <Field label="Cost price">
          <NumberInput value={form.costPrice} onChange={(value) => set('costPrice', value)} />
        </Field>
        <Field label="Purchase price">
          <NumberInput value={form.purchasePrice} onChange={(value) => set('purchasePrice', value)} />
        </Field>
        <Field label="Sale price">
          <NumberInput value={form.salePrice} onChange={(value) => set('salePrice', value)} />
        </Field>
        <Field label="Source report value">
          <NumberInput value={form.sourceReportValue} onChange={(value) => set('sourceReportValue', value)} />
        </Field>
        <Field label="Sales scheme — deal">
          <NumberInput value={form.salesSchemeDeal} onChange={(value) => set('salesSchemeDeal', value)} />
        </Field>
        <Field label="Sales scheme — free">
          <NumberInput value={form.salesSchemeFree} onChange={(value) => set('salesSchemeFree', value)} />
        </Field>
        <Field label="Purchase scheme — deal">
          <NumberInput value={form.purchaseSchemeDeal} onChange={(value) => set('purchaseSchemeDeal', value)} />
        </Field>
        <Field label="Purchase scheme — free">
          <NumberInput value={form.purchaseSchemeFree} onChange={(value) => set('purchaseSchemeFree', value)} />
        </Field>
        <Field label="Supplier">
          <input value={form.supplier} onChange={(event) => set('supplier', event.target.value)} />
        </Field>
        <Field label="Supplier invoice number">
          <input
            value={form.supplierInvoiceNumber}
            onChange={(event) => set('supplierInvoiceNumber', event.target.value)}
          />
        </Field>
        <Field label="Supplier invoice date">
          <input
            type="date"
            value={form.supplierInvoiceDate}
            onChange={(event) => set('supplierInvoiceDate', event.target.value)}
          />
        </Field>
        <div className="flex items-end justify-end gap-2.5 lg:col-span-4 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2 text-xs sm:text-sm hover:bg-muted transition cursor-pointer"
          >
            <X size={15} /> Clear
          </button>
          <button
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} /> {saving ? 'Saving…' : editingId ? 'Save batch' : 'Create batch'}
          </button>
        </div>
      </form>

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
            placeholder="Search item, batch, supplier or rack…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers size={13} />
            <span>Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-background border border-input text-foreground rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chunk Info & Pagination Strip */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div>
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> batches
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono text-foreground font-semibold whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Top Fixed Scroller Wrapped Table */}
      <TopTableScroller shortcuts={BATCH_SHORTCUTS}>
        <table className="min-w-[1500px] w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Item / batch</th>
              <th className="p-3">Stock</th>
              <th className="p-3">MFG / expiry</th>
              <th className="p-3">Cost / purchase / sale / MRP</th>
              <th className="p-3">Schemes</th>
              <th className="p-3">Supplier invoice</th>
              <th className="p-3">Rack</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && batches.length === 0 && (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skel-b-${idx}`} className="animate-pulse border-t border-border/50">
                  <td className="p-3">
                    <div className="h-4 bg-muted/60 rounded w-48 mb-1" />
                    <div className="h-3 bg-muted/40 rounded w-28" />
                  </td>
                  <td className="p-3"><div className="h-4 bg-muted/60 rounded w-12" /></td>
                  <td className="p-3">
                    <div className="h-3 bg-muted/60 rounded w-20 mb-1" />
                    <div className="h-3 bg-muted/40 rounded w-20" />
                  </td>
                  <td className="p-3"><div className="h-3.5 bg-muted/60 rounded w-44" /></td>
                  <td className="p-3">
                    <div className="h-3 bg-muted/60 rounded w-28 mb-1" />
                    <div className="h-3 bg-muted/40 rounded w-28" />
                  </td>
                  <td className="p-3">
                    <div className="h-3.5 bg-muted/60 rounded w-32 mb-1" />
                    <div className="h-3 bg-muted/40 rounded w-24" />
                  </td>
                  <td className="p-3"><div className="h-3.5 bg-muted/60 rounded w-16" /></td>
                  <td className="p-3 text-right"><div className="h-5 bg-muted/50 rounded w-20 ml-auto" /></td>
                </tr>
              ))
            )}

            {(!loading || batches.length > 0) &&
              displayedBatches.map((batch, idx) => {
                const globalIndex = (currentPage - 1) * (pageSize || 50) + idx
                const isActive = globalIndex === activeIndex
                return (
                  <tr
                    key={batch.id}
                    onClick={() => {
                      setActiveIndex(globalIndex)
                      setDetailModalOpen(true)
                    }}
                    className={cn(
                      'border-t border-border cursor-pointer transition-colors',
                      isActive
                        ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40 border-l-4 border-l-indigo-500'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <td className="p-3">
                      <div className="font-medium text-foreground">{batch.itemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {batch.itemCode} · {batch.batchNumber}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-foreground">{batch.stock}</td>
                    <td className="p-3 text-xs">
                      {batch.manufacturedOn || '—'}
                      <br />
                      {batch.expiryOn || '—'}
                    </td>
                    <td className="p-3 text-xs leading-6 font-mono">
                      {money(batch.costPrice)} / {money(batch.purchasePrice)} / {money(batch.salePrice)} /{' '}
                      {money(batch.mrp)}
                    </td>
                    <td className="p-3 text-xs">
                      Sales {batch.salesSchemeDeal}+{batch.salesSchemeFree}
                      <br />
                      Purchase {batch.purchaseSchemeDeal}+{batch.purchaseSchemeFree}
                    </td>
                    <td className="p-3 text-xs">
                      {batch.supplier || '—'}
                      <br />
                      {batch.supplierInvoiceNumber || '—'}{' '}
                      {batch.supplierInvoiceDate ? `· ${batch.supplierInvoiceDate}` : ''}
                    </td>
                    <td className="p-3 font-mono">{batch.rackNumber || '—'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        aria-label={`Inspect ${batch.batchNumber}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveIndex(globalIndex)
                          setDetailModalOpen(true)
                        }}
                        className="mr-2 rounded p-1 text-indigo-400 hover:bg-muted hover:text-indigo-300 transition cursor-pointer"
                        title="Inspect Batch Details (Popup)"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        aria-label={`Edit ${batch.batchNumber}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          edit(batch)
                        }}
                        className="mr-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        aria-label={`Delete ${batch.batchNumber}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(batch)
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}

            {!loading && displayedBatches.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm italic">
                  No batches match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TopTableScroller>

      {/* Marg ERP Style Pop-up Inspection Panel for Batch Master */}
      {filtered.length > 0 && (
        <ActiveProductDetailPanel
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          activeProduct={
            activeBatch
              ? {
                  name: activeBatch.itemName,
                  id: activeBatch.itemId,
                  batchId: activeBatch.id,
                  batch: activeBatch.batchNumber,
                  expiry: activeBatch.expiryOn,
                  stock: activeBatch.stock,
                  saleRate: activeBatch.salePrice,
                  purchaseRate: activeBatch.purchasePrice,
                  costPrice: activeBatch.costPrice,
                  mrp: activeBatch.mrp,
                  salesSchemeDeal: activeBatch.salesSchemeDeal,
                  salesSchemeFree: activeBatch.salesSchemeFree,
                  purchaseSchemeDeal: activeBatch.purchaseSchemeDeal,
                  purchaseSchemeFree: activeBatch.purchaseSchemeFree,
                  manufacturer: activeBatch.supplier,
                  location: activeBatch.rackNumber,
                  refNo: activeBatch.supplierInvoiceNumber,
                  date: activeBatch.supplierInvoiceDate,
                }
              : null
          }
          billSummary={{
            title: 'Batch Valuation',
            partyLabel: 'Supplier',
            partyName: activeBatch?.supplier || 'All Suppliers',
            valueOfGoods: valuationTotals.valueOfGoods,
            grandTotal: valuationTotals.grandTotal,
          }}
          totalRows={filtered.length}
          activeIndex={activeIndex}
          emptyMessage="Click any batch row to inspect live rates, stock, schemes, expiry, and supplier details."
        />
      )}
    </div>
  )
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:p-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:normal-case [&>input]:text-foreground [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:p-2.5 [&>select]:text-sm [&>select]:font-normal [&>select]:normal-case [&>select]:text-foreground">
        {children}
      </div>
    </label>
  )
}
