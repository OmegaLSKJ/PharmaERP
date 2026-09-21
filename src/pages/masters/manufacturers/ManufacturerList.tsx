import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Truck,
  Eye,
  Package
} from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'
import defaultManufacturerMaster from '../../../data/manufacturerMasterData.json'
import ManufacturerMedicinesModal from './ManufacturerMedicinesModal'

interface Manufacturer {
  id: string
  name: string
  code: string
  productCount: number
  connectedSuppliers?: string[]
  supplierCount?: number
  primarySupplier?: string
  status: 'Active' | 'Blocked'
}

export default function ManufacturerList() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>(() =>
    (defaultManufacturerMaster as any[]).map((row) => ({
      id: String(row?.id || ''),
      name: String(row?.name || ''),
      code: String(row?.code || 'MFG'),
      productCount: Number(row?.productCount || row?.itemcount || 0),
      connectedSuppliers: Array.isArray(row?.connectedSuppliers) && row.connectedSuppliers.length > 0 ? row.connectedSuppliers : [row?.name || 'Self'],
      supplierCount: Number(row?.supplierCount || 1),
      primarySupplier: String(row?.primarySupplier || row?.name || ''),
      status: row?.is_active === false || row?.status === 'Blocked' ? 'Blocked' : 'Active'
    }))
  )
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('ALL')

  // Chunking controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')
  
  // Modal state for Add/Edit
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedMfg, setSelectedMfg] = useState<Manufacturer | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formStatus, setFormStatus] = useState<'Active' | 'Blocked'>('Active')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation modal state
  const [deletingMfg, setDeletingMfg] = useState<Manufacturer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Medicines viewer modal state
  const [viewingMedicinesMfg, setViewingMedicinesMfg] = useState<Manufacturer | null>(null)

  const showToast = useUIStore((state) => state.showToast)

  const loadData = () => {
    const defaultMfgMap = new Map<string, any>(
      (defaultManufacturerMaster as any[]).map((m) => [m.name.toUpperCase().trim(), m])
    )
    getErp<any[]>('manufacturers')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length >= defaultManufacturerMaster.length) {
          setManufacturers(
            rows.map((row) => {
              const nameKey = String(row?.name || '').toUpperCase().trim()
              const defaultEntry = defaultMfgMap.get(nameKey)
              const count = Number(row?.productCount ?? row?.itemcount ?? defaultEntry?.productCount ?? 0) || (defaultEntry?.productCount ?? 0)
              const sups = (Array.isArray(row?.connectedSuppliers) && row.connectedSuppliers.length > 0)
                ? row.connectedSuppliers
                : (defaultEntry?.connectedSuppliers || [row?.name || 'Self'])
              return {
                id: String(row?.id || defaultEntry?.id || ''),
                name: String(row?.name || defaultEntry?.name || ''),
                code: String(row?.code || defaultEntry?.code || 'MFG'),
                productCount: count,
                connectedSuppliers: sups,
                supplierCount: Number(row?.supplierCount || defaultEntry?.supplierCount || sups.length),
                primarySupplier: String(row?.primarySupplier || defaultEntry?.primarySupplier || sups[0] || row?.name || ''),
                status: row?.is_active === false || row?.status === 'inactive' || row?.status === 'Blocked' ? 'Blocked' : 'Active'
              }
            })
          )
        }
      })
      .catch(() => {
        // Keeps the default deduplicated manufacturers safely loaded
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const openAddModal = () => {
    setModalMode('add')
    setSelectedMfg(null)
    setFormName('')
    setFormCode('')
    setFormStatus('Active')
  }

  const openEditModal = (mfg: Manufacturer) => {
    setModalMode('edit')
    setSelectedMfg(mfg)
    setFormName(mfg?.name || '')
    setFormCode(mfg?.code || '')
    setFormStatus(mfg?.status || 'Active')
  }

  const handleNameChange = (val: string) => {
    setFormName(val)
    if (modalMode === 'add') {
      const generated = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
      if (!formCode || formCode === (formName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()) {
        setFormCode(generated)
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      showToast('Manufacturer name is required.')
      return
    }

    const codeToSave = (formCode.trim() || formName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)).toUpperCase()
    const isActive = formStatus === 'Active'

    try {
      setIsSubmitting(true)
      if (modalMode === 'add') {
        const row = await postErp<any>('manufacturers', {
          name: formName.trim(),
          code: codeToSave,
          is_active: isActive
        })
        const newRecord: Manufacturer = {
          id: String(row?.id || Date.now()),
          name: row?.name || formName.trim(),
          code: row?.code || codeToSave,
          productCount: 0,
          status: formStatus
        }
        setManufacturers((prev) => [newRecord, ...prev])
        showToast('Manufacturer created successfully.')
      } else if (modalMode === 'edit' && selectedMfg) {
        await patchErp('manufacturers', selectedMfg.id, {
          name: formName.trim(),
          code: codeToSave,
          is_active: isActive,
          status: formStatus
        })
        setManufacturers((prev) =>
          prev.map((item) =>
            item.id === selectedMfg.id
              ? { ...item, name: formName.trim(), code: codeToSave, status: formStatus }
              : item
          )
        )
        showToast('Manufacturer updated successfully.')
      }
      setModalMode(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save manufacturer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingMfg) return
    try {
      setIsDeleting(true)
      await deleteErp('manufacturers', deletingMfg.id)
      setManufacturers((prev) => prev.filter((item) => item.id !== deletingMfg.id))
      showToast(`Manufacturer "${deletingMfg.name}" deleted.`)
      setDeletingMfg(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete manufacturer.')
    } finally {
      setIsDeleting(false)
    }
  }

  const allSuppliers = useMemo(() => {
    const set = new Set<string>()
    manufacturers.forEach((m) => {
      ;(m.connectedSuppliers || []).forEach((s) => {
        if (s && s.trim()) set.add(s.trim())
      })
    })
    return Array.from(set).sort()
  }, [manufacturers])

  const totalCatalogProducts = useMemo(() => {
    return manufacturers.reduce((acc, m) => acc + (Number(m.productCount) || 0), 0)
  }, [manufacturers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return manufacturers.filter((m) => {
      const matchSearch =
        !q ||
        (m?.name || '').toLowerCase().includes(q) ||
        (m?.code || '').toLowerCase().includes(q) ||
        (m?.connectedSuppliers || []).some((s) => s.toLowerCase().includes(q))
      const matchSupplier =
        supplierFilter === 'ALL' ||
        (m?.connectedSuppliers || []).includes(supplierFilter)
      return matchSearch && matchSupplier
    })
  }, [manufacturers, search, supplierFilter])

  // Reset page index on search/pageSize/supplierFilter changes
  useEffect(() => {
    setCurrentPage(1)
    setContinuousCount(pageSize || 50)
  }, [search, pageSize, supplierFilter])

  const totalItems = filtered.length
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / (pageSize || 50)) || 1

  const displayedItems = useMemo(() => {
    if (pageSize === 0) return filtered
    if (chunkMode === 'continuous') {
      return filtered.slice(0, continuousCount)
    }
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, chunkMode, currentPage, pageSize, continuousCount])

  const startIdx = totalItems === 0 ? 0 : pageSize === 0 ? 1 : chunkMode === 'continuous' ? 1 : (currentPage - 1) * pageSize + 1
  const endIdx =
    pageSize === 0
      ? totalItems
      : chunkMode === 'continuous'
      ? Math.min(continuousCount, totalItems)
      : Math.min(currentPage * pageSize, totalItems)

  const handleLoadMore = () => {
    setContinuousCount((prev) => Math.min(prev + (pageSize || 50), totalItems))
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Manufacturer Master</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {manufacturers.length.toLocaleString()} Manufacturers Total
            </span>
            <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {totalCatalogProducts.toLocaleString()} Associated Products
            </span>
            <span className="bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {allSuppliers.length} Connected Suppliers
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage pharmaceutical brands, companies and supplier party connections
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-sm hover:opacity-90 transition"
        >
          <Plus size={16} />
          Add Manufacturer
        </button>
      </div>

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="text-muted-foreground shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search by brand name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground text-sm w-full placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Supplier Filter */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground">
            <Truck size={13} className="text-primary shrink-0" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-transparent text-foreground text-xs outline-none max-w-[180px] sm:max-w-[220px] truncate cursor-pointer"
              title="Filter by connected supplier or party"
            >
              <option value="ALL">All Suppliers ({allSuppliers.length})</option>
              {allSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                chunkMode === 'paginated'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
                chunkMode === 'continuous'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers size={12} /> Continuous
            </button>
          </div>

          {/* Chunk Selector */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Chunk:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-background border border-border text-foreground rounded px-2 py-1 text-xs outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chunk Info Strip */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div>
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> brands
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-foreground whitespace-nowrap shrink-0">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <table className="min-w-[750px] w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Manufacturer Name</th>
              <th className="px-4 py-3 font-semibold">Connected Suppliers / Parties</th>
              <th className="px-4 py-3 font-semibold">Associated Products</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading manufacturers…
                </td>
              </tr>
            )}
            {!loading && totalItems === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No manufacturers found matching your search.
                </td>
              </tr>
            )}
            {!loading &&
              displayedItems.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setViewingMedicinesMfg(m)}
                  className="hover:bg-muted/40 transition-colors group cursor-pointer"
                  title={`Click to view medicines from ${m.name}`}
                >
                  <td className="px-4 py-3 font-mono font-medium text-primary">
                    {m.code || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
                    <Building2 size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="font-semibold">{m.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1 max-w-xs">
                      {(m.connectedSuppliers && m.connectedSuppliers.length > 0 ? m.connectedSuppliers : [m.name]).slice(0, 2).map((sup) => (
                        <span
                          key={sup}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border text-[10px] font-medium truncate max-w-[135px]"
                          title={sup}
                        >
                          <Truck size={10} className="text-primary shrink-0" />
                          <span className="truncate">{sup}</span>
                        </span>
                      ))}
                      {(m.connectedSuppliers || []).length > 2 && (
                        <span
                          className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground text-[10px] font-semibold"
                          title={(m.connectedSuppliers || []).join(', ')}
                        >
                          +{(m.connectedSuppliers || []).length - 2} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-semibold group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition">
                      <Package size={11} />
                      {m.productCount} medicines
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                        m.status === 'Active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                      )}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        type="button"
                        aria-label={`View medicines for ${m.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingMedicinesMfg(m)
                        }}
                        className="p-1.5 hover:text-primary text-muted-foreground hover:bg-muted rounded transition"
                        title="View Related Medicines & Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${m.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(m)
                        }}
                        className="p-1.5 hover:text-amber-600 dark:hover:text-amber-400 text-muted-foreground hover:bg-muted rounded transition"
                        title="Edit Manufacturer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${m.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingMfg(m)
                        }}
                        className="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-muted-foreground hover:bg-muted rounded transition"
                        title="Delete Manufacturer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Load more button for continuous scrolling */}
        {chunkMode === 'continuous' && continuousCount < totalItems && (
          <div className="p-4 flex justify-center border-t border-border bg-muted/20">
            <button
              onClick={handleLoadMore}
              className="flex items-center gap-1.5 px-4 py-2 bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border shadow-xs transition"
            >
              Load More Brands ({Math.min(pageSize || 50, totalItems - continuousCount)} more)
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalMode &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={() => setModalMode(null)}
          >
            <div
              className="bg-card text-card-foreground border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">
                  {modalMode === 'add' ? 'Add New Manufacturer' : 'Edit Manufacturer'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cipla Ltd"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                    Company Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CIPLA"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm font-mono outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus('Active')}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition',
                        formStatus === 'Active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {formStatus === 'Active' && <Check size={13} />} Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('Blocked')}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition',
                        formStatus === 'Blocked'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-400 font-bold'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {formStatus === 'Blocked' && <Check size={13} />} Blocked
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs bg-primary text-primary-foreground font-semibold rounded-lg shadow-sm hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : modalMode === 'add' ? 'Save Manufacturer' : 'Update Manufacturer'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {deletingMfg &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={() => setDeletingMfg(null)}
          >
            <div
              className="bg-card text-card-foreground border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-2.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Delete Manufacturer</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-foreground">
                Are you sure you want to delete <strong className="font-semibold text-foreground">"{deletingMfg.name}"</strong>?
              </p>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingMfg(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Related Medicines Database Viewer Modal */}
      {viewingMedicinesMfg && (
        <ManufacturerMedicinesModal
          manufacturer={viewingMedicinesMfg}
          onClose={() => setViewingMedicinesMfg(null)}
        />
      )}
    </div>
  )
}
