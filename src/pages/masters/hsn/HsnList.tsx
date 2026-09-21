import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ArrowDownCircle,
  CheckCircle2,
  Percent,
  AlertTriangle
} from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'

interface HsnItem {
  id: string
  code: string
  description: string
  gstRate: number
  type: 'Goods' | 'Services'
}

export default function HsnList() {
  const [items, setItems] = useState<HsnItem[]>([])

  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [gst, setGst] = useState(5)
  const [type, setType] = useState<'Goods' | 'Services'>('Goods')

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<HsnItem | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editGst, setEditGst] = useState(5)
  const [editType, setEditType] = useState<'Goods' | 'Services'>('Goods')

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<HsnItem | null>(null)

  const showToast = useUIStore((state) => state.showToast)

  // Chunking controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')

  const toHsnItem = (row: any): HsnItem => {
    const codeValue = String(row.code)
    return {
      id: row.id,
      code: codeValue,
      description: row.description ?? '',
      gstRate: Number(row.gst_rate ?? row.gstRate ?? 0),
      type: codeValue.startsWith('99') ? 'Services' : 'Goods'
    }
  }

  const loadItems = async () => {
    try {
      const rows = await getErp<any[]>('hsn')
      setItems(Array.isArray(rows) ? rows.map(toHsnItem) : [])
    } catch (error) {
      setItems([])
      showToast(error instanceof Error ? error.message : 'Could not load HSN / SAC codes from Supabase.')
    }
  }

  useEffect(() => {
    void loadItems()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) return
    const cleanCode = code.trim()
    const finalGst = cleanCode.startsWith('3004') ? 5 : gst
    try {
      const created = await postErp<any>('hsn', { code: cleanCode, description: name.trim(), gst_rate: finalGst })
      const newItem = toHsnItem(created)
      setItems((current) => [newItem, ...current.filter((item) => item.id !== newItem.id && item.code !== newItem.code)])
      setName('')
      setCode('')
      setGst(5)
      setShowAddModal(false)
      showToast(`HSN / SAC ${cleanCode} added successfully.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save HSN code.')
    }
  }

  const openEditModal = (item: HsnItem) => {
    setEditingItem(item)
    setEditCode(item.code)
    setEditDesc(item.description)
    setEditGst(item.gstRate)
    setEditType(item.type)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    const updated: HsnItem = {
      ...editingItem,
      code: editCode.trim(),
      description: editDesc.trim(),
      gstRate: editGst,
      type: editType
    }

    try {
      const saved = await patchErp<any>('hsn', editingItem.id, {
        code: updated.code,
        description: updated.description,
        gst_rate: updated.gstRate
      })

      const persisted = toHsnItem(saved)
      setItems((current) => current.map((item) => (item.id === editingItem.id ? persisted : item)))
      setEditingItem(null)
      showToast(`HSN / SAC ${updated.code} updated to ${updated.gstRate}% GST.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update HSN code.')
    }
  }

  const openDeleteModal = (item: HsnItem) => {
    setDeletingItem(item)
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    const target = deletingItem
    try {
      await deleteErp('hsn', target.id)
      setItems((current) => current.filter((item) => item.id !== target.id))
      setDeletingItem(null)
      showToast(`HSN / SAC ${target.code} deleted.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete HSN code.')
    }
  }

  // Bulk set all 3004 codes to 5% GST
  const handleBulkSet3004 = async () => {
    const matchingItems = items.filter((item) => item.code.startsWith('3004') && item.gstRate !== 5)
    try {
      await Promise.all(matchingItems.map((item) => patchErp('hsn', item.id, { gst_rate: 5 })))
      setItems((current) => current.map((item) => item.code.startsWith('3004') ? { ...item, gstRate: 5 } : item))
      showToast('All codes starting with 3004 were saved with 5% GST.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save all 3004 GST rates.')
      await loadItems()
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(
      (i) =>
        !q ||
        (i?.description || '').toLowerCase().includes(q) ||
        (i?.code || '').toLowerCase().includes(q)
    )
  }, [items, search])

  // Reset page index on search/pageSize changes
  useEffect(() => {
    setCurrentPage(1)
    setContinuousCount(pageSize || 50)
  }, [search, pageSize])

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

  const startIdx =
    totalItems === 0
      ? 0
      : pageSize === 0
      ? 1
      : chunkMode === 'continuous'
      ? 1
      : (currentPage - 1) * pageSize + 1
  const endIdx =
    pageSize === 0
      ? totalItems
      : chunkMode === 'continuous'
      ? Math.min(continuousCount, totalItems)
      : Math.min(currentPage * pageSize, totalItems)

  const handleLoadMore = () => {
    setContinuousCount((prev) => Math.min(prev + (pageSize || 50), totalItems))
  }

  const is3004Filtered = search.trim().startsWith('3004')

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">HSN / SAC Master</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {totalItems.toLocaleString()} Codes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Harmonized System of Nomenclature & Service Accounting Codes with continuous chunking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {is3004Filtered && (
            <button
              type="button"
              onClick={handleBulkSet3004}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border transition-colors cursor-pointer shadow-2xs"
              title="Set all 3004 codes to 5% GST"
            >
              <Percent size={13} className="text-muted-foreground" />
              <span>Set 3004 to 5% GST</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus size={16} /> Add HSN / SAC
          </button>
        </div>
      </div>

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="text-muted-foreground shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search by code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground text-sm w-full placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Mode Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition cursor-pointer',
                chunkMode === 'paginated'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1 cursor-pointer',
                chunkMode === 'continuous'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
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
              className="bg-background border border-input text-foreground rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
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
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> codes
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground cursor-pointer shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground cursor-pointer shadow-2xs"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-foreground whitespace-nowrap shrink-0 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground cursor-pointer shadow-2xs"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground cursor-pointer shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <table className="min-w-[650px] w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="p-3.5">HSN / SAC Code</th>
              <th className="p-3.5">Description</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5">GST Rate</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {displayedItems.map((i) => (
              <tr key={i.id} className="hover:bg-muted/40 text-foreground transition-colors">
                <td className="p-3.5 font-mono font-semibold text-foreground">{i.code}</td>
                <td className="p-3.5 font-medium text-foreground max-w-md truncate" title={i.description}>
                  {i.description}
                </td>
                <td className="p-3.5 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded bg-muted border border-border text-[11px] font-semibold text-foreground">
                    {i.type}
                  </span>
                </td>
                <td className="p-3.5">
                  <span
                    className={cn(
                      'inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border shadow-2xs',
                      i.gstRate === 5
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                        : i.gstRate === 12
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                        : i.gstRate === 18
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                        : i.gstRate === 28
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                        : 'bg-muted text-foreground border-border'
                    )}
                  >
                    {i.gstRate}%
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <div className="flex justify-end items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Edit ${i.code}`}
                      title={`Edit HSN ${i.code}`}
                      onClick={() => openEditModal(i)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition cursor-pointer"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${i.code}`}
                      title={`Delete HSN ${i.code}`}
                      onClick={() => openDeleteModal(i)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-muted border border-transparent hover:border-border transition cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {displayedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">
                  No HSN / SAC codes match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
          <div>
            Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span> (
            <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> total items)
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <ChevronsLeft size={13} /> First
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="px-2 font-mono text-foreground font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              Next <ChevronRight size={13} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              Last <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl text-card-foreground">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                Add New HSN / SAC Code
              </h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30049011"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2 text-foreground font-mono text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Medicaments consisting of mixed/unmixed therapeutic formulations"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground resize-none transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as 'Goods' | 'Services')}
                      className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="Goods">Goods</option>
                      <option value="Services">Services</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      required
                      value={gst}
                      onChange={(e) => setGst(Number(e.target.value))}
                      className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Standard Tax Slabs</label>
                  <div className="flex gap-1.5">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setGst(rate)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded font-mono font-medium transition cursor-pointer',
                          gst === rate
                            ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                            : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border'
                        )}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    Save HSN / SAC
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Modal */}
      {editingItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl text-card-foreground">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Edit2 size={18} className="text-primary" />
                  Edit HSN / SAC Code
                </h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold shadow-2xs">
                  {editingItem.code}
                </span>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">HSN / SAC Code *</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2 text-foreground font-mono text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground resize-none transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as 'Goods' | 'Services')}
                      className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="Goods">Goods</option>
                      <option value="Services">Services</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      required
                      value={editGst}
                      onChange={(e) => setEditGst(Number(e.target.value))}
                      className="w-full bg-background border border-input rounded-lg p-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Standard Tax Slabs</label>
                  <div className="flex gap-1.5">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setEditGst(rate)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded font-mono font-medium transition cursor-pointer',
                          editGst === rate
                            ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                            : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border'
                        )}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {deletingItem &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl text-card-foreground space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Delete HSN / SAC Code</h3>
                  <p className="text-xs text-muted-foreground">Are you sure you want to delete this record?</p>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HSN Code:</span>
                  <span className="font-mono font-semibold text-foreground">{deletingItem.code}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground shrink-0">Description:</span>
                  <span className="text-foreground text-right truncate max-w-[220px]" title={deletingItem.description}>
                    {deletingItem.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST Rate:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{deletingItem.gstRate}%</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Delete HSN Code
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
