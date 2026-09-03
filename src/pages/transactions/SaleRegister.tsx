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
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'

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
  partial: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  draft: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  cancelled: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
          (rows || []).map((row) => ({
            id: String(row.dbId || row.id || row.number || ''),
            invoiceNo: String(row.invoiceNo || row.number || row.id || 'INV-UNNAMED'),
            date: String(row.date || row.invoice_date || ''),
            customer: String(row.party || row.customer || row.party_name || 'Cash Customer'),
            items: Number(row.items || row.lines?.length || 1),
            total: Number(row.total ?? row.grandTotal ?? row.grand_total ?? 0),
            status: String(row.status || 'posted').toLowerCase(),
            lines: row.lines || [],
            patientName: row.patientName || row.patient_name || '',
            prescriberName: row.prescriberName || row.prescriber_name || '',
            prescriptionReference: row.prescriptionReference || row.prescription_reference || ''
          }))
        )
      )
      .catch((e) => addToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [addToast])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sales.filter((s) => {
      const cust = (s.customer || '').toLowerCase()
      const inv = (s.invoiceNo || '').toLowerCase()
      const ms = !q || cust.includes(q) || inv.includes(q)
      const st = (s.status || '').toLowerCase()
      const mf = statusFilter === 'all' || st === statusFilter.toLowerCase()
      return ms && mf
    })
  }, [sales, search, statusFilter])

  const totalVal = useMemo(() => filtered.reduce((a, s) => a + (Number(s.total) || 0), 0), [filtered])

  const openInvoice = (s: SaleInv) => {
    setSelected(s)
  }

  const editInvoice = (invoiceNo: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigate(`/transactions/sale/edit/${encodeURIComponent(invoiceNo)}`)
  }

  const getPrintDataForSelected = (s: SaleInv): TaxInvoicePrintData => {
    return {
      title: 'TAX INVOICE',
      copyType: 'Original for Recipient',
      invoiceNo: s.invoiceNo,
      invoiceDate: s.date,
      dueDate: '',
      paymentMode: 'Credit',
      patientName: s.patientName,
      prescriberName: s.prescriberName,
      prescriptionReference: s.prescriptionReference,
      buyer: {
        name: s.customer,
        address: 'Assam, India',
        city: 'Local',
        state: 'Assam',
        phone: '',
        gstin: '',
        dlNo: '',
        pan: '',
      },
      items:
        s.lines && s.lines.length > 0
          ? s.lines.map((l, i) => ({
              name: l.name,
              packing: '1x10',
              mfr: 'PHARMA',
              hsn: '3004',
              batch: l.batch || 'BAT-00' + (i + 1),
              expiry: l.expiry || '',
              qty: l.qty,
              freeQty: l.free || 0,
              mrp: l.rate * 1.2,
              rate: l.rate,
              discount: l.disc || 0,
              gstRate: l.gst || 12,
              amount: l.amount || l.qty * l.rate,
            }))
          : [
              {
                name: 'Pharmaceutical Supplies & Medicines',
                packing: '1x10',
                mfr: 'GENERIC',
                hsn: '3004',
                batch: 'GEN-' + s.invoiceNo,
                expiry: '',
                qty: s.items || 1,
                rate: s.total / Math.max(1, s.items || 1),
                amount: s.total,
              },
            ],
      grandTotal: s.total,
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen Register (Hidden when printing) */}
      <div className="no-print space-y-4">
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
          {['all', 'paid', 'posted', 'pending', 'overdue', 'partial', 'draft'].map((t) => (
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
            className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between no-print border-b border-slate-800 pb-3">
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
                <p className="text-xs text-slate-400 mt-1">
                  Tax invoice bill preview &bull; Ready for A4 print or export to PDF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-neutral-900 text-white rounded-lg text-xs font-bold shadow transition border border-black cursor-pointer"
                >
                  <Printer size={14} className="text-white" /> Print Bill (Ctrl+P)
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
              <TaxInvoicePrint data={getPrintDataForSelected(selected)} />
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

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {selected && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint data={getPrintDataForSelected(selected)} />
        </div>
      )}
    </div>
  )
}
