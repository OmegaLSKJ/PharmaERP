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
  ArrowRight,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'
import { getGstRateForHsn } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'

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
  manufacturer?: string
  packing?: string
  hsn?: string
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
  paymentMode?: string
  dueDate?: string
  orderNo?: string
  partyAddress?: string
  partyCity?: string
  partyState?: string
  partyPincode?: string
  partyPhone?: string
  partyGstin?: string
  partyDlNo?: string
  partyPan?: string
}

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  posted: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  pending: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs',
  overdue: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold shadow-2xs',
  partial: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold shadow-2xs',
  draft: 'bg-muted text-muted-foreground border border-border font-semibold shadow-2xs',
  cancelled: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold shadow-2xs'
}

export default function SaleRegister() {
  const [sales, setSales] = useState<SaleInv[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [selected, setSelected] = useState<SaleInv | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const addToast = useUIStore((s) => s.addToast)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getErp<any[]>('sales'),
      getErp<any[]>('parties').catch(() => [])
    ])
      .then(([rows, partyRows]) => {
        setParties(partyRows || [])
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
            prescriptionReference: row.prescriptionReference || row.prescription_reference || '',
            paymentMode: row.paymentMode || row.payment_mode || 'Credit',
            dueDate: row.dueDate || row.due_date || '',
            orderNo: row.orderNo || row.order_no || '',
            partyAddress: row.partyAddress || row.address || '',
            partyCity: row.partyCity || row.city || '',
            partyState: row.partyState || row.state || 'Assam',
            partyPincode: row.partyPincode || row.pincode || row.pin || '',
            partyPhone: row.partyPhone || row.phone || row.mobile || '',
            partyGstin: row.partyGstin || row.gstin || '',
            partyDlNo: row.partyDlNo || row.dlNo || row.dlNumber || '',
            partyPan: row.partyPan || row.pan || ''
          }))
        )
      })
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
    openTransactionWindow(`/transactions/sale/edit/${encodeURIComponent(invoiceNo)}`)
  }

  const cancelInvoice = async (sale: SaleInv, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (sale.status === 'cancelled') return
    if (!window.confirm(`Cancel ${sale.invoiceNo}? Stock and accounting postings will be reversed and the audit record retained.`)) return
    try {
      await deleteErp('sales', sale.id)
      setSales((rows) => rows.map((row) => row.id === sale.id ? { ...row, status: 'cancelled' } : row))
      setSelected((current) => current?.id === sale.id ? { ...current, status: 'cancelled' } : current)
      addToast(`${sale.invoiceNo} cancelled and reversed.`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel invoice.', 'error')
    }
  }

  const getPrintDataForSelected = (s: SaleInv): TaxInvoicePrintData => {
    const custClean = (s.customer || '').trim().toLowerCase()
    const party = parties.find((p) => {
      const pName = (p.name || '').trim().toLowerCase()
      return pName === custClean || (p.id && (p.id === s.customer || p.id === (s as any).partyId))
    }) || {}

    const buyerName = s.customer || party.name || 'CASH CUSTOMER / WALK-IN'
    const buyerAddress = party.address || party.address1 || party.station || s.partyAddress || 'Local'
    const buyerCity = party.city || party.station || s.partyCity || ''
    const buyerState = party.state || s.partyState || 'Assam'
    const buyerPincode = party.pincode || party.pin || s.partyPincode || ''
    const buyerPhone = party.phone || party.mobile || s.partyPhone || ''
    const buyerGstin = party.gstin || s.partyGstin || ''
    const buyerDlNo = party.dlNo || party.dlNumber || s.partyDlNo || ''
    const buyerPan = party.pan || s.partyPan || ''
    const stateCode = party.stateCode || (buyerState.toLowerCase().includes('assam') ? '18' : '')

    return {
      title: 'TAX INVOICE',
      copyType: 'Original for Recipient',
      invoiceNo: s.invoiceNo,
      invoiceDate: s.date,
      dueDate: s.dueDate || '',
      paymentMode: s.paymentMode || 'Credit',
      orderNo: s.orderNo || '',
      patientName: s.patientName,
      prescriberName: s.prescriberName,
      prescriptionReference: s.prescriptionReference,
      buyer: {
        name: buyerName,
        address: buyerAddress,
        city: buyerCity,
        state: buyerState,
        pincode: buyerPincode,
        phone: buyerPhone,
        gstin: buyerGstin,
        dlNo: buyerDlNo,
        pan: buyerPan,
        stateCode: stateCode,
      },
      items:
        s.lines && s.lines.length > 0
          ? s.lines.map((l: any, i: number) => {
              const qty = Number(l.qty ?? l.quantity ?? 0)
              const freeQty = Number(l.freeQty ?? l.free ?? 0)
              const rate = Number(l.rate || 0)
              const mrp = Number(l.mrp || (rate > 0 ? rate * 1.2 : 0))
              const discount = Number(l.discount ?? l.disc ?? 0)
              const gstRate = Number(l.gstRate ?? l.gst ?? getGstRateForHsn(l.hsn))
              const lineTaxable = (qty * rate) - ((qty * rate) * (discount / 100))
              return {
                name: l.name || l.itemName || 'Item',
                packing: l.packing || '1x10',
                mfr: l.manufacturer || l.mfr || '',
                hsn: l.hsn || '3004',
                batch: l.batch || 'BAT-00' + (i + 1),
                expiry: l.expiry || '',
                qty,
                freeQty,
                mrp,
                rate,
                discount,
                gstRate,
                amount: lineTaxable,
              }
            })
          : [
              {
                name: 'Pharmaceutical Supplies & Medicines',
                packing: '1x10',
                mfr: '',
                hsn: '3004',
                batch: 'GEN-' + s.invoiceNo,
                expiry: '',
                qty: s.items || 1,
                freeQty: 0,
                mrp: s.total / Math.max(1, s.items || 1),
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Sale Register</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {filtered.length} Invoices
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tap on any invoice to view details or click edit &bull; Total Value:{' '}
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{formatCurrency(totalVal)}</span>
          </p>
        </div>
        <a
          href="/transactions/sale/new"
          target="_blank"
          rel="noopener noreferrer"
          title="New Sale (opens in new window)"
          className="inline-flex h-9 items-center justify-center text-center gap-2 w-full sm:w-auto px-3.5 sm:px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all duration-150"
        >
          <Plus size={15} className="shrink-0" />
          <span className="leading-none text-center">New Sale</span>
        </a>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex rounded-lg border border-border overflow-x-auto text-xs bg-muted/50 p-0.5 max-w-full">
          {['all', 'paid', 'posted', 'pending', 'overdue', 'partial', 'draft'].map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={cn(
                'px-3 py-1 font-medium capitalize transition rounded-md whitespace-nowrap shrink-0 cursor-pointer',
                statusFilter === t
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <table className="min-w-[700px] w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
              <th className="text-left px-4 py-3 font-semibold">Invoice No</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Customer</th>
              <th className="text-right px-4 py-3 font-semibold">Items</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading sale register…
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr
                  key={s.invoiceNo}
                  onClick={() => openInvoice(s)}
                  className="hover:bg-muted/40 cursor-pointer transition-colors group"
                  title="Click to view & edit invoice"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-700 dark:text-indigo-400 group-hover:underline flex items-center gap-1.5">
                    <FileText size={13} className="text-muted-foreground group-hover:text-primary" />
                    {s.invoiceNo}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-foreground group-hover:underline">{s.customer}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.items}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(s.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize', STATUS_STYLE[s.status] || STATUS_STYLE.posted)}>
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
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        aria-label={`Edit ${s.invoiceNo}`}
                        onClick={(e) => editInvoice(s.invoiceNo, e)}
                        title="Edit Invoice"
                        className="p-1.5 hover:text-amber-600 dark:hover:text-amber-400 text-muted-foreground hover:bg-muted rounded transition flex items-center gap-1"
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
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        aria-label={`Cancel ${s.invoiceNo}`}
                        onClick={(e) => cancelInvoice(s, e)}
                        disabled={s.status === 'cancelled'}
                        title="Cancel and reverse invoice"
                        className="p-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-muted rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
          className="no-print fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print border-b border-border pb-3">
              <div className="flex-1 min-w-0 pr-8 sm:pr-0 relative">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl font-bold text-foreground font-mono">{selected.invoiceNo}</h2>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold capitalize',
                      STATUS_STYLE[selected.status] || STATUS_STYLE.posted
                    )}
                  >
                    {selected.status}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Tax invoice bill preview &bull; Ready for A4 print or export to PDF
                </p>
                {/* Mobile top-right close X */}
                <button
                  onClick={() => setSelected(null)}
                  className="sm:hidden absolute top-0 right-0 p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-muted transition"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => editInvoice(selected.invoiceNo)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-foreground bg-secondary hover:bg-secondary/80 border border-border shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  title="Open and edit invoice in new window"
                >
                  <ExternalLink size={13} />
                  <span>Edit in New Window</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Bill</span>
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-primary-foreground/80 bg-black/20 dark:bg-white/20 rounded border border-primary-foreground/20">
                    Ctrl+P
                  </kbd>
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="hidden sm:inline-flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto text-slate-900">
              <TaxInvoicePrint data={getPrintDataForSelected(selected)} />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-border no-print">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => editInvoice(selected.invoiceNo)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Edit2 size={14} /> Edit Invoice <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => cancelInvoice(selected)}
                disabled={selected.status === 'cancelled'}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition"
              >
                <Trash2 size={14} /> Cancel Invoice
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
