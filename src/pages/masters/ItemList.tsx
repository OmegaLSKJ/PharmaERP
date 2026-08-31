import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Download, MoreHorizontal, Package, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { exportVisibleTables } from '../../lib/download'

interface Item {
  id: string; code?: string; name: string; packing: string; manufacturer: string; salt: string;
  hsn: string; gstRate: number; mrp: number; saleRate: number; purchaseRate: number;
  stock: number; batchCount: number; category: string; status: 'active' | 'banned' | 'slow'
}

export default function ItemList() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const showToast = useUIStore((state) => state.showToast)

  useEffect(() => { getErp<Item[]>('items').then(setItems).catch((error) => showToast(error instanceof Error ? error.message : 'Could not load items.')).finally(() => setLoading(false)) }, [showToast])

  const categories = ['all', ...new Set(items.map((i) => i.category))]

  const filtered = items.filter((i) => {
    const q = search.toLowerCase()
    const matchSearch =
      i.name.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      (i.code && i.code.toLowerCase().includes(q)) ||
      (i.manufacturer && i.manufacturer.toLowerCase().includes(q)) ||
      (i.hsn && i.hsn.toLowerCase().includes(q)) ||
      (i.salt && i.salt.toLowerCase().includes(q))
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} items &bull; Batch-wise stock tracking</p>
        </div>
        <Link
          to="/masters/items/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New Item
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, or salt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
          ))}
        </select>
        <button aria-label="Export filtered items" onClick={() => exportVisibleTables('items')} className="p-2 rounded-md border border-input hover:bg-muted text-muted-foreground">
          <Download size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading items…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Packing</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Manufacturer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">HSN</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">MRP</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sale Rate</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Batches</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border table-row-hover">
                  <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/masters/items/${item.id}`} className="font-medium hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{item.salt}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.packing}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.manufacturer}</td>
                  <td className="px-4 py-3 font-mono text-xs">{item.hsn}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.mrp)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.saleRate)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'font-medium',
                      item.stock === 0 ? 'text-red-500' : item.stock < 50 ? 'text-amber-500' : 'text-foreground'
                    )}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Package size={12} /> {item.batchCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                      item.status === 'active' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      item.status === 'banned' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                      item.status === 'slow' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    )}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link aria-label={`Edit ${item.name}`} to={`/masters/items/${item.id}`} className="inline-flex p-1 rounded hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
