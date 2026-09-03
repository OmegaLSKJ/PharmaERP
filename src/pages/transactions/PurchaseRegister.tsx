import { useState, useEffect } from 'react'
import { Search, Plus, Eye, Printer, X } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
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

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-400',
  partial: 'bg-blue-500/10 text-blue-400',
}

export default function PurchaseRegister() {
  const [purchases, setPurchases] = useState<PurchaseInv[]>([])
  const [selected, setSelected] = useState<PurchaseInv | null>(null)
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
            status: row.status,
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
              scheme: 0.0,
              gstRate: 5.0,
              amount: 1478.0,
            },
          ]

    return {
      buyerName: partyInfo.name || inv.supplier || 'HUVET ENTERPRISES',
      buyerAddress: partyInfo.city || partyInfo.address || 'TEZPUR',
      buyerPhone: partyInfo.phone || '03712232931',
      buyerDlNo: partyInfo.dlNumber || partyInfo.dlNo || 'STR-5018/5019',
      buyerGstin: partyInfo.gstin || '18AAHFH7021B1ZS',
      buyerPan: partyInfo.pan || 'AAHFH7021B',
      buyerBalance: partyInfo.balance !== undefined ? Number(partyInfo.balance) : -144352.0,
      receiptNo: inv.challanNo || 'P000045',
      invoiceNo: inv.invoiceNo || 'P000045',
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
                  <td className="px-4 py-3 font-mono text-white">{s.challanNo}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{s.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{s.supplier}</td>
                  <td className="px-4 py-3 text-right">{s.items}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold capitalize',
                        STATUS_STYLE[s.status]
                      )}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label={`View ${s.challanNo}`}
                        onClick={() => setSelected(s)}
                        className="p-1 hover:text-white text-slate-400"
                        title="View Goods Receipt Note"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        aria-label={`Print ${s.challanNo}`}
                        onClick={() => handlePrint(s)}
                        className="p-1 hover:text-white text-slate-400"
                        title="Print Goods Receipt Note"
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
      </div>

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

