import { useState } from 'react'
import { ShoppingCart, Trash2, Banknote, Smartphone } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import Typeahead from '../../components/ui/Typeahead'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import { Printer } from 'lucide-react'
import { getGstRateForHsn } from '../../lib/hsnUtils'

interface CounterItem {
  name: string
  rate: number
  batch: string
  stock: number
  gst: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
}

export default function CounterSale() {
  const [available, setAvailable] = useState<CounterItem[]>([])
  const [cart, setCart] = useState<Array<CounterItem & { qty: number }>>([])
  const [activeItem, setActiveItem] = useState<CounterItem | null>(null)
  const [pay, setPay] = useState<'cash'|'upi'>('cash')
  const [saving, setSaving] = useState(false)
  const [completedSale, setCompletedSale] = useState<{
    invoiceNo: string
    date: string
    lines: Array<{ name: string; qty: number; rate: number; batch: string; stock: number; gst: number; manufacturer?: string; packing?: string; hsn?: string }>
    total: number
    paymentMode: string
  } | null>(null)
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  const loadItems = (force = false) => {
    getErp<any[]>('items', undefined, force ? { forceRefresh: true } : undefined)
      .then((items) => {
        const mapped = items.flatMap((item) =>
          (item.batches ?? []).filter((b: any) => b.stock > 0).map((b: any) => ({
            name: item.name,
            rate: item.saleRate,
            batch: b.batch,
            stock: b.stock,
            gst: item.gstRate !== undefined && item.gstRate !== null ? Number(item.gstRate) : getGstRateForHsn(item.hsn),
            mrp: b.mrp || item.mrp || 0,
            purchaseRate: b.purchaseRate || item.purchaseRate || 0,
            packing: item.packing || '',
            manufacturer: item.manufacturer || item.company || '',
            salt: item.salt || item.composition || '',
            hsn: item.hsn || '',
            expiry: b.expiry || '',
          }))
        )
        setAvailable(mapped)
        if (mapped.length > 0) setActiveItem(mapped[0])
      })
      .catch((e) => showToast(e.message))
  }

  useEffect(() => {
    loadItems(false)
  }, [showToast])

  const add = (i: CounterItem) => {
    setActiveItem(i)
    const ex = cart.find((c) => c.name === i.name && c.batch === i.batch)
    if (ex) setCart(cart.map((c) => (c.name === i.name && c.batch === i.batch ? { ...c, qty: Math.min(c.qty + 1, c.stock) } : c)))
    else setCart([...cart, { ...i, qty: 1 }])
  }
  const total = cart.reduce((a,c)=>a+c.qty*c.rate,0)
  const complete = async () => {
    setSaving(true)
    try {
      const invoice = await postErp<{ id: string }>('sales', {
        party: 'Walk-in Customer',
        total,
        paymentMode: pay,
        lines: cart.map((line) => ({
          ...line,
          freeQty: 0,
          discount: 0,
          gstRate: line.gst,
          amount: line.qty * line.rate,
        })),
      })
      const saleData = {
        invoiceNo: invoice.id || `CS-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        lines: [...cart],
        total,
        paymentMode: pay,
      }
      setCompletedSale(saleData)
      showToast(`Counter invoice ${saleData.invoiceNo} posted.`)
      incrementLedgerVersion()
      setCart([])
      loadItems(true)
      setTimeout(() => window.print(), 100)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to complete counter sale.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <div className="no-print p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-3">
        <PrintHeader title="Counter Sale Receipt" />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Counter Sale (POS)</h1>
          <p className="text-sm text-slate-400 mt-1">Walk-in customer | Quick billing</p></div>
        
        <div className="relative z-20 bg-slate-900/40 p-4 border border-slate-800 rounded-xl space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Search & Add Medicine</label>
          <Typeahead
            options={available.map(i => ({
              label: i.name,
              sub: `${i.manufacturer ? '[' + i.manufacturer + '] ' : ''}${i.packing ? i.packing + ' • ' : ''}Batch: ${i.batch} | Stock: ${i.stock}`,
              right: formatCurrency(i.rate)
            }))}
            value=""
            onSelect={(opt) => {
              const selectedItem = available.find(i => i.name === opt.label && `${i.manufacturer ? '[' + i.manufacturer + '] ' : ''}${i.packing ? i.packing + ' • ' : ''}Batch: ${i.batch} | Stock: ${i.stock}` === opt.sub)
              if (selectedItem) add(selectedItem)
            }}
            placeholder="Search medicine name to add..."
          />
        </div>

        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">Quick Add Items</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {available.map((i) => {
            const isSelected = activeItem?.name === i.name && activeItem?.batch === i.batch
            return (
              <button
                key={`${i.name}-${i.batch}`}
                onClick={() => add(i)}
                className={cn(
                  'bg-slate-900/50 border rounded-xl p-3.5 text-left transition cursor-pointer',
                  isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-indigo-950/30' : 'border-slate-800 hover:border-indigo-500'
                )}
              >
                <div className="text-sm font-medium text-white truncate">{i.name}</div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>{formatCurrency(i.rate)}</span>
                  <span className="text-[10px] font-mono text-amber-400">{i.batch}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Marg ERP Active Product Description & Margin Panel */}
        <ActiveProductDetailPanel
          activeProduct={
            activeItem
              ? {
                  name: activeItem.name,
                  packing: activeItem.packing,
                  manufacturer: activeItem.manufacturer,
                  salt: activeItem.salt,
                  hsn: activeItem.hsn,
                  gstRate: activeItem.gst,
                  batch: activeItem.batch,
                  expiry: activeItem.expiry,
                  stock: activeItem.stock,
                  saleRate: activeItem.rate,
                  mrp: activeItem.mrp,
                  purchaseRate: activeItem.purchaseRate,
                  refNo: 'POS-COUNTER',
                  date: new Date().toISOString().split('T')[0],
                }
              : null
          }
          billSummary={{
            title: 'Counter Total',
            partyLabel: 'Customer',
            partyName: 'Walk-in Retail Customer',
            valueOfGoods: total,
            grandTotal: total,
          }}
          emptyMessage="Select or tap any medicine to inspect live batch, warehouse stock, rates, composition and margins."
        />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShoppingCart size={16} className="text-indigo-400"/>Cart ({cart.reduce((a,c)=>a+c.qty,0)})</div>
        {cart.length===0 ? <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Tap items to add</div> :
          <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-[calc(100vh-320px)] space-y-1 pr-1">
            {cart.map((c) => {
              const isSelected = activeItem?.name === c.name && activeItem?.batch === c.batch
              return (
                <div
                  key={`${c.name}-${c.batch}`}
                  onClick={() => setActiveItem(c)}
                  className={cn(
                    'flex items-center justify-between text-sm py-1.5 px-2 rounded-lg border-b border-slate-800/50 cursor-pointer transition',
                    isSelected ? 'bg-indigo-950/40 text-white' : 'hover:bg-slate-800/20'
                  )}
                >
                  <span className="text-slate-300 truncate max-w-[120px] sm:max-w-none">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={(e)=>{ e.stopPropagation(); setCart(cart.map(x=>x.name===c.name&&x.batch===c.batch&&x.qty>1?{...x,qty:x.qty-1}:x.name===c.name&&x.batch===c.batch?{...x,qty:0}:x).filter((x)=>x.qty>0)) }} className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">-</button>
                    <span className="font-mono w-6 text-center text-white">{c.qty}</span>
                    <button onClick={(e)=>{ e.stopPropagation(); setCart(cart.map(x=>x.name===c.name&&x.batch===c.batch?{...x,qty:Math.min(x.qty+1,x.stock)}:x)) }} className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">+</button>
                    <span className="font-mono w-14 text-right text-emerald-400">{formatCurrency(c.qty*c.rate)}</span>
                    <button onClick={(e)=>{ e.stopPropagation(); setCart(cart.filter(x=>!(x.name===c.name&&x.batch===c.batch))) }} className="p-0.5 text-slate-500 hover:text-rose-400"><Trash2 size={12}/></button>
                  </div>
                </div>
              )
            })}
          </div>
        }
        <div className="mt-auto pt-3 border-t border-slate-700 space-y-3">
          <div className="flex justify-between text-xl font-bold"><span className="text-white">Total</span><span className="font-mono text-emerald-400">{formatCurrency(total)}</span></div>
          <div className="flex rounded-lg border border-slate-800 overflow-hidden p-0.5 bg-slate-950/60">
            <button onClick={()=>setPay('cash')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition active:scale-[0.98]',pay==='cash'?'bg-emerald-600 text-white shadow-sm':'text-slate-400 hover:text-white')}><Banknote size={14}/>Cash</button>
            <button onClick={()=>setPay('upi')} className={cn('flex-1 h-9 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition active:scale-[0.98]',pay==='upi'?'bg-indigo-600 text-white shadow-sm':'text-slate-400 hover:text-white')}><Smartphone size={14}/>UPI</button>
          </div>

          {pay === 'upi' && total > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center space-y-2.5">
              <div className="text-xs font-semibold text-indigo-400">Scan to Pay via UPI</div>
              <div className="bg-white p-2.5 rounded-lg inline-block shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                    `upi://pay?pa=pay@borgang.upi&pn=Borgang%20Drug%20Distributors&am=${total.toFixed(2)}&cu=INR&tn=POS-Payment`
                  )}`}
                  alt="UPI Payment QR Code"
                  className="w-[140px] h-[140px] object-contain"
                />
              </div>
              <div className="text-[10px] text-slate-400">
                Locked Amount: <span className="font-mono font-bold text-white">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <button onClick={complete} disabled={cart.length===0 || saving} className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] transition-all cursor-pointer">{saving ? 'Posting…' : 'Print Bill & Complete'}</button>

          {completedSale && (
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full h-10 px-4 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition border border-neutral-700 shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Printer size={14} className="text-zinc-300" /> Reprint Last Bill ({completedSale.invoiceNo})
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {completedSale && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint
            data={{
              title: 'RETAIL CASH MEMO',
              copyType: 'Original for Customer',
              invoiceNo: completedSale.invoiceNo,
              invoiceDate: completedSale.date,
              paymentMode: completedSale.paymentMode.toUpperCase(),
              buyer: {
                name: 'Walk-in Retail Customer',
                address: 'Local / Counter Sale',
              },
              items: completedSale.lines.map((l) => ({
                name: l.name,
                packing: l.packing || '1x10',
                mfr: l.manufacturer,
                hsn: l.hsn,
                batch: l.batch,
                qty: l.qty,
                rate: l.rate,
                gstRate: l.gst,
                amount: l.qty * l.rate,
              })),
              grandTotal: completedSale.total,
            }}
          />
        </div>
      )}
    </div>
  )
}
