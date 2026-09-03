import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Eye, Printer, X, Edit3, Trash2, Save, ExternalLink, PlusCircle } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PurchaseInvoicePrint, { InvoicePrintItem } from '../../components/transactions/PurchaseInvoicePrint'

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
  discount: number
  gstRate: number
  mrp?: number
  amount: number
}

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-400',
  partial: 'bg-blue-500/10 text-blue-400',
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

  // Open the in-place challan editor
  const openEditModal = (inv: PurchaseInv) => {
    setEditing(inv)
    if (inv.lines && inv.lines.length > 0) {
      setEditLines(
        inv.lines.map((l: any, idx: number) => {
          const qty = Number(l.qty || l.quantity || 1)
          const rate = Number(l.rate || l.purchaseRate || 0)
          const disc = Number(l.disc || l.discount || 0)
          const gst = Number(l.gst || l.gstRate || 12)
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
            mrp: Number(l.mrp || rate * 1.35),
            amount: Math.round(amt * 100) / 100,
          }
        })
      )
    } else {
      // Create fallback item from total
      const rate = inv.total ? Math.round((inv.total / 1.12) * 100) / 100 : 1000
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
          gstRate: 12,
          amount: inv.total || 1120,
        },
      ])
    }
  }

  const updateLine = (idx: number, field: keyof EditableLine, val: any) => {
    setEditLines((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], [field]: val }

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
        gstRate: 12,
        amount: 1120,
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
        mrp: l.mrp,
      })),
    }

    try {
      try {
        await patchErp('purchases', editing.id, payload)
      } catch {
        await postErp('purchases', payload)
      }

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
            mfr: l.manufacturer || l.mfr || 'CONCEP',
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
              mfr: 'CONCEP',
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
    <div className="p-6 space-y-4">
      {/* Screen Controls & Register Table */}
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Register</h1>
            <p className="text-sm text-slate-400 mt-1">
              {filtered.length} challans | Total: {formatCurrency(totalVal)}
            </p>
          </div>
          <a
            href="/transactions/purchase/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
          >
            <Plus size={16} /> New Purchase
          </a>
        </div>
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by challan or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500"
          />
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
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-mono">
                    <button
                      onClick={() => openEditModal(s)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline text-left cursor-pointer"
                      title="Click to modify challan"
                    >
                      {s.challanNo}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{s.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                  <td className="px-4 py-3 text-right">{s.items}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold capitalize',
                        STATUS_STYLE[s.status] || STATUS_STYLE.received
                      )}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5 items-center">
                      <button
                        aria-label={`Modify ${s.challanNo}`}
                        onClick={() => openEditModal(s)}
                        className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition cursor-pointer"
                        title="Modify Challan"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        aria-label={`View ${s.challanNo}`}
                        onClick={() => setSelected(s)}
                        className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="View Goods Receipt Note"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        aria-label={`Print ${s.challanNo}`}
                        onClick={() => handlePrint(s)}
                        className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Print Goods Receipt Note"
                      >
                        <Printer size={15} />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Edit3 size={18} />
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white">Modify Purchase Challan</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Challan No: <span className="text-white font-mono font-bold">{editing.challanNo}</span> | ID: {editing.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/transactions/purchase/edit/${encodeURIComponent(editing.challanNo)}`)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
                  title="Open full-page purchase entry editor"
                >
                  <ExternalLink size={13} /> Full Screen
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Top metadata fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase text-[10px]">Supplier Name</label>
                <input
                  type="text"
                  value={editing.supplier}
                  onChange={(e) => setEditing({ ...editing, supplier: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-white font-medium focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase text-[10px]">Supplier Invoice No</label>
                <input
                  type="text"
                  value={editing.invoiceNo}
                  onChange={(e) => setEditing({ ...editing, invoiceNo: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-white font-mono focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase text-[10px]">Invoice / Challan Date</label>
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase text-[10px]">Challan Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 outline-none capitalize"
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
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Challan Goods ({editLines.length} items)
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition"
                >
                  <PlusCircle size={13} /> Add Line Item
                </button>
              </div>
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/40">
                <table className="w-full text-xs min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="text-left px-3 py-2 w-48">Item Description</th>
                      <th className="text-left px-2 py-2 w-20">Batch</th>
                      <th className="text-left px-2 py-2 w-16">Expiry</th>
                      <th className="text-right px-2 py-2 w-16">Qty</th>
                      <th className="text-right px-2 py-2 w-16">Free</th>
                      <th className="text-right px-2 py-2 w-20">Rate (₹)</th>
                      <th className="text-right px-2 py-2 w-16">Disc %</th>
                      <th className="text-right px-2 py-2 w-16">GST %</th>
                      <th className="text-right px-3 py-2 w-24">Amount (₹)</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {editLines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-slate-900/40">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={line.name}
                            onChange={(e) => updateLine(idx, 'name', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-white font-medium outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            value={line.batch}
                            onChange={(e) => updateLine(idx, 'batch', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono outline-none focus:border-indigo-500 uppercase"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            value={line.expiry}
                            onChange={(e) => updateLine(idx, 'expiry', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-white text-right font-mono outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="number"
                            value={line.freeQty}
                            onChange={(e) => updateLine(idx, 'freeQty', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 text-right font-mono outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-white text-right font-mono outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={line.discount}
                            onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 text-right font-mono outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <select
                            value={line.gstRate}
                            onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                            className="w-full px-1 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 text-right font-mono outline-none focus:border-indigo-500"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-emerald-400">
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-slate-500 hover:text-rose-400 transition"
                            title="Remove Line"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom calculation summary & actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <div>
                  Subtotal: <span className="font-mono text-white font-semibold">{formatCurrency(editSubtotal)}</span>
                </div>
                <div>
                  Tax (GST): <span className="font-mono text-white font-semibold">{formatCurrency(editTaxTotal)}</span>
                </div>
                <div>
                  Grand Total:{' '}
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {formatCurrency(editGrandTotal)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChallan}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Goods Receipt Note / Purchase Invoice</h2>
                <p className="text-xs text-slate-400">
                  Challan: <span className="text-white font-mono">{selected.challanNo}</span> | Date:{' '}
                  <span className="text-white">{selected.date}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selected
                    setSelected(null)
                    openEditModal(toEdit)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer"
                  title="Modify this challan"
                >
                  <Edit3 size={14} />
                  <span>Modify</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-950 border border-neutral-700 hover:border-neutral-500 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Printer size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                  <span>Print Invoice</span>
                  <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-zinc-400 bg-white/10 rounded border border-white/10">
                    Ctrl+P
                  </kbd>
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
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
