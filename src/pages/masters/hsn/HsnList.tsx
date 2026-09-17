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
import defaultHsnMaster from '../../../data/hsnMasterData.json'

interface HsnItem {
  id: string
  code: string
  description: string
  gstRate: number
  type: 'Goods' | 'Services'
}

export default function HsnList() {
  const [items, setItems] = useState<HsnItem[]>(() => {
    let localSaved: any[] = []
    try {
      const raw = localStorage.getItem('pharma_erp_custom_hsn')
      if (raw) localSaved = JSON.parse(raw)
    } catch {}
    if (Array.isArray(localSaved) && localSaved.length > 0) {
      return localSaved.map((row) => ({
        id: row.id || `hsn-${row.code}`,
        code: String(row.code),
        description: row.description ?? '',
        gstRate: String(row.code).startsWith('3004') ? 5 : Number(row.gst_rate ?? row.gstRate ?? 12),
        type: row.code?.startsWith('99') ? 'Services' : 'Goods'
      }))
    }

    return (defaultHsnMaster as any[]).map((row) => ({
      id: row.id || `hsn-${row.code}`,
      code: String(row.code),
      description: row.description ?? '',
      gstRate: String(row.code).startsWith('3004') ? 5 : Number(row.gst_rate ?? row.gstRate ?? 12),
      type: row.code?.startsWith('99') ? 'Services' : 'Goods'
    }))
  })

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

  useEffect(() => {
    getErp<any[]>('hsn')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setItems((prev) => {
            // Keep any locally created or edited items
            const localSaved = new Map<string, HsnItem>()
            prev.forEach((p) => localSaved.set(p.code, p))

            const merged = rows.map((row) => {
              const codeStr = String(row.code)
              const existing = localSaved.get(codeStr)
              return {
                id: row.id || existing?.id || `hsn-${codeStr}`,
                code: codeStr,
                description: row.description ?? existing?.description ?? '',
                gstRate: codeStr.startsWith('3004') ? 5 : Number(row.gst_rate ?? row.gstRate ?? existing?.gstRate ?? 12),
                type: (codeStr.startsWith('99') ? 'Services' : 'Goods') as 'Goods' | 'Services'
              }
            })

            // Add any custom items that were not in API response
            const apiCodes = new Set(rows.map((r) => String(r.code)))
            for (const [c, p] of localSaved) {
              if (!apiCodes.has(c)) merged.push(p)
            }

            try {
              localStorage.setItem('pharma_erp_custom_hsn', JSON.stringify(merged))
            } catch {}

            return merged
          })
        }
      })
      .catch(() => {
        // Keeps the default/local HSN master records safely loaded
      })
  }, [])

  const persistItems = (newItems: HsnItem[]) => {
    setItems(newItems)
    try {
      localStorage.setItem('pharma_erp_custom_hsn', JSON.stringify(newItems))
    } catch {}
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) return
    const cleanCode = code.trim()
    const finalGst = cleanCode.startsWith('3004') ? 5 : gst
    const newItem: HsnItem = {
      id: `hsn-${cleanCode}`,
      code: cleanCode,
      description: name.trim(),
      gstRate: finalGst,
      type
    }

    try {
      postErp<any>('hsn', { code: cleanCode, description: name.trim(), gst_rate: finalGst }).catch(() => {})
      const updated = [newItem, ...items.filter((i) => i.code !== cleanCode)]
      persistItems(updated)
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
      patchErp('hsn', editingItem.id, {
        code: updated.code,
        description: updated.description,
        gst_rate: updated.gstRate
      }).catch(() => {})

      const newItems = items.map((i) => (i.id === editingItem.id ? updated : i))
      persistItems(newItems)
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
      deleteErp('hsn', target.id).catch(() => {})
      const updated = items.filter((i) => i.id !== target.id && i.code !== target.code)
      persistItems(updated)
      setDeletingItem(null)
      showToast(`HSN / SAC ${target.code} deleted.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete HSN code.')
    }
  }

  // Bulk set all 3004 codes to 5% GST
  const handleBulkSet3004 = () => {
    const updated = items.map((i) =>
      String(i.code).startsWith('3004') ? { ...i, gstRate: 5 } : i
    )
    persistItems(updated)
    showToast('All codes starting with 3004 set to 5% GST.')
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">HSN / SAC Master</h1>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              {totalItems.toLocaleString()} Codes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Harmonized System of Nomenclature & Service Accounting Codes with continuous chunking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {is3004Filtered && (
            <button
              type="button"
              onClick={handleBulkSet3004}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="Set all 3004 codes to 5% GST"
            >
              <Percent size={13} className="text-slate-500 dark:text-slate-400" />
              <span>Set 3004 to 5% GST</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition cursor-pointer"
          >
            <Plus size={16} /> Add HSN / SAC
          </button>
        </div>
      </div>

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="text-slate-400 shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search by code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition cursor-pointer',
                chunkMode === 'paginated'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1 cursor-pointer',
                chunkMode === 'continuous'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Layers size={12} /> Continuous
            </button>
          </div>

          {/* Chunk Selector */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>Chunk:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs outline-none"
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
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Showing <span className="font-semibold text-slate-200">{startIdx}</span> to{' '}
          <span className="font-semibold text-slate-200">{endIdx}</span> of{' '}
          <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> codes
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-slate-200 whitespace-nowrap shrink-0">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[650px] w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-3.5">HSN / SAC Code</th>
              <th className="p-3.5">Description</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5">GST Rate</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {displayedItems.map((i) => (
              <tr key={i.id} className="hover:bg-slate-900/40 text-slate-300 transition-colors">
                <td className="p-3.5 font-mono font-semibold text-slate-200">{i.code}</td>
                <td className="p-3.5 font-medium text-white max-w-md truncate" title={i.description}>
                  {i.description}
                </td>
                <td className="p-3.5 text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[11px]">
                    {i.type}
                  </span>
                </td>
                <td className="p-3.5">
                  <span
                    className={cn(
                      'inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border',
                      i.gstRate === 5
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : i.gstRate === 12
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        : i.gstRate === 18
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                        : i.gstRate === 28
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30'
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-600/20 border border-transparent hover:border-indigo-500/30 transition cursor-pointer"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${i.code}`}
                      title={`Delete HSN ${i.code}`}
                      onClick={() => openDeleteModal(i)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-600/20 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {displayedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                  No HSN / SAC codes match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Continuous Stream "Load Next Chunk" Button */}
      {chunkMode === 'continuous' && continuousCount < totalItems && (
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Loaded <span className="font-semibold text-slate-200">{endIdx}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> codes (
            {Math.round((endIdx / totalItems) * 100)}%)
          </div>
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <ArrowDownCircle size={15} /> Load Next {Math.min(pageSize || 50, totalItems - endIdx)} Codes
          </button>
        </div>
      )}

      {chunkMode === 'continuous' && continuousCount >= totalItems && totalItems > 0 && (
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
          <CheckCircle2 size={14} /> All {totalItems.toLocaleString()} codes loaded
        </div>
      )}

      {/* Bottom Pagination Footer */}
      {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
        <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing page <span className="font-medium text-slate-200">{currentPage}</span> of{' '}
            <span className="font-medium text-slate-200">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <ChevronsLeft size={13} /> First
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="px-2 font-mono text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight size={13} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              Last <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md p-6 relative shadow-2xl text-white">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Plus size={18} className="text-indigo-400" />
                Add New HSN / SAC Code
              </h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30049011"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Medicaments consisting of mixed/unmixed therapeutic formulations"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as 'Goods' | 'Services')}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="Goods">Goods</option>
                      <option value="Services">Services</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      required
                      value={gst}
                      onChange={(e) => setGst(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Standard Tax Slabs</label>
                  <div className="flex gap-1.5">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setGst(rate)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded font-mono font-medium transition cursor-pointer',
                          gst === rate
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        )}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition cursor-pointer"
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
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md p-6 relative shadow-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 size={18} className="text-indigo-400" />
                  Edit HSN / SAC Code
                </h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {editingItem.code}
                </span>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">HSN / SAC Code *</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as 'Goods' | 'Services')}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="Goods">Goods</option>
                      <option value="Services">Services</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      required
                      value={editGst}
                      onChange={(e) => setEditGst(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Standard Tax Slabs</label>
                  <div className="flex gap-1.5">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setEditGst(rate)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded font-mono font-medium transition cursor-pointer',
                          editGst === rate
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        )}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition cursor-pointer"
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
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md p-6 relative shadow-2xl text-white space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete HSN / SAC Code</h3>
                  <p className="text-xs text-slate-400">Are you sure you want to delete this record?</p>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">HSN Code:</span>
                  <span className="font-mono font-semibold text-white">{deletingItem.code}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-400 shrink-0">Description:</span>
                  <span className="text-slate-300 text-right truncate max-w-[220px]" title={deletingItem.description}>
                    {deletingItem.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GST Rate:</span>
                  <span className="font-semibold text-emerald-400">{deletingItem.gstRate}%</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-md transition cursor-pointer"
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
