import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  Eye,
  Printer,
  Edit2,
  FileText,
  X,
  User,
  Calendar,
  Layers,
  Receipt,
  Download,
  ArrowRight
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface SaleLine {
  id?: string
  name: string
  code?: string
  batch?: string
  expiry?: string
  qty: number
  free?: number
  rate: number
  disc?: number
  gst?: number
  amount?: number
}

interface SaleInv {
  id: string
  invoiceNo: string
  date: string
  customer: string
  items: number
  total: number
  status: string
  lines?: SaleLine[]
  patientName?: string
  prescriberName?: string
  prescriptionReference?: string
}

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  posted: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  overdue: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  partial: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
}

export default function SaleRegister() {
  const [sales, setSales] = useState<SaleInv[]>([])
  const [selected, setSelected] = useState<SaleInv | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const addToast = useUIStore((s) => s.addToast)
  const navigate = useNavigate()

  useEffect(() => {
    getErp<any[]>('sales')
      .then((rows) =>
        setSales(
          rows.map((row) => ({
            id: row.dbId || row.id,
            invoiceNo: row.id || row.invoiceNo || row.number,
            date: row.date,
            customer: row.party,
            items: row.items || row.lines?.length || 1,
            total: Number(row.total || row.grandTotal || 0),
            status: row.status || 'posted',
            lines: row.lines,
            patientName: row.patientName,
            prescriberName: row.prescriberName,
            prescriptionReference: row.prescriptionReference
          }))
        )
      )
      .catch((e) => addToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [addToast])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sales.filter((s) => {
      const ms = !q || s.customer.toLowerCase().includes(q) || s.invoiceNo.toLowerCase().includes(q)
      const mf = statusFilter === 'all' || s.status === statusFilter
      return ms && mf
    })
  }, [sales, search, statusFilter])

  const totalVal = useMemo(() => filtered.reduce((a, s) => a + s.total, 0), [filtered])

  const openInvoice = (s: SaleInv) => {
    setSelected(s)
  }

  const editInvoice = (invoiceNo: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigate(`/transactions/sale/edit/${encodeURIComponent(invoiceNo)}`)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Sale Register</h1>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              {filtered.length} Invoices
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Tap on any invoice to view details or click edit &bull; Total Value:{' '}
            <span className="text-emerald-400 font-semibold">{formatCurrency(totalVal)}</span>
          </p>
        </div>
        <Link
          to="/transactions/sale/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> New Sale
        </Link>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex rounded-lg border border-slate-800 overflow-hidden text-xs bg-slate-900 p-0.5">
          {['all', 'paid', 'posted', 'pending', 'overdue', 'partial'].map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={cn(
                'px-3 py-1 font-medium capitalize transition rounded-md',
                statusFilter === t
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[700px] w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <th className="text-left px-4 py-3 font-semibold">Invoice No</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-right px-4 py-3 font-semibold">Items</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 animate-pulse">
                  Loading sale register…
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr
                  key={s.invoiceNo}
                  onClick={() => openInvoice(s)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  title="Click to view & edit invoice"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-500 group-hover:text-indigo-400" />
                    {s.invoiceNo}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-white group-hover:underline">{s.customer}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{s.items}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                    {formatCurrency(s.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[s.status] || STATUS_STYLE.posted)}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        aria-label={`View ${s.invoiceNo}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openInvoice(s)
                        }}
                        title="View Invoice Details"
                        className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        aria-label={`Edit ${s.invoiceNo}`}
                        onClick={(e) => editInvoice(s.invoiceNo, e)}
                        title="Edit Invoice"
                        className="p-1.5 hover:text-amber-400 text-slate-400 hover:bg-slate-800 rounded transition flex items-center gap-1"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        aria-label={`Print ${s.invoiceNo}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(s)
                          setTimeout(() => window.print(), 100)
                        }}
                        title="Print Invoice"
                        className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition"
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No sales invoices found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rich Invoice View & Edit Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 print:bg-white print:border-none print:shadow-none print:p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <PrintHeader title="Tax Invoice" />

            {/* Modal Header */}
            <div className="flex items-start justify-between no-print border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white font-mono">{selected.invoiceNo}</h2>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-semibold capitalize',
                      STATUS_STYLE[selected.status] || STATUS_STYLE.posted
                    )}
                  >
                    {selected.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} /> {selected.date}
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <User size={13} /> {selected.customer}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Header View */}
            <div className="hidden print:block mb-4">
              <h2 className="text-lg font-bold text-black">Invoice: {selected.invoiceNo}</h2>
              <p className="text-xs text-slate-600">
                Date: {selected.date} | Customer: {selected.customer}
              </p>
            </div>

            {/* Patient & Doctor metadata if available */}
            {(selected.patientName || selected.prescriberName || selected.prescriptionReference) && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selected.patientName && (
                  <div>
                    <span className="text-slate-500 block">Patient Name:</span>
                    <span className="text-white font-medium">{selected.patientName}</span>
                  </div>
                )}
                {selected.prescriberName && (
                  <div>
                    <span className="text-slate-500 block">Doctor / Prescriber:</span>
                    <span className="text-white font-medium">{selected.prescriberName}</span>
                  </div>
                )}
                {selected.prescriptionReference && (
                  <div>
                    <span className="text-slate-500 block">Rx Ref:</span>
                    <span className="text-white font-mono">{selected.prescriptionReference}</span>
                  </div>
                )}
              </div>
            )}

            {/* Line Items Table */}
            {selected.lines && selected.lines.length > 0 ? (
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">GST</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {selected.lines.map((l, idx) => (
                      <tr key={l.id || idx}>
                        <td className="p-2.5 font-medium text-white">{l.name}</td>
                        <td className="p-2.5 font-mono text-slate-400">{l.batch || '—'}</td>
                        <td className="p-2.5 text-right font-mono">{l.qty}</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(l.rate)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-400">{l.gst || 0}%</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-400">
                          {formatCurrency(l.amount || l.qty * l.rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Customer</span>
                  <span className="text-white font-semibold">{selected.customer}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date</span>
                  <span className="text-white font-mono">{selected.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Line Items</span>
                  <span className="text-white font-semibold">{selected.items} items</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className="capitalize font-semibold text-emerald-400">{selected.status}</span>
                </div>
              </div>
            )}

            {/* Total Summary Breakdown */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Grand Total Payable:</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {formatCurrency(selected.total)}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-800 no-print">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Printer size={14} /> Print Invoice
              </button>

              <button
                type="button"
                onClick={() => editInvoice(selected.invoiceNo)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                <Edit2 size={14} /> Edit Invoice <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
