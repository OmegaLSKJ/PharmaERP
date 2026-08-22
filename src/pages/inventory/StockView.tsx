import { useState } from 'react'
import { Search, Download, Filter } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface StockItem {
  id: string; name: string; packing: string; manufacturer: string; batch: string;
  expiry: string; mrp: number; purchaseRate: number; stock: number; location: string;
}

const STOCK_DATA: StockItem[] = [
  { id: '1', name: 'Amoxicillin 500mg', packing: '10x10', manufacturer: 'Cipla', batch: 'AMX-2026-045', expiry: '2027-06-30', mrp: 180, purchaseRate: 85, stock: 240, location: 'Store A' },
  { id: '2', name: 'Amoxicillin 500mg', packing: '10x10', manufacturer: 'Cipla', batch: 'AMX-2025-118', expiry: '2026-04-15', mrp: 180, purchaseRate: 80, stock: 60, location: 'Store A' },
  { id: '3', name: 'Paracetamol 650mg', packing: '10x10', manufacturer: 'Sun Pharma', batch: 'PCM-2026-088', expiry: '2027-09-15', mrp: 90, purchaseRate: 35, stock: 380, location: 'Store B' },
  { id: '4', name: 'Azithromycin 250mg', packing: '10x6', manufacturer: 'Dr. Reddy\'s', batch: 'AZT-2026-012', expiry: '2027-03-20', mrp: 240, purchaseRate: 120, stock: 160, location: 'Store A' },
  { id: '5', name: 'Cetirizine 10mg', packing: '10x10', manufacturer: 'Cipla', batch: 'CTZ-2026-077', expiry: '2027-11-10', mrp: 75, purchaseRate: 28, stock: 290, location: 'Store C' },
  { id: '6', name: 'Metformin 500mg', packing: '10x10', manufacturer: 'USV', batch: 'MTF-2026-034', expiry: '2027-08-25', mrp: 120, purchaseRate: 55, stock: 150, location: 'Store B' },
  { id: '7', name: 'Pantoprazole 40mg', packing: '10x10', manufacturer: 'Alkem', batch: 'PNT-2026-091', expiry: '2027-04-18', mrp: 150, purchaseRate: 68, stock: 210, location: 'Store A' },
  { id: '8', name: 'Ciprofloxacin 500mg', packing: '10x10', manufacturer: 'Cipla', batch: 'CIP-2025-042', expiry: '2026-04-20', mrp: 160, purchaseRate: 72, stock: 150, location: 'Store C' },
  { id: '9', name: 'Omeprazole 20mg', packing: '10x10', manufacturer: 'Zydus', batch: 'OMP-2025-073', expiry: '2026-05-10', mrp: 110, purchaseRate: 48, stock: 180, location: 'Store B' },
  { id: '10', name: 'Dolo 650', packing: '15x10', manufacturer: 'Micro Labs', batch: 'DLO-2026-201', expiry: '2028-01-15', mrp: 120, purchaseRate: 45, stock: 450, location: 'Store A' },
]

export default function StockView() {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const locations = ['all', ...new Set(STOCK_DATA.map((s) => s.location))]

  const filtered = STOCK_DATA.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.batch.toLowerCase().includes(search.toLowerCase())
    const matchLoc = locationFilter === 'all' || s.location === locationFilter
    return matchSearch && matchLoc
  })

  const totalValue = filtered.reduce((sum, s) => sum + s.purchaseRate * s.stock, 0)
  const mrpValue = filtered.reduce((sum, s) => sum + s.mrp * s.stock, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Stock View</h1>
          <p className="text-sm text-slate-400 mt-1">Batch-wise inventory &bull; {filtered.length} entries</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">Total Qty</div>
          <div className="text-2xl font-bold text-white mt-1">{filtered.reduce((s, i) => s + i.stock, 0).toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">Purchase Value</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">MRP Value</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{formatCurrency(mrpValue)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name or batch..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500">
          {locations.map((l) => <option key={l} value={l}>{l === 'all' ? 'All Locations' : l}</option>)}
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Item Name</th>
                <th className="text-left px-4 py-3 font-medium">Packing</th>
                <th className="text-left px-4 py-3 font-medium">Manufacturer</th>
                <th className="text-left px-4 py-3 font-medium">Batch</th>
                <th className="text-left px-4 py-3 font-medium">Expiry</th>
                <th className="text-right px-4 py-3 font-medium">MRP</th>
                <th className="text-right px-4 py-3 font-medium">Purchase Rate</th>
                <th className="text-right px-4 py-3 font-medium">Stock Qty</th>
                <th className="text-right px-4 py-3 font-medium">Value</th>
                <th className="text-left px-4 py-3 font-medium">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((item) => {
                const daysLeft = Math.ceil((new Date(item.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={item.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3 text-slate-400">{item.packing}</td>
                    <td className="px-4 py-3 text-slate-400">{item.manufacturer}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{item.batch}</td>
                    <td className="px-4 py-3 font-mono">
                      <span className={cn(daysLeft <= 60 ? 'text-amber-400' : 'text-slate-400')}>{item.expiry}</span>
                      <span className={cn('ml-1 text-[10px]', daysLeft <= 30 ? 'text-rose-400' : daysLeft <= 60 ? 'text-amber-400' : 'text-slate-500')}>({daysLeft}d)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.mrp)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.purchaseRate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.stock}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(item.purchaseRate * item.stock)}</td>
                    <td className="px-4 py-3 text-slate-400">{item.location}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
