import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Search,
  Building2,
  Package,
  Layers,
  Truck,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Edit2,
  Save,
  Plus,
  Trash2,
  Check,
  Loader2
} from 'lucide-react'
import { lookupCatalogManufacturer } from '../../../lib/catalogManufacturers'
import { getErp, patchErp, postErp, deleteErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn, formatCurrency } from '../../../lib/utils'
import ActiveProductDetailPanel, { ActiveProductDetail } from '../../../components/transactions/ActiveProductDetailPanel'

export interface ManufacturerInfo {
  id: string
  name: string
  code: string
  productCount: number
  connectedSuppliers?: string[]
  supplierCount?: number
  primarySupplier?: string
  status: 'Active' | 'Blocked'
}

interface MedicineBatch {
  id?: string
  batch?: string
  batchNumber?: string
  expiry?: string
  expiryOn?: string
  stock?: number
  mrp?: number
  costPrice?: number
  purchasePrice?: number
  salePrice?: number
  location?: string
  rackNumber?: string
  supplier?: string
  invoiceNumber?: string
  invoiceDate?: string
}

interface MedicineItem {
  id: string
  code?: string
  name: string
  packing?: string
  unit?: string
  manufacturer?: string
  company?: string
  manufacturer_id?: string
  companyId?: string
  salt?: string
  hsn?: string
  gstRate?: number
  mrp?: number
  saleRate?: number
  purchaseRate?: number
  costPrice?: number
  stock?: number
  batches?: MedicineBatch[]
  batchCount?: number
  category?: string
  status?: string
}

interface ManufacturerMedicinesModalProps {
  manufacturer: ManufacturerInfo | null
  onClose: () => void
}

interface BatchDraftState {
  batch: string
  expiry: string
  stock: number | string
  purchasePrice: number | string
  costPrice: number | string
  mrp: number | string
  salePrice: number | string
  rackNumber: string
}

const emptyBatchDraft = (): BatchDraftState => ({
  batch: '',
  expiry: '',
  stock: '',
  purchasePrice: '',
  costPrice: '',
  mrp: '',
  salePrice: '',
  rackNumber: ''
})

