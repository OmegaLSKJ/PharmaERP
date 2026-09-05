import { useState, useEffect } from 'react'
import { Search, Plus, Printer, Eye, X } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'

interface Order { id: string; orderNo: string; date: string; party: string; type: string; items: number; total: number; deliveryDate: string; status: string }

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400', confirmed: 'bg-blue-500/10 text-blue-400',
  dispatched: 'bg-purple-500/10 text-purple-400', delivered: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-rose-500/10 text-rose-400',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [showForm, setShowForm] = useState(false)
  const [orderType, setOrderType] = useState('Sale')
  const [party, setParty] = useState('')
  const [items, setItems] = useState(1)
  const [total, setTotal] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const showToast = useUIStore((s) => s.showToast)
  const load = () => getErp<any[]>('orders').then((rows) => setOrders(rows.map((row) => ({ id:row.id, orderNo:row.number, date:row.date, party:row.party, type:row.type ?? 'Sale', items:Number(row.items ?? 0), total:Number(row.total), deliveryDate:row.deliveryDate ?? '', status:row.status })))).catch((e) => showToast(e.message))
  useEffect(() => { void load() }, [showToast])
  const filtered = orders.filter(o => {
    const ms = o.party.toLowerCase().includes(search.toLowerCase()) || o.orderNo.toLowerCase().includes(search.toLowerCase())
    return ms && (typeFilter === 'all' || o.type === typeFilter) && (statusFilter === 'all' || o.status === statusFilter)
  })
  const saveOrder = async (e: React.FormEvent) => { e.preventDefault(); try { await postErp('orders', { party, partyType:orderType === 'Purchase' ? 'supplier' : 'customer', type:orderType, items, total, deliveryDate, status:'pending' }); setShowForm(false); setParty(''); setTotal(0); await load(); showToast('Order saved.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save order.') } }

  const getPrintDataForOrder = (o: Order): TaxInvoicePrintData => ({
    title: o.type === 'Purchase' ? 'PURCHASE ORDER' : 'SALES ORDER',
    copyType: 'Official Document',
    invoiceNo: o.orderNo,
    invoiceDate: o.date,
    paymentMode: 'ON ACCOUNT',
    buyer: {
      name: o.party,
      address: `${o.type === 'Purchase' ? 'Vendor / Supplier' : 'Customer'} Account`,
    },
    items: [
      {
        name: `Order for Pharmaceutical Stock (${o.items || 1} Item lines)`,
        packing: 'BULK',
        qty: o.items || 1,
        rate: o.total,
        gstRate: 12,
        amount: o.total,
      },
    ],
    grandTotal: o.total,
  })

  return (
    <div className="p-6 space-y-4">
      {/* Screen Interactive UI (Hidden during print) */}
      <div className="no-print space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Orders</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} orders</p>
        </div>
        <button onClick={() => setShowForm(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md active:scale-[0.98] transition cursor-pointer">
          <Plus size={16} /> New Order
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        {['all', 'Sale', 'Purchase'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition', typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{t === 'all' ? 'All' : t}</button>
        ))}
        {['all', 'pending', 'confirmed', 'dispatched', 'delivered'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition', statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white')}>{s}</button>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[700px] w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Order No</th>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-left px-4 py-3 font-medium">Party</th>
            <th className="text-right px-4 py-3 font-medium">Items</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-left px-4 py-3 font-medium">Delivery</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-center px-4 py-3 font-medium w-24">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-mono text-white">{o.orderNo}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{o.date}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', o.type === 'Sale' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400')}>{o.type}</span></td>
                <td className="px-4 py-3 font-medium text-white">{o.party}</td>
                <td className="px-4 py-3 text-right">{o.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatCurrency(o.total)}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{o.deliveryDate}</td>
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[o.status])}>{o.status}</span></td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="View & Print Order"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(o)
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
      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><form onSubmit={saveOrder} className="glass-surface w-full max-w-lg space-y-4 rounded-xl p-6"><div className="flex justify-between"><h2 className="text-lg font-semibold">New order</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><label className="grid gap-1 text-sm">Order type<select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="rounded-lg border border-input bg-background p-2"><option>Sale</option><option>Purchase</option></select></label><label className="grid gap-1 text-sm">Party<input required autoFocus value={party} onChange={(e) => setParty(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Delivery date<input required type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="rounded-lg border border-input bg-background p-2" /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Items<input type="number" min="1" value={items} onChange={(e) => setItems(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label><label className="grid gap-1 text-sm">Order value<input type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-lg border border-input bg-background p-2" /></label></div><button className="w-full h-11 px-4 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 font-semibold text-white shadow-md active:scale-[0.98] transition cursor-pointer">Save order</button></form></div>}
      </div>

      {/* Order Print Preview Modal */}
      {selectedOrder && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  {selectedOrder.type === 'Purchase' ? 'Purchase Order Preview' : 'Sales Order Preview'}
                </h2>
                <p className="text-xs text-slate-400">
                  Order No: <span className="text-white font-mono">{selectedOrder.orderNo}</span> | Date:{' '}
                  <span className="text-white">{selectedOrder.date}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-950 border border-neutral-700 hover:border-neutral-500 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Printer size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                  <span>Print Order</span>
                  <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-zinc-400 bg-white/10 rounded border border-white/10">
                    Ctrl+P
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto">
              <TaxInvoicePrint data={getPrintDataForOrder(selectedOrder)} />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {selectedOrder && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint data={getPrintDataForOrder(selectedOrder)} />
        </div>
      )}
    </div>
  )
}
