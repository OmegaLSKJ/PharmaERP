import { useState, useEffect } from 'react'
import { Search, Plus, Eye, RotateCcw, Printer, X } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp, patchErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'

interface ReturnEntry {
  id: string
  returnNo: string
  date: string
  party: string
  origInvoice: string
  items: number
  total: number
  reason: string
  status: string
}

const STATUS_STYLE: Record<string, string> = {
  processed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  posted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

export default function SaleReturn() {
  const [returns, setReturns] = useState<ReturnEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [party, setParty] = useState('')
  const [origInvoice, setOrigInvoice] = useState('')
  const [reason, setReason] = useState('')
  const [items, setItems] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedReturn, setSelectedReturn] = useState<ReturnEntry | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  const load = () =>
    getErp<any[]>('sale-returns')
      .then((rows) =>
        setReturns(
          rows.map((row) => ({
            id: row.id,
            returnNo: row.number,
            date: row.date,
            party: row.party,
            origInvoice: row.origInvoice ?? '',
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
    (s) => s.party.toLowerCase().includes(search.toLowerCase()) || s.returnNo.toLowerCase().includes(search.toLowerCase())
  )
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  const saveReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postErp('sale-returns', { party, origInvoice, reason, items, total, status: 'processed' })
      setShowForm(false)
      setParty('')
      setOrigInvoice('')
      setReason('')
      setTotal(0)
      await load()
      showToast('Sale return recorded.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save return.')
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen List (Hidden when printing) */}
      <div className="no-print space-y-4">
      <PrintHeader title="Sale Returns" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Sale Returns</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {filtered.length} returns | Total: <span className="font-mono font-semibold text-rose-400">{formatCurrency(totalVal)}</span>
          </p>
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
          placeholder="Search by return no or party..."
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
                <div className="font-semibold text-white text-sm mt-0.5">{s.party}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-rose-400 text-sm">{formatCurrency(s.total)}</div>
                <span className="text-[10px] text-slate-500 font-mono">{s.date}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800 text-slate-400">
              <div>Orig. Invoice: <span className="font-mono text-slate-300">{s.origInvoice || 'N/A'}</span></div>
              <div>Items: <span className="font-mono text-white">{s.items}</span></div>
            </div>

            {s.reason && (
              <div className="text-xs text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 font-medium">Reason: </span>{s.reason}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <select
                aria-label={`Change status of ${s.returnNo}`}
                value={s.status}
                onChange={async (e) => {
                  const newStatus = e.target.value
                  try {
                    await patchErp('sale-returns', s.id, { status: newStatus })
                    showToast('Status updated successfully.')
                    await load()
                  } catch (err: any) {
                    showToast(err.message || 'Failed to update status.')
                  }
                }}
                className={cn(
                  'px-2 py-1 rounded text-xs font-semibold capitalize border bg-slate-950 outline-none cursor-pointer',
                  STATUS_STYLE[s.status]
                )}
              >
                <option value="pending" className="bg-slate-900 text-amber-400">Pending</option>
                <option value="processed" className="bg-slate-900 text-emerald-400">Processed</option>
                <option value="rejected" className="bg-slate-900 text-rose-400">Rejected</option>
              </select>

              <button
                aria-label={`Print ${s.returnNo}`}
                onClick={() => window.print()}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <Eye size={15} />
              </button>
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
              <th className="text-left px-4 py-3 font-medium">Party</th>
              <th className="text-left px-4 py-3 font-medium">Orig. Invoice</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-900/30 transition">
                <td className="px-4 py-3 font-mono text-white">{s.returnNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                <td className="px-4 py-3 font-medium text-white">{s.party}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{s.origInvoice}</td>
                <td className="px-4 py-3 text-right">{s.items}</td>
                <td className="px-4 py-3 text-right font-medium text-rose-400">{formatCurrency(s.total)}</td>
                <td className="px-4 py-3 text-slate-400">{s.reason}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Change status of ${s.returnNo}`}
                    value={s.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      try {
                        await patchErp('sale-returns', s.id, { status: newStatus })
                        showToast('Status updated successfully.')
                        await load()
                      } catch (err: any) {
                        showToast(err.message || 'Failed to update status.')
                      }
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-semibold capitalize border border-transparent bg-slate-950 text-white outline-none focus:border-indigo-500 cursor-pointer',
                      STATUS_STYLE[s.status]
                    )}
                  >
                    <option value="pending" className="bg-slate-900 text-amber-400">Pending</option>
                    <option value="processed" className="bg-slate-900 text-emerald-400">Processed</option>
                    <option value="rejected" className="bg-slate-900 text-rose-400">Rejected</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    aria-label={`Print ${s.returnNo}`}
                    onClick={() => setSelectedReturn(s)}
                    className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition"
                    title="View & Print Credit Note"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
          <form onSubmit={saveReturn} className="bg-slate-900 border border-slate-800 w-full max-w-lg space-y-4 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base sm:text-lg font-semibold text-white">New Sale Return</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm">
                Close
              </button>
            </div>
            <label className="grid gap-1 text-xs text-slate-400">
              Party / Customer *
              <input required autoFocus value={party} onChange={(e) => setParty(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500" />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              Original Invoice Number *
              <input required value={origInvoice} onChange={(e) => setOrigInvoice(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono" />
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
              Post Sale Return
            </button>
          </form>
        </div>
      )}
      </div>

      {/* Credit Note / Sale Return Print Preview Modal */}
      {selectedReturn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setSelectedReturn(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Credit Note / Sale Return Bill</h2>
                <p className="text-xs text-slate-400">
                  Return No: <span className="text-white font-mono">{selectedReturn.returnNo}</span> | Party:{' '}
                  <span className="text-white">{selectedReturn.party}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-neutral-900 text-white rounded-lg text-xs font-bold shadow transition border border-black cursor-pointer"
                >
                  <Printer size={14} className="text-white" /> Print Credit Note
                </button>
                <button
                  onClick={() => setSelectedReturn(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
              <TaxInvoicePrint
                data={{
                  title: 'CREDIT NOTE / SALE RETURN',
                  copyType: 'Original for Customer',
                  invoiceNo: selectedReturn.returnNo,
                  invoiceDate: selectedReturn.date,
                  orderNo: selectedReturn.origInvoice ? `Ref Inv: ${selectedReturn.origInvoice}` : undefined,
                  buyer: {
                    name: selectedReturn.party,
                    address: 'Local / Customer',
                  },
                  items: [
                    {
                      name: `Returned Goods (${selectedReturn.reason || 'Sale Return'})`,
                      packing: '1x10',
                      batch: 'RET-' + selectedReturn.returnNo,
                      qty: selectedReturn.items || 1,
                      rate: selectedReturn.total / Math.max(1, selectedReturn.items || 1),
                      gstRate: 12,
                      amount: selectedReturn.total,
                    },
                  ],
                  grandTotal: selectedReturn.total,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {selectedReturn && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint
            data={{
              title: 'CREDIT NOTE / SALE RETURN',
              copyType: 'Original for Customer',
              invoiceNo: selectedReturn.returnNo,
              invoiceDate: selectedReturn.date,
              orderNo: selectedReturn.origInvoice ? `Ref Inv: ${selectedReturn.origInvoice}` : undefined,
              buyer: {
                name: selectedReturn.party,
                address: 'Local / Customer',
              },
              items: [
                {
                  name: `Returned Goods (${selectedReturn.reason || 'Sale Return'})`,
                  packing: '1x10',
                  batch: 'RET-' + selectedReturn.returnNo,
                  qty: selectedReturn.items || 1,
                  rate: selectedReturn.total / Math.max(1, selectedReturn.items || 1),
                  gstRate: 12,
                  amount: selectedReturn.total,
                },
              ],
              grandTotal: selectedReturn.total,
            }}
          />
        </div>
      )}
    </div>
  )
}
