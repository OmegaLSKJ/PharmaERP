import { useState } from 'react'
import { Search, Plus, Eye, Printer } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface PurchaseInv { id: string; challanNo: string; invoiceNo: string; date: string; supplier: string; items: number; total: number; status: string }

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-400',
  partial: 'bg-blue-500/10 text-blue-400',
}

export default function PurchaseRegister() {
  const [purchases, setPurchases] = useState<PurchaseInv[]>([])
  const [selected, setSelected] = useState<PurchaseInv | null>(null)
  const [search, setSearch] = useState('')
  const addToast = useUIStore((s) => s.addToast)
  useEffect(() => { getErp<any[]>('purchases').then((rows) => setPurchases(rows.map((row) => ({ id: row.dbId, challanNo: row.id, invoiceNo: row.supplierInvoice, date: row.date, supplier: row.party, items: row.items, total: row.total, status: row.status })))).catch((e) => addToast(e.message, 'error')) }, [addToast])
  const filtered = purchases.filter(s => s.supplier.toLowerCase().includes(search.toLowerCase()) || s.challanNo.toLowerCase().includes(search.toLowerCase()))
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Register</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} challans | Total: {formatCurrency(totalVal)}</p>
        </div>
        <a href="/transactions/purchase/new" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Purchase
        </a>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by challan or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[700px] w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Challan No</th>
              <th className="text-left px-4 py-3 font-medium">Supplier Invoice</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{s.challanNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.invoiceNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button aria-label={`View ${s.challanNo}`} onClick={() => setSelected(s)} className="p-1 hover:text-white text-slate-400"><Eye size={14} /></button>
                    <button aria-label={`Print ${s.challanNo}`} onClick={() => { setSelected(s); setTimeout(() => window.print(), 0) }} className="p-1 hover:text-white text-slate-400"><Printer size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="glass-surface w-full max-w-lg rounded-xl p-6 print:bg-white print:border-none print:shadow-none" onClick={(e) => e.stopPropagation()}>
            <PrintHeader title="Purchase Invoice Summary" />
            <div className="flex items-start justify-between no-print">
              <div>
                <h2 className="text-lg font-semibold">Purchase {selected.challanNo}</h2>
                <p className="text-sm text-muted-foreground">Supplier invoice {selected.invoiceNo || '—'}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground">Close</button>
            </div>
            
            <div className="hidden print:block mb-4">
              <h2 className="text-md font-bold text-black">Purchase Challan: {selected.challanNo}</h2>
              <p className="text-xs text-slate-500">Supplier Invoice: {selected.invoiceNo || '—'}</p>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm print:text-black">
              <div>
                <dt className="text-muted-foreground print:text-slate-500">Supplier</dt>
                <dd className="font-semibold">{selected.supplier}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-slate-500">Date</dt>
                <dd className="font-semibold">{selected.date}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-slate-500">Line items</dt>
                <dd className="font-semibold">{selected.items}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground print:text-slate-500">Total</dt>
                <dd className="font-mono text-emerald-600 font-bold print:text-black">{formatCurrency(selected.total)}</dd>
              </div>
            </dl>
            
            <button onClick={() => window.print()} className="mt-6 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white w-full no-print">
              Print purchase summary
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
