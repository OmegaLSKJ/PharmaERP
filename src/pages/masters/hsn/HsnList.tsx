import { useEffect, useState, useMemo } from 'react'
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
  CheckCircle2
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
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [gst, setGst] = useState(12)
  const [type, setType] = useState<'Goods' | 'Services'>('Goods')
  const showToast = useUIStore((state) => state.showToast)

  // Chunking controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')

  useEffect(() => {
    getErp<any[]>('hsn')
      .then((rows) =>
        setItems(
          rows.map((row) => ({
            id: row.id,
            code: row.code,
            description: row.description ?? '',
            gstRate: Number(row.gst_rate),
            type: row.code?.startsWith('99') ? 'Services' : 'Goods'
          }))
        )
      )
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load HSN codes.'))
  }, [showToast])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) return
    try {
      const row = await postErp<any>('hsn', { code, description: name, gst_rate: gst })
      setItems([
        ...items,
        { id: row.id, code: row.code, description: row.description ?? '', gstRate: Number(row.gst_rate), type }
      ])
      setName('')
      setCode('')
      setGst(12)
      setShowModal(false)
      showToast('HSN / SAC saved.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save HSN code.')
    }
  }

  const removeItem = async (id: string) => {
    try {
      await deleteErp('hsn', id)
      setItems((current) => current.filter((item) => item.id !== id))
      showToast('HSN / SAC deleted.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete HSN code.')
    }
  }

  const editItem = async (item: HsnItem) => {
    const description = window.prompt('HSN / SAC description', item.description)
    if (!description) return
    const rate = Number(window.prompt('GST rate', String(item.gstRate)))
    if (!Number.isFinite(rate)) return
    try {
      await patchErp('hsn', item.id, { description, gst_rate: rate })
      setItems((rows) =>
        rows.map((row) => (row.id === item.id ? { ...row, description, gstRate: rate } : row))
      )
      showToast('HSN / SAC updated.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update HSN code.')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((i) => !q || i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> Add HSN / SAC
        </button>
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
                'px-2.5 py-1 rounded font-medium transition',
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
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
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
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
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
              <tr key={i.id} className="hover:bg-slate-900/30 text-slate-300">
                <td className="p-3.5 font-mono font-medium text-slate-400">{i.code}</td>
                <td className="p-3.5 font-medium text-white">{i.description}</td>
                <td className="p-3.5 text-xs text-slate-400">{i.type}</td>
                <td className="p-3.5 text-emerald-400 font-semibold">{i.gstRate}%</td>
                <td className="p-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      aria-label={`Edit ${i.code}`}
                      onClick={() => editItem(i)}
                      className="p-1 hover:text-white text-slate-400 transition"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      aria-label={`Delete ${i.code}`}
                      onClick={() => removeItem(i.id)}
                      className="p-1 hover:text-rose-400 text-slate-400 transition"
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
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
              <span className="font-medium text-slate-200">{totalPages}</span> ({pageSize} per chunk)
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
              >
                <ChevronsLeft size={13} /> First
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="px-3 py-1 font-mono font-semibold text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
              >
                Last <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-bold text-white mb-4">Add New HSN / SAC</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30049011"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol preparations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'Goods' | 'Services')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Goods">Goods</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    required
                    value={gst}
                    onChange={(e) => setGst(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md"
                >
                  Save HSN / SAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
