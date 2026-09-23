import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Eye, Printer, X, Edit3, Trash2, Save, ExternalLink, PlusCircle } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp, patchErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PurchaseInvoicePrint, { InvoicePrintItem } from '../../components/transactions/PurchaseInvoicePrint'
import { getGstRateForHsn, getAllHsnCodes } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'

interface PurchaseInv {
  id: string
  challanNo: string
  invoiceNo: string
  date: string
  supplier: string
  items: number
  total: number
  status: string
  lines?: any[]
  buyerDetails?: any
}

interface EditableLine {
  id: string
  name: string
  packing?: string
  mfr?: string
  hsn?: string
  batch: string
  expiry: string
  qty: number
  freeQty: number
  rate: number
  saleRate?: number
  mrp?: number
  discount: number
  gstRate: number
  amount: number
}

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  pending: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs',
  partial: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold shadow-2xs',
  cancelled: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold shadow-2xs',
}

export default function PurchaseRegister() {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<PurchaseInv[]>([])
  const [selected, setSelected] = useState<PurchaseInv | null>(null)
  const [editing, setEditing] = useState<PurchaseInv | null>(null)
  const [editLines, setEditLines] = useState<EditableLine[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [partiesMap, setPartiesMap] = useState<Record<string, any>>({})
  const addToast = useUIStore((s) => s.addToast)

  useEffect(() => {
    Promise.all([
      getErp<any[]>('purchases'),
      getErp<any[]>('parties').catch(() => [])
    ])
      .then(([rows, parties]) => {
        const pMap: Record<string, any> = {}
        if (Array.isArray(parties)) {
          parties.forEach((p) => {
            if (p.name) pMap[p.name.toLowerCase()] = p
          })
        }
        setPartiesMap(pMap)

        setPurchases(
          rows.map((row) => ({
            id: row.dbId || row.id,
            challanNo: row.id || row.number || 'P000045',
            invoiceNo: row.supplierInvoice || row.invoiceNo || row.id,
            date: row.date,
            supplier: row.party,
            items: row.items || row.lines?.length || 1,
            total: row.total,
            status: row.status || 'received',
            lines: row.lines || [],
          }))
        )
      })
      .catch((e) => addToast(e.message, 'error'))
  }, [addToast])

  const filtered = purchases.filter(
    (s) =>
      s.supplier.toLowerCase().includes(search.toLowerCase()) ||
      s.challanNo.toLowerCase().includes(search.toLowerCase()) ||
      s.invoiceNo.toLowerCase().includes(search.toLowerCase())
  )
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  const handlePrint = (inv: PurchaseInv) => {
    setSelected(inv)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const cancelPurchase = async (invoice: PurchaseInv) => {
    if (invoice.status === 'cancelled') return
    if (!window.confirm(`Cancel ${invoice.challanNo}? Stock and accounting postings will be reversed.`)) return
    try {
      await deleteErp('purchases', invoice.id)
      setPurchases((rows) => rows.map((row) => row.id === invoice.id ? { ...row, status: 'cancelled' } : row))
      setSelected((current) => current?.id === invoice.id ? { ...current, status: 'cancelled' } : current)
      addToast(`${invoice.challanNo} cancelled and reversed.`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel purchase.', 'error')
    }
  }

  // Open the in-place challan editor
  const openEditModal = (inv: PurchaseInv) => {
    setEditing(inv)
    if (inv.lines && inv.lines.length > 0) {
      setEditLines(
        inv.lines.map((l: any, idx: number) => {
          const qty = Number(l.qty || l.quantity || 1)
          const rate = Number(l.rate || l.purchaseRate || 0)
          const disc = Number(l.disc || l.discount || 0)
          const gst = Number(l.gst ?? l.gstRate ?? getGstRateForHsn(l.hsn))
          const base = qty * rate
          const afterDisc = base - (base * disc) / 100
          const amt = Number(l.amount) || afterDisc + (afterDisc * gst) / 100
          return {
            id: String(l.id || `line-${Date.now()}-${idx}`),
            name: l.name || l.itemName || 'ITEM',
            packing: l.packing || '10T',
            mfr: l.manufacturer || l.mfr || '',
            hsn: l.hsn || '3004',
            batch: l.batch || 'BATCH1',
            expiry: l.expiry || '12/28',
            qty,
            freeQty: Number(l.free || l.freeQty || 0),
            rate,
            discount: disc,
            gstRate: gst,
            saleRate: Number(l.saleRate || rate * 1.2),
            mrp: Number(l.mrp || rate * 1.35),
            amount: Math.round(amt * 100) / 100,
          }
        })
      )
    } else {
      // Create fallback item from total
      const rate = inv.total ? Math.round((inv.total / 1.05) * 100) / 100 : 1000
      setEditLines([
        {
          id: `line-${Date.now()}-0`,
          name: 'PHARMA GOODS (CHALLAN ITEM)',
          packing: '10T',
          hsn: '3004',
          batch: 'BATCH01',
          expiry: '12/28',
          qty: 1,
          freeQty: 0,
          rate,
          discount: 0,
          gstRate: 5,
          saleRate: Math.round(rate * 1.2 * 100) / 100,
          mrp: Math.round(rate * 1.35 * 100) / 100,
          amount: inv.total || 1050,
        },
      ])
    }
  }

  const updateLine = (idx: number, field: keyof EditableLine, val: any) => {
    setEditLines((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], [field]: val }

      if (field === 'hsn') {
        current.gstRate = getGstRateForHsn(val)
      }

      // Auto recalculate amount when quantity, rate, discount, or gst changes
      const q = Number(field === 'qty' ? val : current.qty || 0)
      const r = Number(field === 'rate' ? val : current.rate || 0)
      const d = Number(field === 'discount' ? val : current.discount || 0)
      const g = Number(field === 'gstRate' ? val : current.gstRate || 0)

      const base = q * r
      const afterDisc = base - (base * d) / 100
      const totalAmt = afterDisc + (afterDisc * g) / 100

      current.amount = Math.round(totalAmt * 100) / 100
      updated[idx] = current
      return updated
    })
  }

  const addLine = () => {
    setEditLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length}`,
        name: 'NEW MEDICINE ITEM',
        packing: '10T',
        hsn: '3004',
        batch: 'BT' + String(Date.now()).slice(-4),
        expiry: '12/28',
        qty: 10,
        freeQty: 0,
        rate: 100,
        discount: 0,
        gstRate: 5,
        saleRate: 120,
        mrp: 135,
        amount: 1050,
      },
    ])
  }

  const removeLine = (idx: number) => {
    if (editLines.length <= 1) {
      addToast('At least one item is required in the challan', 'error')
      return
    }
    setEditLines((prev) => prev.filter((_, i) => i !== idx))
  }

  // Calculate grand totals for modal
  const editSubtotal = editLines.reduce((acc, l) => {
    const base = Number(l.qty || 0) * Number(l.rate || 0)
    return acc + (base - (base * Number(l.discount || 0)) / 100)
  }, 0)
  const editGrandTotal = Math.round(editLines.reduce((acc, l) => acc + Number(l.amount || 0), 0) * 100) / 100
  const editTaxTotal = Math.round((editGrandTotal - editSubtotal) * 100) / 100

  // Save changes directly back to database & state
  const handleSaveChallan = async () => {
    if (!editing) return
    setIsSaving(true)

    const payload = {
      id: editing.id,
      party: editing.supplier,
      supplierInvoice: editing.invoiceNo,
      date: editing.date,
      status: editing.status,
      items: editLines.length,
      subtotal: Math.round(editSubtotal * 100) / 100,
      taxTotal: editTaxTotal,
      total: editGrandTotal,
      lines: editLines.map((l) => ({
        name: l.name,
        packing: l.packing,
        hsn: l.hsn,
        batch: l.batch,
        expiry: l.expiry,
        qty: l.qty,
        freeQty: l.freeQty,
        rate: l.rate,
        discount: l.discount,
        gstRate: l.gstRate,
        amount: l.amount,
        saleRate: Number(l.saleRate || 0),
        mrp: Number(l.mrp || 0),
      })),
    }

    try {
      await patchErp('purchases', editing.id, { ...payload, reason: `Amended purchase ${editing.challanNo}` })

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                supplier: editing.supplier,
                invoiceNo: editing.invoiceNo,
                date: editing.date,
                status: editing.status,
                items: editLines.length,
                total: editGrandTotal,
                lines: editLines,
              }
            : p
        )
      )

      addToast(`Challan ${editing.challanNo} modified successfully!`, 'success')
      setEditing(null)
      window.setTimeout(() => window.location.reload(), 400)
    } catch (e: any) {
      addToast(e.message || 'Failed to update challan', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Build print data for selected invoice
  const getPrintData = (inv: PurchaseInv) => {
    const partyInfo = partiesMap[inv.supplier.toLowerCase()] || {}
    const itemsList: InvoicePrintItem[] =
      inv.lines && inv.lines.length > 0
        ? inv.lines.map((l: any) => ({
            itemName: l.name || l.itemName || 'CUTIROSE',
            packing: l.packing || '50ML',
            mfr: l.manufacturer || l.mfr || '',
            hsn: l.hsn || '3004',
            batch: l.batch || 'CT251459',
            expiry: l.expiry || '1/28',
            qty: Number(l.qty || l.quantity || 20),
            freeQty: Number(l.free || l.freeQty || 0),
            mrp: Number(l.mrp || 97.0),
            purchaseRate: Number(l.rate || l.purchaseRate || 73.9),
            discount: Number(l.disc || l.discount || 5.0),
            scheme: Number(l.scheme || 0),
            gstRate: Number(l.gst || l.gstRate || 5.0),
            amount: Number(l.amount || 1478.0),
          }))
        : [
            {
              itemName: 'CUTIROSE',
              packing: '50ML',
              mfr: '',
              hsn: '3004',
              batch: 'CT251459',
              expiry: '1/28',
              qty: 20,
              freeQty: 0,
              mrp: 97.0,
              purchaseRate: 73.9,
              discount: 5.0,
              scheme: 0,
              gstRate: 5.0,
              amount: 1478.0,
            },
          ]

    return {
      supplier: {
        name: inv.supplier || 'M/S ASHA DRUG DISTRIBUTORS TEZPUR',
        address: partyInfo.address || 'OPP BORGANG T.E. HOSPITAL P.O. BORGANG, DIST- BISWANATH',
        gstin: partyInfo.gstin || '18ABCFS4582H1Z8',
        dlNo: partyInfo.dlNo || 'DLR-IV-41584/85',
        phone: partyInfo.phone || '9435081045',
        state: partyInfo.state || 'Assam',
        pan: partyInfo.pan || 'ABCFS4582H',
      },
      challanNo: inv.challanNo || 'PB-2026-347165',
      supplierInvoiceNo: inv.invoiceNo || 'G-86',
      date: inv.date || '2026-04-02',
      invoiceDate: inv.date || '2026-04-02',
      paymentType: 'CREDIT',
      items: itemsList,
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen Controls & Register Table */}
      <div className="no-print space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Purchase Register</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {filtered.length} challans | Total: {formatCurrency(totalVal)}
            </p>
          </div>
          <a
            href="/transactions/purchase/new"
            target="_blank"
            rel="noopener noreferrer"
            title="New Purchase (opens in new window)"
            className="inline-flex h-9 items-center justify-center gap-2 w-full sm:w-auto px-3.5 sm:px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all duration-150"
          >
            <Plus size={15} /> New Purchase
          </a>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by challan or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs transition"
          />
        </div>
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
          <table className="min-w-[700px] w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
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
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    <button
                      onClick={() => openEditModal(s)}
                      className="text-indigo-700 dark:text-indigo-400 hover:underline font-semibold text-left cursor-pointer"
                      title="Click to modify challan"
                    >
                      {s.challanNo}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.supplier}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.items}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize',
                        STATUS_STYLE[s.status] || STATUS_STYLE.received
                      )}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5 items-center">
                      <button
                        aria-label={`Open ${s.challanNo} in new window`}
                        onClick={() => openTransactionWindow(`/transactions/purchase/edit/${encodeURIComponent(s.challanNo)}`)}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-muted rounded transition cursor-pointer"
                        title="Open in New Window"
                      >
                        <ExternalLink size={15} />
                      </button>
                      <button
                        aria-label={`Modify ${s.challanNo}`}
                        onClick={() => openEditModal(s)}
                        className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-muted rounded transition cursor-pointer"
                        title="Modify Challan"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        aria-label={`View ${s.challanNo}`}
                        onClick={() => setSelected(s)}
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                        title="View Goods Receipt Note"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        aria-label={`Print ${s.challanNo}`}
                        onClick={() => handlePrint(s)}
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                        title="Print Goods Receipt Note"
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        aria-label={`Cancel ${s.challanNo}`}
                        onClick={() => cancelPurchase(s)}
                        disabled={s.status === 'cancelled'}
                        className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Cancel and reverse purchase"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-Place Challan Modifier Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 no-print overflow-y-auto backdrop-blur-xs"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-5xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                    <Edit3 size={18} />
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">Modify Purchase Challan</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Challan No: <span className="text-foreground font-mono font-bold">{editing.challanNo}</span> | ID: {editing.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTransactionWindow(`/transactions/purchase/edit/${encodeURIComponent(editing.challanNo)}`)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg transition"
                  title="Open full-page purchase entry editor in new window"
                >
                  <ExternalLink size={13} /> Open in New Window
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Top metadata fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Supplier Name</label>
                <input
                  type="text"
                  value={editing.supplier}
                  onChange={(e) => setEditing({ ...editing, supplier: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-input text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Supplier Invoice No</label>
                <input
                  type="text"
                  value={editing.invoiceNo}
                  onChange={(e) => setEditing({ ...editing, invoiceNo: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-input text-foreground font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Invoice / Challan Date</label>
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-input text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Challan Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-input text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none capitalize"
                >
                  <option value="received">Received</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Challan Goods ({editLines.length} items)
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition font-medium shadow-2xs"
                >
                  <PlusCircle size={13} /> Add Line Item
                </button>
              </div>

              {/* HSN Datalist */}
              <datalist id="register-hsn-list">
                {getAllHsnCodes().map((h) => (
                  <option key={h.code} value={h.code} label={`${h.code} (${h.gstRate}% GST) - ${h.description}`}>
                    {`${h.code} (${h.gstRate}% GST) - ${h.description}`}
                  </option>
                ))}
              </datalist>

              <div className="border border-border rounded-xl overflow-x-auto bg-card shadow-xs">
                <table className="w-full text-xs min-w-[980px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-mono font-semibold">
                      <th className="text-left px-3.5 py-2.5 w-52 min-w-[180px]">Item Description</th>
                      <th className="text-left px-2 py-2.5 w-24 min-w-[90px]">Batch</th>
                      <th className="text-left px-2 py-2.5 w-20 min-w-[80px]">Expiry</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[65px]">Qty</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[65px]">Free</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[90px]">Rate (₹)</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[90px] text-primary">Sale Price</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[90px]">MRP (₹)</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[65px]">Disc %</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[65px]">GST %</th>
                      <th className="text-right px-3.5 py-2.5 w-24 min-w-[95px]">Amount (₹)</th>
                      <th className="w-10 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {editLines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-2.5 py-2">
                          <input
                            type="text"
                            value={line.name}
                            onChange={(e) => updateLine(idx, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground font-medium outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              list="register-hsn-list"
                              placeholder="HSN code"
                              value={line.hsn || ''}
                              onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                              className="w-24 px-1.5 py-0.5 text-[10px] font-mono bg-muted/60 border border-input rounded text-foreground outline-none focus:border-primary"
                              title="HSN Code (auto-calculates GST%)"
                            />
                            {line.hsn && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {getGstRateForHsn(line.hsn)}% GST
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={line.batch}
                            onChange={(e) => updateLine(idx, 'batch', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary uppercase shadow-2xs transition"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={line.expiry}
                            onChange={(e) => updateLine(idx, 'expiry', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground text-right font-mono font-bold outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            value={line.freeQty}
                            onChange={(e) => updateLine(idx, 'freeQty', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-muted-foreground text-right font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground text-right font-mono font-bold outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        {/* Sale Price */}
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.saleRate || ''}
                            onChange={(e) => updateLine(idx, 'saleRate', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2.5 py-1.5 bg-background border border-indigo-400/60 rounded-lg text-foreground text-right font-mono font-bold outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                            title="Sale Price (₹)"
                          />
                        </td>
                        {/* MRP */}
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.mrp || ''}
                            onChange={(e) => updateLine(idx, 'mrp', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground text-right font-mono font-bold outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                            title="MRP (₹)"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={line.discount}
                            onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-muted-foreground text-right font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <select
                            value={line.gstRate}
                            onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                            className="w-full px-1.5 py-1.5 bg-background border border-input rounded-lg text-foreground text-right font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-foreground">
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-muted rounded transition"
                            title="Remove Line"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom calculation summary & actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-border">
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div>
                  Subtotal: <span className="font-mono text-foreground font-semibold">{formatCurrency(editSubtotal)}</span>
                </div>
                <div>
                  Tax (GST): <span className="font-mono text-foreground font-semibold">{formatCurrency(editTaxTotal)}</span>
                </div>
                <div>
                  Grand Total:{' '}
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    {formatCurrency(editGrandTotal)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold transition border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChallan}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSaving ? 'Saving Changes...' : 'Save & Update Challan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail / Print Preview Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 no-print overflow-y-auto backdrop-blur-xs"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex-1 min-w-0 pr-8 sm:pr-0 relative">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">Goods Receipt Note / Purchase Invoice</h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>Challan: <span className="text-foreground font-mono">{selected.challanNo}</span></span>
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <span>Date: <span className="text-foreground font-mono">{selected.date}</span></span>
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
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selected
                    setSelected(null)
                    openEditModal(toEdit)
                  }}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 active:scale-[0.98] transition cursor-pointer shadow-2xs"
                  title="Modify this challan"
                >
                  <Edit3 size={14} />
                  <span>Modify</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="group inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Invoice</span>
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-primary-foreground/80 bg-black/20 dark:bg-white/20 rounded border border-primary-foreground/20">
                    Ctrl+P
                  </kbd>
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="hidden sm:inline-flex p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto text-slate-900">
              <PurchaseInvoicePrint data={getPrintData(selected)} />
            </div>
          </div>
        </div>
      )}

      {/* Print Target (Only visible when printing) */}
      {selected && (
        <div className="hidden print:block w-full">
          <PurchaseInvoicePrint data={getPrintData(selected)} />
        </div>
      )}
    </div>
  )
}