export default function ManufacturerMedicinesModal({
  manufacturer,
  onClose
}: ManufacturerMedicinesModalProps) {
  const showToast = useUIStore((s) => s.showToast)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [medicines, setMedicines] = useState<MedicineItem[]>([])
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'mrp' | 'margin'>('name')
  
  // Track expanded product rows
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  
  // Inline batch editing state
  const [editingBatchKey, setEditingBatchKey] = useState<string | null>(null)
  const [batchDraft, setBatchDraft] = useState<BatchDraftState>(emptyBatchDraft())
  const [savingBatchKey, setSavingBatchKey] = useState<string | null>(null)
  
  // Inline new batch creation state
  const [addingBatchForItemId, setAddingBatchForItemId] = useState<string | null>(null)
  const [newBatchDraft, setNewBatchDraft] = useState<BatchDraftState>(emptyBatchDraft())

  const [inspectProduct, setInspectProduct] = useState<ActiveProductDetail | null>(null)
  const [inspectOpen, setInspectOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inspectOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, inspectOpen])

  const fetchMedicines = async () => {
    if (!manufacturer) return
    setLoading(true)
    setError(null)
    try {
      const isUuidStr = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim()))

      const queryParams: Record<string, string> = {
        manufacturer: manufacturer.name
      }
      if (isUuidStr(manufacturer.id)) {
        queryParams.manufacturerId = manufacturer.id
      }

      // Query database for products connected to this manufacturer
      const allItems = await getErp<MedicineItem[]>('items', queryParams, { forceRefresh: true })

      const mfgId = String(manufacturer.id || '').trim().toLowerCase()
      const mfgName = String(manufacturer.name || '').trim().toLowerCase()
      const isUnassignedMfg =
        mfgName === 'unassigned manufacturer' ||
        mfgName === 'unassigned' ||
        mfgName === '**' ||
        String(manufacturer.code || '').trim().toUpperCase() === 'UNASSIGNED'

      // Filter to items matching this manufacturer either by ID, company name, or brand title
      const filtered = (allItems || []).filter((item) => {
        const itemMfgId = String(item.manufacturer_id || item.companyId || '').trim().toLowerCase()
        if (mfgId && itemMfgId && itemMfgId === mfgId) return true

        const resolved = lookupCatalogManufacturer(item.name, item.code)
        const rawMfg = String(item.manufacturer || item.company || resolved || '').trim().toLowerCase()

        if (isUnassignedMfg) {
          return (
            (mfgId && itemMfgId === mfgId) ||
            !rawMfg ||
            rawMfg === '**' ||
            rawMfg === 'unassigned' ||
            rawMfg === 'unassigned manufacturer'
          )
        }

        if (!rawMfg) return false
        if (rawMfg === mfgName) return true
        if (rawMfg.includes(mfgName) || mfgName.includes(rawMfg)) return true

        return false
      })

      setMedicines(filtered)
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (manufacturer) {
      setSearch('')
      setStockFilter('ALL')
      setExpandedItemIds(new Set())
      setEditingBatchKey(null)
      setAddingBatchForItemId(null)
      setInspectProduct(null)
      setInspectOpen(false)
      fetchMedicines()
    }
  }, [manufacturer?.id, manufacturer?.name])

  const toggleExpand = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleStartEditBatch = (med: MedicineItem, batch: MedicineBatch, idx: number) => {
    const key = `${med.id}::${batch.id || `idx-${idx}`}`
    setEditingBatchKey(key)
    setBatchDraft({
      batch: batch.batch || batch.batchNumber || '',
      expiry: batch.expiry || batch.expiryOn || '',
      stock: batch.stock ?? 0,
      purchasePrice: batch.purchasePrice ?? batch.costPrice ?? med.purchaseRate ?? med.costPrice ?? '',
      costPrice: batch.costPrice ?? batch.purchasePrice ?? med.costPrice ?? med.purchaseRate ?? '',
      mrp: batch.mrp ?? med.mrp ?? '',
      salePrice: batch.salePrice ?? med.saleRate ?? '',
      rackNumber: batch.rackNumber || batch.location || ''
    })
  }

  const handleSaveEditBatch = (med: MedicineItem, batch: MedicineBatch, idx: number) => {
    const key = `${med.id}::${batch.id || `idx-${idx}`}`
    const cleanBatchNo = (batchDraft.batch || '').trim().toUpperCase()
    if (!cleanBatchNo) {
      showToast('Batch number cannot be empty.')
      return
    }

    const cleanExpiry = (batchDraft.expiry || '').trim()
    const numStock = Math.max(0, Number(batchDraft.stock) || 0)
    const numPurchase = Math.max(0, Number(batchDraft.purchasePrice) || 0)
    const numMrp = Math.max(0, Number(batchDraft.mrp) || 0)
    const numSale = Math.max(0, Number(batchDraft.salePrice) || 0)
    const cleanRack = (batchDraft.rackNumber || '').trim()

    const updatedBatch: MedicineBatch = {
      ...batch,
      id: batch.id || `b-${Date.now()}-${idx}`,
      batch: cleanBatchNo,
      batchNumber: cleanBatchNo,
      expiry: cleanExpiry,
      expiryOn: cleanExpiry,
      stock: numStock,
      purchasePrice: numPurchase,
      costPrice: numPurchase,
      mrp: numMrp,
      salePrice: numSale,
      rackNumber: cleanRack,
      location: cleanRack,
      supplier: batch.supplier || manufacturer?.primarySupplier || manufacturer?.name
    }

    const currentBatches = [...(med.batches || [])]
    if (idx >= 0 && idx < currentBatches.length) {
      currentBatches[idx] = updatedBatch
    } else {
      currentBatches.push(updatedBatch)
    }
    const newTotalStock = currentBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0)

    // ─── OPTIMISTIC UPDATE: reflect changes instantly, no waiting ───
    setMedicines((prev) =>
      prev.map((item) =>
        item.id === med.id
          ? {
              ...item,
              stock: newTotalStock,
              batches: currentBatches,
              batchCount: currentBatches.length,
              mrp: numMrp || item.mrp,
              saleRate: numSale || item.saleRate,
              purchaseRate: numPurchase || item.purchaseRate,
              costPrice: numPurchase || item.costPrice
            }
          : item
      )
    )
    setEditingBatchKey(null)
    showToast(`Batch "${cleanBatchNo}" saved.`)

    // ─── BACKGROUND PERSISTENCE: fire-and-forget, don't block UI ───
    const snapshot = med.batches ? [...med.batches] : []
    ;(async () => {
      try {
        if (batch.id) {
          await patchErp('item-batches', batch.id, {
            itemId: med.id,
            batchNumber: cleanBatchNo,
            expiryOn: cleanExpiry || null,
            stock: numStock,
            purchasePrice: numPurchase,
            costPrice: numPurchase,
            salePrice: numSale,
            mrp: numMrp,
            rackNumber: cleanRack || null
          })
        } else {
          await patchErp('items', med.id, {
            stock: newTotalStock,
            batches: currentBatches,
            batchCount: currentBatches.length,
            mrp: numMrp || med.mrp,
            saleRate: numSale || med.saleRate,
            purchaseRate: numPurchase || med.purchaseRate,
            costPrice: numPurchase || med.costPrice
          })
        }
      } catch (err: any) {
        // Rollback optimistic state on failure
        console.error('Batch update failed, rolling back:', err)
        setMedicines((prev) =>
          prev.map((item) =>
            item.id === med.id ? { ...item, batches: snapshot, stock: snapshot.reduce((s, b) => s + (Number(b.stock) || 0), 0) } : item
          )
        )
        showToast(`Sync failed: ${err?.message || 'Could not save batch to server.'}`)
      }
    })()
  }

  const handleStartAddBatch = (med: MedicineItem) => {
    setAddingBatchForItemId(med.id)
    setNewBatchDraft({
      batch: '',
      expiry: '',
      stock: '',
      purchasePrice: med.purchaseRate ?? med.costPrice ?? '',
      costPrice: med.costPrice ?? med.purchaseRate ?? '',
      mrp: med.mrp ?? '',
      salePrice: med.saleRate ?? '',
      rackNumber: ''
    })
  }

  const handleSaveNewBatch = (med: MedicineItem) => {
    const cleanBatchNo = (newBatchDraft.batch || '').trim().toUpperCase()
    if (!cleanBatchNo) {
      showToast('Batch number cannot be empty.')
      return
    }

    const cleanExpiry = (newBatchDraft.expiry || '').trim()
    const numStock = Math.max(0, Number(newBatchDraft.stock) || 0)
    const numPurchase = Math.max(0, Number(newBatchDraft.purchasePrice) || 0)
    const numMrp = Math.max(0, Number(newBatchDraft.mrp) || 0)
    const numSale = Math.max(0, Number(newBatchDraft.salePrice) || 0)
    const cleanRack = (newBatchDraft.rackNumber || '').trim()

    const tempBatchId = `b-opt-${Date.now()}`
    const createdBatch: MedicineBatch = {
      id: tempBatchId,
      batch: cleanBatchNo,
      batchNumber: cleanBatchNo,
      expiry: cleanExpiry,
      expiryOn: cleanExpiry,
      stock: numStock,
      purchasePrice: numPurchase,
      costPrice: numPurchase,
      mrp: numMrp,
      salePrice: numSale,
      rackNumber: cleanRack,
      location: cleanRack,
      supplier: manufacturer?.primarySupplier || manufacturer?.name
    }

    const currentBatches = [...(med.batches || []), createdBatch]
    const newTotalStock = currentBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0)

    // ─── OPTIMISTIC UPDATE: reflect instantly ───
    setMedicines((prev) =>
      prev.map((item) =>
        item.id === med.id
          ? {
              ...item,
              stock: newTotalStock,
              batches: currentBatches,
              batchCount: currentBatches.length,
              mrp: numMrp || item.mrp,
              saleRate: numSale || item.saleRate,
              purchaseRate: numPurchase || item.purchaseRate,
              costPrice: numPurchase || item.costPrice
            }
          : item
      )
    )
    setAddingBatchForItemId(null)
    showToast(`Batch "${cleanBatchNo}" added — ${numStock} units.`)

    // ─── BACKGROUND PERSISTENCE ───
    const snapshotBatches = med.batches ? [...med.batches] : []
    ;(async () => {
      try {
        const created = await postErp<any>('item-batches', {
          itemId: med.id,
          batchNumber: cleanBatchNo,
          batch: cleanBatchNo,
          expiryOn: cleanExpiry || null,
          expiry: cleanExpiry || null,
          stock: numStock,
          costPrice: numPurchase,
          purchasePrice: numPurchase,
          salePrice: numSale,
          mrp: numMrp,
          rackNumber: cleanRack || null,
          supplier: manufacturer?.primarySupplier || manufacturer?.name
        })
        // Swap temp id with real persisted id if returned
        if (created?.id && created.id !== tempBatchId) {
          setMedicines((prev) =>
            prev.map((item) =>
              item.id === med.id
                ? {
                    ...item,
                    batches: (item.batches || []).map((b) =>
                      b.id === tempBatchId ? { ...b, id: created.id } : b
                    )
                  }
                : item
            )
          )
        }
      } catch (err: any) {
        console.error('New batch persist failed, rolling back:', err)
        setMedicines((prev) =>
          prev.map((item) =>
            item.id === med.id
              ? { ...item, batches: snapshotBatches, stock: snapshotBatches.reduce((s, b) => s + (Number(b.stock) || 0), 0) }
              : item
          )
        )
        showToast(`Sync failed: ${err?.message || 'Could not save new batch to server.'}`)
      }
    })()
  }

  const handleDeleteBatch = (med: MedicineItem, batch: MedicineBatch, idx: number) => {
    const bName = batch.batch || batch.batchNumber || 'DEFAULT'
    if (!window.confirm(`Delete batch "${bName}" from ${med.name}?`)) return

    const key = `${med.id}::${batch.id || `idx-${idx}`}`
    const snapshotBatches = [...(med.batches || [])]
    const updatedBatches = snapshotBatches.filter((_, i) => i !== idx)
    const newTotalStock = updatedBatches.reduce((sum, b) => sum + (Number(b.stock) || 0), 0)

    // ─── OPTIMISTIC UPDATE: remove instantly ───
    setMedicines((prev) =>
      prev.map((item) =>
        item.id === med.id
          ? { ...item, stock: newTotalStock, batches: updatedBatches, batchCount: updatedBatches.length }
          : item
      )
    )
    if (editingBatchKey === key) setEditingBatchKey(null)
    showToast(`Batch "${bName}" deleted.`)

    // ─── BACKGROUND PERSISTENCE ───
    ;(async () => {
      try {
        if (batch.id) await deleteErp('item-batches', batch.id)
      } catch (err: any) {
        console.error('Batch delete failed, rolling back:', err)
        setMedicines((prev) =>
          prev.map((item) =>
            item.id === med.id
              ? { ...item, batches: snapshotBatches, stock: snapshotBatches.reduce((s, b) => s + (Number(b.stock) || 0), 0) }
              : item
          )
        )
        showToast(`Sync failed: ${err?.message || 'Could not delete batch from server.'}`)
      }
    })()
  }

  // Filtered & Sorted medicines
  const displayedMedicines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return medicines
      .filter((med) => {
        if (stockFilter === 'IN_STOCK' && (med.stock ?? 0) <= 0) return false
        if (stockFilter === 'OUT_OF_STOCK' && (med.stock ?? 0) > 0) return false

        if (!q) return true
        const nameMatch = med.name.toLowerCase().includes(q)
        const saltMatch = (med.salt || '').toLowerCase().includes(q)
        const codeMatch = (med.code || '').toLowerCase().includes(q)
        const hsnMatch = (med.hsn || '').toLowerCase().includes(q)
        const batchMatch = (med.batches || []).some((b) => (b.batch || '').toLowerCase().includes(q))
        return nameMatch || saltMatch || codeMatch || hsnMatch || batchMatch
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'stock') return (b.stock ?? 0) - (a.stock ?? 0)
        if (sortBy === 'mrp') return (b.mrp ?? 0) - (a.mrp ?? 0)
        if (sortBy === 'margin') {
          const marginA = a.mrp && a.saleRate ? ((a.mrp - a.saleRate) / a.mrp) * 100 : 0
          const marginB = b.mrp && b.saleRate ? ((b.mrp - b.saleRate) / b.mrp) * 100 : 0
          return marginB - marginA
        }
        return 0
      })
  }, [medicines, search, stockFilter, sortBy])

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = medicines.length
    const totalStock = medicines.reduce((sum, m) => sum + Number(m.stock || 0), 0)
    const inStockCount = medicines.filter((m) => (m.stock || 0) > 0).length
    const totalMrpValue = medicines.reduce((sum, m) => sum + (Number(m.stock || 0) * Number(m.mrp || 0)), 0)
    const totalCostValue = medicines.reduce(
      (sum, m) => sum + (Number(m.stock || 0) * Number(m.costPrice || m.purchaseRate || 0)),
      0
    )
    return { totalCount, totalStock, inStockCount, totalMrpValue, totalCostValue }
  }, [medicines])

  if (!manufacturer) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-[9990] animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card text-card-foreground border border-border rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Medicines for ${manufacturer.name}`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                <Database size={11} className="animate-pulse text-emerald-600 dark:text-emerald-400" />
                Live Database Connected
              </span>
              <span className="font-mono text-xs text-muted-foreground uppercase font-semibold">
                Code: {manufacturer.code || 'MFG'}
              </span>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  manufacturer.status === 'Active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                )}
              >
                {manufacturer.status}
              </span>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                <Building2 size={22} className="text-primary" />
                {manufacturer.name}
              </h2>
            </div>

            {/* Connected suppliers strip */}
            {manufacturer.connectedSuppliers && manufacturer.connectedSuppliers.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs text-muted-foreground">
                <span className="font-medium text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Truck size={12} className="text-primary" /> Connected Suppliers:
                </span>
                {manufacturer.connectedSuppliers.map((sup) => (
                  <span
                    key={sup}
                    className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px] font-medium border border-border"
                  >
                    {sup}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchMedicines}
              disabled={loading}
              title="Refresh from DB"
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/15 border-b border-border text-xs">
          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground tracking-wider">
              Total Medicines
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-black text-foreground">
                {metrics.totalCount.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">products</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground tracking-wider">
              Stock In Hand
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={cn(
                  'font-mono text-xl font-black',
                  metrics.totalStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                )}
              >
                {metrics.totalStock.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">units</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground tracking-wider">
              Inventory Value (MRP)
            </span>
            <div className="mt-1">
              <span className="font-mono text-xl font-black text-foreground">
                {formatCurrency(metrics.totalMrpValue)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground tracking-wider">
              Inventory Cost Value
            </span>
            <div className="mt-1">
              <span className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(metrics.totalCostValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${manufacturer.name} medicines by name, salt, batch, HSN…`}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stock status filter */}
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setStockFilter('ALL')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition',
                  stockFilter === 'ALL'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All ({medicines.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('IN_STOCK')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition',
                  stockFilter === 'IN_STOCK'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                In Stock ({metrics.inStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('OUT_OF_STOCK')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition',
                  stockFilter === 'OUT_OF_STOCK'
                    ? 'bg-card text-rose-500 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Out of Stock ({medicines.length - metrics.inStockCount})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <ArrowUpDown size={13} className="text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-background border border-border text-foreground rounded-lg px-2.5 py-1.5 text-xs outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="name">Sort by Name</option>
                <option value="stock">Sort by Highest Stock</option>
                <option value="mrp">Sort by MRP</option>
                <option value="margin">Sort by Margin %</option>
              </select>
            </div>

            {/* Expand / Collapse All */}
            {displayedMedicines.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (expandedItemIds.size === displayedMedicines.length) {
                    setExpandedItemIds(new Set())
                  } else {
                    setExpandedItemIds(new Set(displayedMedicines.map((m) => m.id)))
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold bg-background hover:bg-secondary text-foreground transition"
                title={expandedItemIds.size === displayedMedicines.length ? "Collapse all batch breakdowns" : "Expand all batches to view and edit stock"}
              >
                <Layers size={13} className="text-primary" />
                {expandedItemIds.size === displayedMedicines.length ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>
        </div>

        {/* Medicines Table Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary animate-spin">
                <RefreshCw size={24} />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Connecting to database & loading medicines for {manufacturer.name}…
              </p>
              <p className="text-xs text-muted-foreground">
                Fetching live batches, compositions, warehouse stocks and rate cards
              </p>
            </div>
          ) : error ? (
            <div className="p-10 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-500">
                <AlertCircle size={26} />
              </div>
              <p className="text-sm font-bold text-rose-500">{error}</p>
              <button
                type="button"
                onClick={fetchMedicines}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs"
              >
                Retry Database Query
              </button>
            </div>
          ) : displayedMedicines.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
                <Package size={28} />
              </div>
              <h3 className="text-base font-bold text-foreground">
                {search ? 'No medicines matching your search' : `No medicines found for ${manufacturer.name}`}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search
                  ? `Clear the search query to view all cataloged medicines from ${manufacturer.name}.`
                  : `There are currently no active pharmaceutical products linked to ${manufacturer.name} in the item database.`}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-semibold hover:bg-muted transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs border-b border-border text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Medicine & Composition</th>
                  <th className="px-3 py-3 font-semibold">HSN / GST</th>
                  <th className="px-3 py-3 font-semibold">Total Stock</th>
                  <th className="px-3 py-3 font-semibold text-right">P.Rate</th>
                  <th className="px-3 py-3 font-semibold text-right">M.R.P.</th>
                  <th className="px-3 py-3 font-semibold text-right">S.Rate</th>
                  <th className="px-3 py-3 font-semibold text-center">Margin</th>
                  <th className="px-4 py-3 font-semibold text-right">Batches & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedMedicines.map((med) => {
                  const isExpanded = expandedItemIds.has(med.id)
                  const marginPct =
                    med.mrp && med.saleRate && med.mrp > 0
                      ? (((med.mrp - med.saleRate) / med.mrp) * 100).toFixed(1)
                      : null
                  const batches = med.batches || []
                  const isAddingThis = addingBatchForItemId === med.id

                  return (
                    <React.Fragment key={med.id}>
                      <tr className="hover:bg-muted/40 transition-colors group">
                        {/* Medicine Name & Salt */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm tracking-tight">
                              {med.name}
                            </span>
                            {med.packing && (
                              <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] font-mono font-semibold">
                                {med.packing}
                              </span>
                            )}
                            {med.code && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{med.code}
                              </span>
                            )}
                          </div>
                          {med.salt && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1" title={med.salt}>
                              <span className="font-mono text-[10px] font-bold text-primary/80 uppercase mr-1">Salt:</span>
                              {med.salt}
                            </p>
                          )}
                        </td>

                        {/* HSN & GST */}
                        <td className="px-3 py-3 font-mono">
                          <div className="text-foreground font-semibold">{med.hsn || '—'}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {typeof med.gstRate === 'number' ? `GST ${med.gstRate}%` : '—'}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="px-3 py-3 font-mono">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono',
                              (med.stock ?? 0) > 0
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                            )}
                          >
                            {(med.stock ?? 0) > 0 ? `${med.stock} Units` : 'Out of Stock'}
                          </span>
                        </td>

                        {/* Purchase Rate */}
                        <td className="px-3 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                          {typeof med.purchaseRate === 'number' ? `₹${med.purchaseRate.toFixed(2)}` : '—'}
                        </td>

                        {/* MRP */}
                        <td className="px-3 py-3 text-right font-mono text-foreground font-bold">
                          {typeof med.mrp === 'number' ? `₹${med.mrp.toFixed(2)}` : '—'}
                        </td>

                        {/* Sale Rate */}
                        <td className="px-3 py-3 text-right font-mono text-indigo-700 dark:text-indigo-400 font-semibold">
                          {typeof med.saleRate === 'number' ? `₹${med.saleRate.toFixed(2)}` : '—'}
                        </td>

                        {/* Margin */}
                        <td className="px-3 py-3 text-center font-mono">
                          {marginPct !== null ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800/60">
                              {marginPct}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actions & Batch Toggle */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleExpand(med.id)}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer',
                                isExpanded
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                                  : 'bg-secondary hover:bg-muted text-foreground'
                              )}
                              title={isExpanded ? 'Collapse Batches' : 'Expand Batches & Edit Stock'}
                            >
                              <span className="font-mono font-bold">{batches.length}</span> {batches.length === 1 ? 'batch' : 'batches'}
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const firstBatch = batches[0]
                                setInspectProduct({
                                  id: med.id,
                                  code: med.code,
                                  name: med.name,
                                  packing: med.packing,
                                  manufacturer: med.manufacturer || manufacturer.name,
                                  salt: med.salt,
                                  hsn: med.hsn,
                                  gstRate: med.gstRate,
                                  batch: firstBatch?.batch || firstBatch?.batchNumber,
                                  expiry: firstBatch?.expiry || firstBatch?.expiryOn,
                                  stock: med.stock,
                                  saleRate: med.saleRate,
                                  mrp: med.mrp,
                                  purchaseRate: med.purchaseRate,
                                  costPrice: med.costPrice || med.purchaseRate,
                                  location: firstBatch?.location || firstBatch?.rackNumber,
                                  supplier: firstBatch?.supplier || manufacturer.primarySupplier || manufacturer.name,
                                  refNo: firstBatch?.invoiceNumber,
                                  date: firstBatch?.invoiceDate
                                })
                                setInspectOpen(true)
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-muted text-foreground text-[11px] font-semibold transition border border-border shadow-2xs"
                              title="Inspect Live Batch Inventory"
                            >
                              <ExternalLink size={12} />
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Batches Sub-table & Inline Editor */}
                      {isExpanded && (
                        <tr className="bg-muted/20 border-b border-border/80">
                          <td colSpan={8} className="p-3 pl-6 sm:pl-8">
                            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm space-y-3">
                              {/* Header & Inline Controls */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs uppercase font-bold text-foreground tracking-wide flex items-center gap-1.5">
                                    <Package size={14} className="text-primary" />
                                    Live Batches for:
                                  </span>
                                  <span className="text-xs font-semibold text-foreground underline decoration-primary/50 underline-offset-2">
                                    {med.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary text-secondary-foreground border border-border">
                                    {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                    {med.stock ?? 0} total units
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isAddingThis && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartAddBatch(med)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs cursor-pointer"
                                    >
                                      <Plus size={13} />
                                      Add New Batch
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inline New Batch Creator Form */}
                              {isAddingThis && (
                                <div className="p-3.5 rounded-xl border-2 border-dashed border-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                                      <Plus size={14} />
                                      Register New Batch for {med.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setAddingBatchForItemId(null)}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs font-mono">
                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Batch No *
                                      </label>
                                      <input
                                        type="text"
                                        value={newBatchDraft.batch}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, batch: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. B25001"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary uppercase font-bold"
                                        autoFocus
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Expiry (YYYY-MM)
                                      </label>
                                      <input
                                        type="text"
                                        value={newBatchDraft.expiry}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, expiry: e.target.value }))}
                                        placeholder="2028-12-31"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Stock (Units) *
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={newBatchDraft.stock}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, stock: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary font-bold text-emerald-600 dark:text-emerald-400"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Purchase Rate (₹)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newBatchDraft.purchasePrice}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        MRP (₹)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newBatchDraft.mrp}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, mrp: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Sale Rate (₹)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newBatchDraft.salePrice}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, salePrice: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                        Rack / Shelf
                                      </label>
                                      <input
                                        type="text"
                                        value={newBatchDraft.rackNumber}
                                        onChange={(e) => setNewBatchDraft((prev) => ({ ...prev, rackNumber: e.target.value }))}
                                        placeholder="e.g. A-12"
                                        className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setAddingBatchForItemId(null)}
                                      className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNewBatch(med)}
                                      disabled={savingBatchKey === `new-${med.id}`}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 shadow-2xs cursor-pointer"
                                    >
                                      {savingBatchKey === `new-${med.id}` ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Check size={13} />
                                      )}
                                      Save New Batch
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Batches Grid & Inline Cards */}
                              {batches.length === 0 && !isAddingThis ? (
                                <div className="py-6 text-center text-xs text-muted-foreground font-medium border border-dashed border-border rounded-xl bg-background/50 space-y-2.5">
                                  <p className="text-foreground font-semibold">No registered batches found for {med.name}.</p>
                                  <p className="text-[11px]">Click below to create an initial batch and set its stock, expiry, and rates.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleStartAddBatch(med)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow-2xs cursor-pointer"
                                  >
                                    <Plus size={13} />
                                    Add Initial Batch
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                  {batches.map((b, idx) => {
                                    const bKey = `${med.id}::${b.id || `idx-${idx}`}`
                                    const isEditingThis = editingBatchKey === bKey
                                    const isSavingThis = savingBatchKey === bKey

                                    if (isEditingThis) {
                                      return (
                                        <div
                                          key={bKey}
                                          className="p-3.5 rounded-xl border-2 border-primary bg-card/95 font-mono text-xs space-y-3 shadow-md col-span-1 sm:col-span-2 lg:col-span-3 transition animate-in fade-in duration-150"
                                        >
                                          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                                            <span className="font-bold text-primary flex items-center gap-1.5">
                                              <Edit2 size={13} />
                                              Editing Batch: {b.batch || b.batchNumber || 'DEFAULT'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setEditingBatchKey(null)}
                                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                Batch No *
                                              </label>
                                              <input
                                                type="text"
                                                value={batchDraft.batch}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, batch: e.target.value.toUpperCase() }))}
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary uppercase font-bold"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                Expiry (YYYY-MM)
                                              </label>
                                              <input
                                                type="text"
                                                value={batchDraft.expiry}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, expiry: e.target.value }))}
                                                placeholder="2028-12-31"
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                Stock (Units) *
                                              </label>
                                              <input
                                                type="number"
                                                min="0"
                                                value={batchDraft.stock}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, stock: e.target.value }))}
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary font-bold text-emerald-600 dark:text-emerald-400"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                P.Rate (₹)
                                              </label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={batchDraft.purchasePrice}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                MRP (₹)
                                              </label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={batchDraft.mrp}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, mrp: e.target.value }))}
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                S.Rate (₹)
                                              </label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={batchDraft.salePrice}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, salePrice: e.target.value }))}
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </div>

                                            <div>
                                              <label className="block text-[10px] text-muted-foreground uppercase mb-0.5">
                                                Rack / Shelf
                                              </label>
                                              <input
                                                type="text"
                                                value={batchDraft.rackNumber}
                                                onChange={(e) => setBatchDraft((prev) => ({ ...prev, rackNumber: e.target.value }))}
                                                placeholder="e.g. A-12"
                                                className="w-full px-2 py-1.5 rounded border border-input bg-background font-mono text-xs focus:ring-1 focus:ring-primary"
                                              />
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setEditingBatchKey(null)}
                                              className="px-3 py-1.5 rounded border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveEditBatch(med, b, idx)}
                                              disabled={isSavingThis}
                                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 shadow-2xs cursor-pointer"
                                            >
                                              {isSavingThis ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                              Save Changes
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    }

                                    // Read-only card with action buttons
                                    const pRate = b.purchasePrice ?? b.costPrice ?? med.purchaseRate ?? med.costPrice ?? 0
                                    const mrpVal = b.mrp ?? med.mrp ?? 0
                                    const sRate = b.salePrice ?? med.saleRate ?? 0
                                    const rackStr = b.rackNumber || b.location

                                    return (
                                      <div
                                        key={bKey}
                                        className="p-3 rounded-xl border border-border bg-background font-mono text-xs space-y-1.5 hover:border-primary/50 transition group shadow-2xs"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-amber-600 dark:text-amber-400">
                                            Batch: {b.batch || b.batchNumber || 'DEFAULT'}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[11px] text-muted-foreground mr-1">
                                              Exp: {b.expiry || b.expiryOn || '—'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditBatch(med, b, idx)}
                                              className="p-1 rounded bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground text-[10px] font-semibold transition cursor-pointer"
                                              title="Edit Batch & Stock Values"
                                            >
                                              <Edit2 size={11} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteBatch(med, b, idx)}
                                              className="p-1 rounded bg-secondary hover:bg-rose-600 hover:text-white text-muted-foreground text-[10px] font-semibold transition cursor-pointer"
                                              title="Delete Batch"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                                          <span className="text-muted-foreground">Stock:</span>
                                          <span className={cn('font-bold', (b.stock ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                                            {b.stock ?? 0} units
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="text-muted-foreground">P.Rate / MRP / S.Rate:</span>
                                          <span className="text-foreground font-medium">
                                            ₹{typeof pRate === 'number' ? pRate.toFixed(2) : pRate} / ₹{typeof mrpVal === 'number' ? mrpVal.toFixed(2) : mrpVal} / ₹{typeof sRate === 'number' ? sRate.toFixed(2) : sRate}
                                          </span>
                                        </div>

                                        {rackStr && (
                                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                            <span>Rack:</span>
                                            <span className="font-semibold text-foreground">{rackStr}</span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck size={14} className="text-emerald-500" />
            Showing <strong className="text-foreground">{displayedMedicines.length}</strong> of{' '}
            <strong className="text-foreground">{medicines.length}</strong> cataloged medicines from {manufacturer.name}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-secondary hover:bg-muted text-foreground font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Embedded Live Batch Inventory Inspection Dialog */}
      {inspectOpen && inspectProduct && (
        <ActiveProductDetailPanel
          activeProduct={inspectProduct}
          open={inspectOpen}
          onClose={() => setInspectOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}
