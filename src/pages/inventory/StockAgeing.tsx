import { useState } from 'react'
import { Download, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'

const DATA = [
  { name: 'Amoxicillin 500mg', batch: 'AMX-2025-118', expiry: '2026-04-15', qty: 200, mrp: 180, rate: 85, location: 'Store A' },
  { name: 'Amoxicillin 500mg', batch: 'AMX-2026-045', expiry: '2027-06-30', qty: 240, mrp: 180, rate: 85, location: 'Store A' },
  { name: 'Ciprofloxacin 500mg', batch: 'CIP-2025-042', expiry: '2026-04-20', qty: 150, mrp: 160, rate: 72, location: 'Store C' },
  { name: 'Metronidazole 400mg', batch: 'MET-2025-091', expiry: '2026-05-01', qty: 300, mrp: 95, rate: 38, location: 'Store B' },
  { name: 'Omeprazole 20mg', batch: 'OMP-2025-073', expiry: '2026-05-10', qty: 180, mrp: 110, rate: 48, location: 'Store B' },
  { name: 'Paracetamol 650mg', batch: 'PCM-2026-088', expiry: '2027-09-15', qty: 380, mrp: 90, rate: 35, location: 'Store B' },
  { name: 'Azithromycin 250mg', batch: 'AZT-2026-012', expiry: '2027-03-20', qty: 160, mrp: 240, rate: 120, location: 'Store A' },
  { name: 'Cetirizine 10mg', batch: 'CTZ-2026-077', expiry: '2027-11-10', qty: 290, mrp: 75, rate: 28, location: 'Store C' },
  { name: 'Metformin 500mg', batch: 'MTF-2026-034', expiry: '2027-08-25', qty: 150, mrp: 120, rate: 55, location: 'Store B' },
  { name: 'Pantoprazole 40mg', batch: 'PNT-2026-091', expiry: '2027-04-18', qty: 210, mrp: 150, rate: 68, location: 'Store A' },
  { name: 'Dolo 650', batch: 'DLO-2026-201', expiry: '2028-01-15', qty: 450, mrp: 120, rate: 45, location: 'Store A' },
  { name: 'Ibuprofen 400mg', batch: 'IBU-2024-055', expiry: '2026-03-20', qty: 80, mrp: 85, rate: 32, location: 'Store C' },
]

function getAgeGroup(expiry: string) {
  const days = daysUntilExpiry(expiry)
  if (days <= 0) return { label: 'Expired', color: 'text-red-400 bg-red-500/10', sort: 0 }
  if (days <= 30) return { label: '< 30 days', color: 'text-red-400 bg-red-500/10', sort: 1 }
  if (days <= 90) return { label: '30-90 days', color: 'text-amber-400 bg-amber-500/10', sort: 2 }
  if (days <= 180) return { label: '90-180 days', color: 'text-yellow-400 bg-yellow-500/10', sort: 3 }
  if (days <= 365) return { label: '6-12 months', color: 'text-blue-400 bg-blue-500/10', sort: 4 }
  return { label: '> 12 months', color: 'text-emerald-400 bg-emerald-500/10', sort: 5 }
}

export default function StockAgeing() {
  const [filter, setFilter] = useState('all')
  const enriched = DATA.map(d => ({ ...d, ageGroup: getAgeGroup(d.expiry), days: daysUntilExpiry(d.expiry) })).sort((a, b) => a.days - b.days)
  const filtered = filter === 'all' ? enriched : enriched.filter(d => d.ageGroup.label === filter)
  const groups = ['all', ...new Set(enriched.map(d => d.ageGroup.label))]

  const summary = [
    { label: 'Critical (< 30d)', count: enriched.filter(d => d.days <= 30 && d.days > 0).length, value: enriched.filter(d => d.days <= 30 && d.days > 0).reduce((a, d) => a + d.qty * d.rate, 0), color: 'text-red-400' },
    { label: 'Warning (30-90d)', count: enriched.filter(d => d.days > 30 && d.days <= 90).length, value: enriched.filter(d => d.days > 30 && d.days <= 90).reduce((a, d) => a + d.qty * d.rate, 0), color: 'text-amber-400' },
    { label: 'Safe (> 90d)', count: enriched.filter(d => d.days > 90).length, value: enriched.filter(d => d.days > 90).reduce((a, d) => a + d.qty * d.rate, 0), color: 'text-emerald-400' },
    { label: 'Expired', count: enriched.filter(d => d.days <= 0).length, value: enriched.filter(d => d.days <= 0).reduce((a, d) => a + d.qty * d.rate, 0), color: 'text-red-500' },
  ]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Stock Ageing & Expiry</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /> Near-expiry monitoring for pharma compliance</p></div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700"><Download size={16} /> Export</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map(s => (<div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">{s.label}</div>
          <div className={cn('text-xl font-bold mt-1', s.color)}>{s.count} items</div>
          <div className="text-xs text-slate-500 mt-0.5">Value: {formatCurrency(s.value)}</div></div>))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {groups.map(g => (<button key={g} onClick={() => setFilter(g)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition', filter === g ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{g === 'all' ? 'All' : g}</button>))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-left px-4 py-3 font-medium">Batch</th><th className="text-left px-4 py-3 font-medium">Expiry</th><th className="text-right px-4 py-3 font-medium">Days Left</th><th className="text-left px-4 py-3 font-medium">Age Group</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">MRP</th><th className="text-right px-4 py-3 font-medium">Value</th><th className="text-left px-4 py-3 font-medium">Location</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map((d, i) => (<tr key={i} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 font-medium text-white">{d.name}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{d.batch}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{d.expiry}</td>
              <td className="px-4 py-3 text-right font-bold"><span className={d.days <= 30 ? 'text-red-400' : d.days <= 90 ? 'text-amber-400' : 'text-slate-400'}>{d.days}</span></td>
              <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', d.ageGroup.color)}>{d.ageGroup.label}</span></td>
              <td className="px-4 py-3 text-right font-medium">{d.qty}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.mrp)}</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(d.qty * d.rate)}</td>
              <td className="px-4 py-3 text-slate-400">{d.location}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
