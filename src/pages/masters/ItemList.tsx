import { useEffect, useState, useMemo, useCallback } from 'react'
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
  Trash2,
  RefreshCw
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp } from '../../lib/erpApi'
import { getCached } from '../../lib/erpCache'
import { useUIStore } from '../../store/uiStore'
import { exportVisibleTables } from '../../lib/download'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import { getGstRateForHsn } from '../../lib/hsnUtils'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import { STANDARD_ITEM_CATEGORIES, resolveItemCategory } from '../../lib/itemCategories'

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
  const [items, setItems] = useState<Item[]>(() => {
    const cached = getCached<Item[]>('items')
    return Array.isArray(cached) ? cached : []
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loading, setLoading] = useState(() => !getCached('items'))
  const [refreshing, setRefreshing] = useState(false)

  // Standard Page-by-Page Pagination Controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const showToast = useUIStore((state) => state.showToast)

  const removeItem = async (item: Item) => {
    if (!window.confirm(`Delete ${item.name}? This is only available when the item has no linked records.`)) return
    try {
      await deleteErp('items', item.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
      showToast('Item deleted.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete item.')
    }
  }

  const loadItems = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true)
      else if (!getCached('items')) setLoading(true)
      const data = await getErp<Item[]>('items', undefined, { forceRefresh })
      if (!Array.isArray(data)) {
        throw new Error('The item catalogue response is not a list.')
      }
      setItems(data)
    } catch (error) {
      // Only clear items on first cold load; keep existing data on background refresh failure
      if (!getCached('items') && items.length === 0) setItems([])
      showToast(error instanceof Error ? error.message : 'Could not load items.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useErpAutoRefresh(['items', 'item-batches', 'manufacturers', 'salts', 'hsn'], () => loadItems(false))

  // Dynamically resolve category from salt or name if database returned generic placeholder
  const normalizedItems = useMemo(() => {
    return items.map((i) => ({
      ...i,
      category:
        i.category &&
        i.category.trim() &&
        i.category.toLowerCase() !== 'medicine' &&
        i.category.toLowerCase() !== 'general' &&
        i.category.toLowerCase() !== 'all'
          ? i.category.trim()
          : resolveItemCategory(i.name, i.salt, i.category)
    }))
  }, [items])

  // Count items across categories
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of normalizedItems) {
      const cat = item.category || 'General Medicine'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [normalizedItems])

  // Ordered category choices with counts
  const categoryOptions = useMemo(() => {
    const standardOrder = STANDARD_ITEM_CATEGORIES.filter((c) => c !== 'All Categories')
    const standardSet = new Set(standardOrder)
    const extraCats = Object.keys(categoryCounts).filter((c) => !standardSet.has(c as any)).sort()
    return [...standardOrder, ...extraCats]
  }, [categoryCounts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return normalizedItems.filter((i) => {
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
  }, [normalizedItems, search, categoryFilter])

  // Reset pagination index whenever search, category, or page size changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, pageSize])

  const totalItems = filtered.length
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / (pageSize || 50)) || 1

  const displayedItems = useMemo(() => {
    if (pageSize === 0) return filtered
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const startIdx = totalItems === 0 ? 0 : pageSize === 0 ? 1 : (currentPage - 1) * pageSize + 1
  const endIdx = pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems)


  const activeItem = activeId ? items.find((i) => i.id === activeId) || null : null
  const totalCatalogPurchaseVal = filtered.reduce((s, i) => s + (i.purchaseRate || 0) * (i.stock || 0), 0)
  const totalCatalogMrpVal = filtered.reduce((s, i) => s + (i.mrp || 0) * (i.stock || 0), 0)

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
            Real-time batch-wise stock tracking and inventory management
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => loadItems(true)}
            disabled={refreshing || loading}
            title="Sync live data from Supabase"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted text-foreground transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-primary' : ''} />
            <span className="hidden sm:inline">Sync Live</span>
          </button>
          <Link
            to="/masters/items/new"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-xs w-full sm:w-auto"
          >
            <Plus size={16} /> New Item
          </Link>
        </div>
      </div>

      {/* Filter & Pagination Controls */}
      <div className="bg-card border border-border p-3 rounded-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 max-w-2xl">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${items.length.toLocaleString()} items by name, code, manufacturer, HSN, or salt...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search items"
              className="w-full min-w-0 pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter items by category"
            className="!w-auto shrink-0 px-2.5 py-1.5 rounded-md border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring text-foreground shadow-xs cursor-pointer"
          >
            <option value="all">All Categories ({normalizedItems.length.toLocaleString()})</option>
            {categoryOptions.map((c) => {
              const count = categoryCounts[c] || 0
              return (
                <option key={c} value={c}>
                  {c} {count > 0 ? `(${count.toLocaleString()})` : '(0)'}
                </option>
              )
            })}
          </select>
        </div>

        {/* Page Size & Export */}
        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Items per page"
              className="px-2 py-1 rounded border border-input bg-background text-xs font-medium focus:outline-none text-foreground"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={500}>500 / page</option>
              <option value={0}>All ({totalItems.toLocaleString()})</option>
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

      {/* Pagination Summary & Top Quick Nav Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground px-1">
        <div className="whitespace-nowrap">
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> items
          {categoryFilter !== 'all' && (
            <span className="ml-2 font-medium text-primary">
              (Filtered by: {categoryFilter})
            </span>
          )}
        </div>

        {/* Quick pagination buttons for top toolbar */}
        {pageSize > 0 && totalPages > 1 && (
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
            <span className="px-1.5 sm:px-2 font-mono font-medium text-foreground whitespace-nowrap shrink-0">
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
              {displayedItems.map((item) => {
                const isActive = item.id === activeItem?.id
                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setActiveId(item.id)
                      setDetailModalOpen(true)
                    }}
                    className={cn(
                      'border-b border-border table-row-hover transition-colors cursor-pointer',
                      isActive ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40 border-l-4 border-l-indigo-500' : ''
                    )}
                  >
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.code || item.id}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link to={`/masters/items/${item.id}`} className="font-medium hover:text-primary hover:underline">
                        {item.name}
                      </Link>
                      {item.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/60 font-sans font-normal">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.salt && <div className="text-[11px] text-muted-foreground truncate max-w-xs">{item.salt}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.packing || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-medium">{item.manufacturer || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">
                    {item.hsn ? (
                      <span title={`${item.hsn} (${item.gstRate || getGstRateForHsn(item.hsn)}% GST)`}>
                        {item.hsn}
                        <span className="ml-1 text-[10px] text-muted-foreground font-sans">
                          ({item.gstRate !== undefined && item.gstRate !== null && Number(item.gstRate) > 0 ? item.gstRate : getGstRateForHsn(item.hsn)}%)
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
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
                    <button
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => removeItem(item)}
                      className="ml-1 inline-flex p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                )
              })}
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

        {/* Bottom Pagination Footer */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="p-3 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Showing page <span className="font-medium text-foreground">{currentPage}</span> of{' '}
              <span className="font-medium text-foreground">{totalPages}</span> ({pageSize} items per page)
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

      {/* Marg ERP Style Live Product Inspection Panel */}
      <ActiveProductDetailPanel
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        activeProduct={
          activeItem
            ? {
                name: activeItem.name,
                id: activeItem.id,
                code: activeItem.code,
                packing: activeItem.packing,
                manufacturer: activeItem.manufacturer,
                salt: activeItem.salt,
                hsn: activeItem.hsn,
                gstRate: activeItem.gstRate,
                stock: activeItem.stock,
                saleRate: activeItem.saleRate,
                mrp: activeItem.mrp,
                purchaseRate: activeItem.purchaseRate,
                costPrice: (activeItem as any).costPrice ?? (activeItem as any).batches?.[0]?.costPrice ?? (activeItem as any).batches?.[0]?.cost_price,
                category: activeItem.category,
                batch: (activeItem as any).batches?.[0]?.batch || (activeItem as any).batch,
                expiry: (activeItem as any).batches?.[0]?.expiry || (activeItem as any).expiry,
                location: (activeItem as any).batches?.[0]?.location || (activeItem as any).batches?.[0]?.rackNumber || (activeItem as any).batches?.[0]?.rack_number || (activeItem as any).location,
                purchaseSchemeDeal: (activeItem as any).batches?.[0]?.purchaseSchemeDeal ?? (activeItem as any).purchaseSchemeDeal,
                purchaseSchemeFree: (activeItem as any).batches?.[0]?.purchaseSchemeFree ?? (activeItem as any).purchaseSchemeFree,
                salesSchemeDeal: (activeItem as any).batches?.[0]?.salesSchemeDeal ?? (activeItem as any).salesSchemeDeal,
                salesSchemeFree: (activeItem as any).batches?.[0]?.salesSchemeFree ?? (activeItem as any).salesSchemeFree,
                refNo: (activeItem as any).batches?.[0]?.invoiceNumber || (activeItem as any).batches?.[0]?.supplier_invoice_number || (activeItem as any).batches?.[0]?.refNo || (activeItem as any).refNo,
                date: (activeItem as any).batches?.[0]?.invoiceDate || (activeItem as any).batches?.[0]?.supplier_invoice_date || (activeItem as any).batches?.[0]?.receivedOn || (activeItem as any).batches?.[0]?.date || (activeItem as any).date,
                supplier: (activeItem as any).batches?.[0]?.supplier || (activeItem as any).supplier,
              }
            : null
        }
        billSummary={{
          title: 'Catalogue Valuation',
          partyLabel: 'Category',
          partyName: categoryFilter === 'all' ? 'All Categories' : categoryFilter,
          mrpValue: totalCatalogMrpVal,
          valueOfGoods: totalCatalogPurchaseVal,
          grandTotal: totalCatalogPurchaseVal,
        }}
        totalRows={filtered.length}
        emptyMessage="Click any medicine row to inspect detailed salt composition, margin rates, and live stock."
      />
    </div>
  )
}
