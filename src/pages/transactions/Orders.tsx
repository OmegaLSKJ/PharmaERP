import { useState, useEffect } from 'react'
import { Search, Plus, Printer, Eye, X, CheckCircle2 } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp, patchErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'
import PrintButton from '../../components/common/PrintButton'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'

interface Order { id: string; orderNo: string; date: string; party: string; type: string; items: number; total: number; deliveryDate: string; status: string }

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  dispatched: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
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
  const load = () => getErp<any[]>('orders', undefined, { forceRefresh: true }).then((rows) => setOrders(rows.map((row) => ({ id:row.id, orderNo:row.number, date:row.date, party:row.party, type:row.type ?? 'Sale', items:Number(row.items ?? 0), total:Number(row.total), deliveryDate:row.deliveryDate ?? '', status:row.status })))).catch((e) => showToast(e.message))
  useEffect(() => { void load() }, [showToast])
  useErpAutoRefresh(['orders', 'sales'], () => load())
  const filtered = orders.filter(o => {
    const ms = o.party.toLowerCase().includes(search.toLowerCase()) || o.orderNo.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || o.type === typeFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'delivered' ? (o.status === 'delivered' || o.status === 'completed') : o.status === statusFilter)
    return ms && matchesType && matchesStatus
  })

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await patchErp('orders', orderId, { status: newStatus })
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
      setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: newStatus } : prev))
      showToast(`Order status updated to ${newStatus === 'delivered' ? 'complete (delivered)' : newStatus}.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update status.')
    }
  }

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
        gstRate: 5,
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
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-500" />
        </div>
        {['all', 'Sale', 'Purchase'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer', typeFilter === t ? 'bg-indigo-600 text-white shadow-xs' : 'bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs')}>{t === 'all' ? 'All' : t}</button>
        ))}
        {['all', 'pending', 'confirmed', 'dispatched', 'delivered'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer', statusFilter === s ? 'bg-indigo-600 text-white shadow-xs' : 'bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs')}>{s === 'delivered' ? 'Delivered / Complete' : s}</button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <table className="min-w-[860px] w-full text-xs">
          <thead><tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium min-w-[120px]">Order No</th>
            <th className="text-left px-4 py-3 font-medium min-w-[100px]">Date</th>
            <th className="text-left px-4 py-3 font-medium min-w-[80px]">Type</th>
            <th className="text-left px-4 py-3 font-medium min-w-[180px]">Party</th>
            <th className="text-right px-4 py-3 font-medium min-w-[70px]">Items</th>
            <th className="text-right px-4 py-3 font-medium min-w-[100px]">Total</th>
            <th className="text-left px-4 py-3 font-medium min-w-[110px]">Delivery</th>
            <th className="text-left px-4 py-3 font-medium min-w-[130px]">Status</th>
            <th className="text-center px-4 py-3 font-medium w-28 min-w-[100px]">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border text-foreground">
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-mono text-foreground font-medium min-w-[120px]">{o.orderNo}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground min-w-[100px]">{o.date}</td>
                <td className="px-4 py-3 min-w-[80px]"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', o.type === 'Sale' ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400' : 'bg-purple-500/10 text-purple-500 dark:text-purple-400')}>{o.type}</span></td>
                <td className="px-4 py-3 font-medium text-foreground min-w-[180px]">{o.party}</td>
                <td className="px-4 py-3 text-right min-w-[70px]">{o.items}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400 min-w-[100px] whitespace-nowrap">{formatCurrency(o.total)}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground min-w-[110px]">{o.deliveryDate}</td>
                <td className="px-4 py-3 min-w-[130px]">
                  <select
                    aria-label={`Change status of ${o.orderNo}`}
                    value={o.status === 'completed' ? 'delivered' : o.status}
                    onChange={(e) => void updateOrderStatus(o.id, e.target.value)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-semibold capitalize border bg-background outline-none cursor-pointer transition',
                      STATUS_STYLE[o.status] || 'text-foreground border-border'
                    )}
                  >
                    <option value="pending" className="bg-background text-amber-500 dark:text-amber-400">Pending</option>
                    <option value="confirmed" className="bg-background text-blue-500 dark:text-blue-400">Confirmed</option>
                    <option value="dispatched" className="bg-background text-purple-500 dark:text-purple-400">Dispatched</option>
                    <option value="delivered" className="bg-background text-emerald-500 dark:text-emerald-400">
                      {o.type === 'Purchase' ? 'Received / Complete' : 'Delivered / Complete'}
                    </option>
                    <option value="cancelled" className="bg-background text-rose-500 dark:text-rose-400">Cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center min-w-[100px]">
                  <div className="flex items-center justify-center gap-1.5">
                    {o.status !== 'delivered' && o.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => void updateOrderStatus(o.id, 'delivered')}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                        title={o.type === 'Purchase' ? 'Mark as Received (Goods Received)' : 'Mark as Complete (Delivered)'}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition cursor-pointer"
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
                      className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition border border-border shadow-xs cursor-pointer"
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
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-card border border-border text-foreground w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex-1 min-w-0 pr-8 sm:pr-0 relative">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {selectedOrder.type === 'Purchase' ? 'Purchase Order Preview' : 'Sales Order Preview'}
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>Order No: <span className="text-foreground font-mono">{selectedOrder.orderNo}</span></span>
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <span>Date: <span className="text-foreground">{selectedOrder.date}</span></span>
                </p>
                {/* Mobile top-right close X */}
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="sm:hidden absolute top-0 right-0 p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary transition cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  aria-label={`Change status of ${selectedOrder.orderNo}`}
                  value={selectedOrder.status === 'completed' ? 'delivered' : selectedOrder.status}
                  onChange={(e) => void updateOrderStatus(selectedOrder.id, e.target.value)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize border bg-background outline-none cursor-pointer transition',
                    STATUS_STYLE[selectedOrder.status] || 'text-foreground border-border'
                  )}
                >
                  <option value="pending" className="bg-background text-amber-500 dark:text-amber-400">Pending</option>
                  <option value="confirmed" className="bg-background text-blue-500 dark:text-blue-400">Confirmed</option>
                  <option value="dispatched" className="bg-background text-purple-500 dark:text-purple-400">Dispatched</option>
                  <option value="delivered" className="bg-background text-emerald-500 dark:text-emerald-400">Delivered / Complete</option>
                  <option value="cancelled" className="bg-background text-rose-500 dark:text-rose-400">Cancelled</option>
                </select>

                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => void updateOrderStatus(selectedOrder.id, 'delivered')}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition active:scale-[0.98] cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Complete</span>
                  </button>
                )}

                <PrintButton
                  label="Print Order"
                  autoOrientationHint="portrait"
                  variant="secondary"
                  kbd="Ctrl+P"
                />
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="hidden sm:inline-flex p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary transition cursor-pointer"
                  aria-label="Close dialog"
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
        <div className="hidden print:block w-full mx-auto">
          <TaxInvoicePrint data={getPrintDataForOrder(selectedOrder)} />
        </div>
      )}
    </div>
  )
}
