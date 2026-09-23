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
  RefreshCw
} from 'lucide-react'
import { lookupCatalogManufacturer } from '../../../lib/catalogManufacturers'
import { getErp } from '../../../lib/erpApi'
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
  expiry?: string
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

export default function ManufacturerMedicinesModal({
  manufacturer,
  onClose
}: ManufacturerMedicinesModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [medicines, setMedicines] = useState<MedicineItem[]>([])
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'mrp' | 'margin'>('name')
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
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

      // Filter to items matching this manufacturer either by ID, company name, or brand title
      const filtered = (allItems || []).filter((item) => {
        const itemMfgId = String(item.manufacturer_id || item.companyId || '').trim().toLowerCase()
        if (mfgId && itemMfgId && itemMfgId === mfgId) return true

        const resolved = lookupCatalogManufacturer(item.name, item.code)
        const itemMfg = String(item.manufacturer || item.company || resolved || '').trim().toLowerCase()
        if (!itemMfg) return false
        if (itemMfg === mfgName) return true
        if (itemMfg.includes(mfgName) || mfgName.includes(itemMfg)) return true

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
      setExpandedItemId(null)
      setInspectProduct(null)
      setInspectOpen(false)
      fetchMedicines()
    }
  }, [manufacturer?.id, manufacturer?.name])

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
                  const isExpanded = expandedItemId === med.id
                  const marginPct =
                    med.mrp && med.saleRate && med.mrp > 0
                      ? (((med.mrp - med.saleRate) / med.mrp) * 100).toFixed(1)
                      : null
                  const batches = med.batches || []

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
                            {batches.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(isExpanded ? null : med.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-muted text-foreground text-[11px] font-medium transition"
                                title="Show Batches"
                              >
                                <span className="font-mono font-bold">{batches.length}</span> batches
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            )}

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
                                  batch: firstBatch?.batch,
                                  expiry: firstBatch?.expiry,
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition shadow-2xs"
                              title="Inspect Live Batch Inventory"
                            >
                              <ExternalLink size={12} />
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Batches Sub-table */}
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="p-3 pl-8">
                            <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono uppercase font-bold tracking-wider">
                                <span>Batch Breakdown for {med.name}</span>
                                <span>{batches.length} Registered Batches</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                {batches.map((b, idx) => (
                                  <div
                                    key={b.id || idx}
                                    className="p-2.5 rounded-lg border border-border bg-background font-mono text-xs space-y-1 hover:border-primary/50 transition"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        Batch: {b.batch || 'DEFAULT'}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">
                                        Exp: {b.expiry || '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-border">
                                      <span className="text-muted-foreground">Stock:</span>
                                      <span className={cn('font-bold', (b.stock ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                                        {b.stock ?? 0} units
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-muted-foreground">MRP / SRate:</span>
                                      <span className="text-foreground">
                                        ₹{b.mrp ?? med.mrp ?? 0} / ₹{b.salePrice ?? med.saleRate ?? 0}
                                      </span>
                                    </div>
                                    {(b.location || b.rackNumber) && (
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Rack:</span>
                                        <span>{b.location || b.rackNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
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
