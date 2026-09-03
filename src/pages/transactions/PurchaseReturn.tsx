import { useState, useEffect } from 'react'
import { Search, Plus, Printer, Eye, X } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'

interface ReturnEntry {
  id: string
  returnNo: string
  date: string
  supplier: string
  origChallan: string
  items: number
  total: number
  reason: string
  status: string
}

const STATUS_STYLE: Record<string, string> = {
  processed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export default function PurchaseReturn() {
  const [returns, setReturns] = useState<ReturnEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [origChallan, setOrigChallan] = useState('')
  const [reason, setReason] = useState('')
  const [items, setItems] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedReturn, setSelectedReturn] = useState<ReturnEntry | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  const load = () =>
    getErp<any[]>('purchase-returns')
      .then((rows) =>
        setReturns(
          rows.map((row) => ({
            id: row.id,
            returnNo: row.number,
            date: row.date,
            supplier: row.party,
            origChallan: row.origChallan ?? '',
            items: Number(row.items ?? 0),
            total: Number(row.total),
            reason: row.reason ?? '',
            status: row.status,
          }))
        )
      )
      .catch((e) => showToast(e.message))

  useEffect(() => {
    void load()
  }, [showToast])

  const filtered = returns.filter(
    (s) => s.supplier.toLowerCase().includes(search.toLowerCase()) || s.returnNo.toLowerCase().includes(search.toLowerCase())
  )

  const saveReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postErp('purchase-returns', {
        party: supplier,
        partyType: 'supplier',
        origChallan,
        reason,
        items,
        total,
        status: 'processed',
      })
      setShowForm(false)
      setSupplier('')
      setOrigChallan('')
      setReason('')
      setTotal(0)
      await load()
      showToast('Purchase return recorded.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save return.')
    }
  }

  const getPrintDataForReturn = (r: ReturnEntry): TaxInvoicePrintData => ({
    title: 'DEBIT NOTE / PURCHASE RETURN',
    copyType: 'Original for Supplier',
    invoiceNo: r.returnNo,
    invoiceDate: r.date,
    paymentMode: 'ADJUSTMENT',
    buyer: {
      name: r.supplier,
      address: 'Supplier / Vendor Account',
    },
    orderNo: r.origChallan ? `Ref Challan: ${r.origChallan}` : undefined,
    items: [
      {
        name: `Return of Goods (${r.reason || 'Damaged / Shortage / Expired'})`,
        packing: '1x1',
        qty: r.items || 1,
        rate: r.total,
        gstRate: 12,
        amount: r.total,
      },
    ],
    grandTotal: r.total,
  })

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen Interactive UI (Hidden during print) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Purchase Returns</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{filtered.length} return entries</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> New Return
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search supplier or return no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 block md:hidden">
        {filtered.map((s) => (
          <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-xs font-semibold text-indigo-400">{s.returnNo}</div>
                <div className="font-semibold text-white text-sm mt-0.5">{s.supplier}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-rose-400 text-sm">{formatCurrency(s.total)}</div>
                <span className="text-[10px] text-slate-500 font-mono">{s.date}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800 text-slate-400">
              <div>Orig. Challan: <span className="font-mono text-slate-300">{s.origChallan || 'N/A'}</span></div>
              <div>Items: <span className="font-mono text-white">{s.items}</span></div>
            </div>

            {s.reason && (
              <div className="text-xs text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 font-medium">Reason: </span>{s.reason}
              </div>
            )}

            <div className="pt-1 border-t border-slate-800">
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize border', STATUS_STYLE[s.status] || 'border-slate-800 text-slate-400')}>
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Return No</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Orig. Challan</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-900/30 transition">
                <td className="px-4 py-3 font-mono text-white">{s.returnNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.origChallan}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-rose-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3 text-slate-400">{s.reason}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status])}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedReturn(s)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="View & Print Debit Note"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(s)
                        setTimeout(() => window.print(), 100)
                      }}
                      className="p-1.5 rounded-lg bg-black hover:bg-neutral-900 text-white transition border border-black shadow-xs cursor-pointer"
                      title="Direct Print (Ctrl+P)"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
          <form onSubmit={saveReturn} className="bg-slate-900 border border-slate-800 w-full max-w-lg space-y-4 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base sm:text-lg font-semibold text-white">New Purchase Return</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm">
                Close
              </button>
            </div>
            <label className="grid gap-1 text-xs text-slate-400">
              Supplier / Vendor *
              <input required autoFocus value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Original Purchase Invoice / Challan *
              <input required value={origChallan} onChange={(e) => setOrigChallan(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Reason for Return *
              <input required value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-slate-400">
                Number of Items
                <input type="number" min="1" value={items} onChange={(e) => setItems(Number(e.target.value))} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Return Value (₹) *
                <input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
              </label>
            </div>
            <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 p-3 font-semibold text-white shadow-md transition">
              Post Purchase Return
            </button>
          </form>
        </div>
      )}
      </div>

      {/* Debit Note Print Preview Modal */}
      {selectedReturn && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setSelectedReturn(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Debit Note / Purchase Return Preview</h2>
                <p className="text-xs text-slate-400">
                  Return No: <span className="text-white font-mono">{selectedReturn.returnNo}</span> | Date:{' '}
                  <span className="text-white">{selectedReturn.date}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-950 border border-neutral-700 hover:border-neutral-500 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Printer size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                  <span>Print Debit Note</span>
                  <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-zinc-400 bg-white/10 rounded border border-white/10">
                    Ctrl+P
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
              <TaxInvoicePrint data={getPrintDataForReturn(selectedReturn)} />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {selectedReturn && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint data={getPrintDataForReturn(selectedReturn)} />
        </div>
      )}
    </div>
  )
}
