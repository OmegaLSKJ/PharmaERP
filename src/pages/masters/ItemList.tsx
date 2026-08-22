import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Download, MoreHorizontal, Package, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'

interface Item {
  id: string; name: string; packing: string; manufacturer: string; salt: string;
  hsn: string; gstRate: number; mrp: number; saleRate: number; purchaseRate: number;
  stock: number; batchCount: number; category: string; status: 'active' | 'banned' | 'slow'
}

const ITEMS: Item[] = [
  { id: 'I001', name: 'Amoxicillin 500mg', packing: '10x10', manufacturer: 'Cipla', salt: 'Amoxicillin Trihydrate', hsn: '3004', gstRate: 12, mrp: 180, saleRate: 152, purchaseRate: 85, stock: 1240, batchCount: 4, category: 'Antibiotic', status: 'active' },
  { id: 'I002', name: 'Paracetamol 650mg', packing: '10x10', manufacturer: 'Sun Pharma', salt: 'Paracetamol', hsn: '3004', gstRate: 12, mrp: 90, saleRate: 76, purchaseRate: 35, stock: 980, batchCount: 3, category: 'Analgesic', status: 'active' },
  { id: 'I003', name: 'Azithromycin 250mg', packing: '10x6', manufacturer: 'Dr. Reddy\'s', salt: 'Azithromycin Dihydrate', hsn: '3004', gstRate: 12, mrp: 240, saleRate: 202, purchaseRate: 120, stock: 860, batchCount: 2, category: 'Antibiotic', status: 'active' },
  { id: 'I004', name: 'Cetirizine 10mg', packing: '10x10', manufacturer: 'Cipla', salt: 'Cetirizine HCl', hsn: '3004', gstRate: 12, mrp: 75, saleRate: 63, purchaseRate: 28, stock: 740, batchCount: 3, category: 'Antiallergic', status: 'active' },
  { id: 'I005', name: 'Metformin 500mg', packing: '10x10', manufacturer: 'USV', salt: 'Metformin HCl', hsn: '3004', gstRate: 12, mrp: 120, saleRate: 101, purchaseRate: 55, stock: 650, batchCount: 2, category: 'Antidiabetic', status: 'active' },
  { id: 'I006', name: 'Pantoprazole 40mg', packing: '10x10', manufacturer: 'Alkem', salt: 'Pantoprazole Sodium', hsn: '3004', gstRate: 12, mrp: 150, saleRate: 126, purchaseRate: 68, stock: 590, batchCount: 2, category: 'Gastrointestinal', status: 'active' },
  { id: 'I007', name: 'Dolo 650', packing: '15x10', manufacturer: 'Micro Labs', salt: 'Paracetamol', hsn: '3004', gstRate: 12, mrp: 120, saleRate: 101, purchaseRate: 45, stock: 450, batchCount: 3, category: 'Analgesic', status: 'active' },
  { id: 'I008', name: 'Cough Syrup DX', packing: '100ml', manufacturer: 'Dabur', salt: 'Dextromethorphan', hsn: '3004', gstRate: 12, mrp: 95, saleRate: 80, purchaseRate: 42, stock: 30, batchCount: 1, category: 'Respiratory', status: 'slow' },
  { id: 'I009', name: 'Ibuprofen 400mg', packing: '10x10', manufacturer: 'Ranbaxy', salt: 'Ibuprofen', hsn: '3004', gstRate: 12, mrp: 85, saleRate: 72, purchaseRate: 32, stock: 0, batchCount: 0, category: 'Analgesic', status: 'banned' },
  { id: 'I010', name: 'Omeprazole 20mg', packing: '10x10', manufacturer: 'Zydus', salt: 'Omeprazole', hsn: '3004', gstRate: 12, mrp: 110, saleRate: 93, purchaseRate: 48, stock: 420, batchCount: 2, category: 'Gastrointestinal', status: 'active' },
]

export default function ItemList() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = ['all', ...new Set(ITEMS.map((i) => i.category))]

  const filtered = ITEMS.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()) || i.salt.toLowerCase().includes(search.toLowerCase())
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
        <button className="p-2 rounded-md border border-input hover:bg-muted text-muted-foreground">
          <Download size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
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
                    <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                      <MoreHorizontal size={14} />
                    </button>
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
