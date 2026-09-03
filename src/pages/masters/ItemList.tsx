import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ArrowDownCircle,
  CheckCircle2
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { exportVisibleTables } from '../../lib/download'

interface Item {
  id: string
  code?: string
  name: string
  packing: string
  manufacturer: string
  salt: string
  hsn: string
  gstRate: number
  mrp: number
  saleRate: number
  purchaseRate: number
  stock: number
  batchCount: number
  category: string
  status: 'active' | 'banned' | 'slow'
}

export default function ItemList() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  // Continuous Page Chunking Controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')

  const showToast = useUIStore((state) => state.showToast)

  useEffect(() => {
    getErp<Item[]>('items')
      .then(setItems)
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load items.'))
      .finally(() => setLoading(false))
  }, [showToast])

  const categories = useMemo(() => ['all', ...new Set(items.map((i) => i.category))], [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((i) => {
      const matchSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.code && i.code.toLowerCase().includes(q)) ||
        (i.manufacturer && i.manufacturer.toLowerCase().includes(q)) ||
        (i.hsn && i.hsn.toLowerCase().includes(q)) ||
        (i.salt && i.salt.toLowerCase().includes(q))
      const matchCat = categoryFilter === 'all' || i.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [items, search, categoryFilter])

  // Reset pagination index whenever search, category, or page size changes
  useEffect(() => {
    setCurrentPage(1)
    setContinuousCount(pageSize || 50)
  }, [search, categoryFilter, pageSize])

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Items Master</h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              {totalItems.toLocaleString()} Total Items
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time batch-wise stock tracking with continuous page chunking
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to="/masters/items/new"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-xs w-full sm:w-auto"
          >
            <Plus size={16} /> New Item
          </Link>
        </div>
      </div>

      {/* Filter & Continuous Chunking Controls */}
      <div className="bg-card border border-border p-3 rounded-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search 2,016 items by name, code, manufacturer, HSN, or salt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>

        {/* Chunking Mode & Page Size Selectors */}
        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Chunking Mode Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-all',
                chunkMode === 'paginated'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1',
                chunkMode === 'continuous'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers size={12} /> Continuous
            </button>
          </div>

          {/* Chunk Size */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Chunk:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 rounded border border-input bg-background text-xs font-medium focus:outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={500}>500 / page</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>

          <button
            aria-label="Export filtered items"
            onClick={() => exportVisibleTables('items', useUIStore.getState().company)}
            title="Export to CSV"
            className="p-1.5 rounded-md border border-input hover:bg-muted text-muted-foreground"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* Chunk Info Strip */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div>
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> items
          {chunkMode === 'paginated' && pageSize > 0 && (
            <span className="ml-2 font-mono">
              (Page {currentPage} of {totalPages})
            </span>
          )}
        </div>

        {/* Quick pagination buttons for top toolbar */}
        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono font-medium text-foreground">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading all items…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Code / ID</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Item Name & Salt</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Packing</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Manufacturer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">HSN</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">MRP</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Sale Rate</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Batches</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr key={item.id} className="border-b border-border table-row-hover transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.code || item.id}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/masters/items/${item.id}`} className="font-medium hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                    {item.salt && <div className="text-[11px] text-muted-foreground truncate max-w-xs">{item.salt}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.packing || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-medium">{item.manufacturer || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{item.hsn || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.mrp)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(item.saleRate)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={cn(
                        'font-bold px-1.5 py-0.5 rounded text-xs',
                        item.stock === 0
                          ? 'bg-red-500/10 text-red-500'
                          : item.stock < 50
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'text-foreground'
                      )}
                    >
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Package size={12} /> {item.batchCount}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                        item.status === 'active' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        item.status === 'banned' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                        item.status === 'slow' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      aria-label={`Edit ${item.name}`}
                      to={`/masters/items/${item.id}`}
                      className="inline-flex p-1 rounded hover:bg-muted text-muted-foreground"
                    >
                      <MoreHorizontal size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && displayedItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    No items match the search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Continuous Stream "Load Next Chunk" Button */}
        {chunkMode === 'continuous' && continuousCount < totalItems && (
          <div className="p-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Loaded <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
              <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> items (
              {Math.round((endIdx / totalItems) * 100)}%)
            </div>
            <button
              onClick={handleLoadMore}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-md transition-colors shadow-xs"
            >
              <ArrowDownCircle size={15} /> Load Next {Math.min(pageSize || 50, totalItems - endIdx)} Items
            </button>
          </div>
        )}

        {chunkMode === 'continuous' && continuousCount >= totalItems && totalItems > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 size={14} /> All {totalItems.toLocaleString()} items fully loaded
          </div>
        )}

        {/* Bottom Pagination Footer */}
        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="p-3 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Showing page <span className="font-medium text-foreground">{currentPage}</span> of{' '}
              <span className="font-medium text-foreground">{totalPages}</span> ({pageSize} items per chunk)
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
              >
                <ChevronsLeft size={13} /> First
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="px-3 py-1 font-mono font-semibold text-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
              >
                Last <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
