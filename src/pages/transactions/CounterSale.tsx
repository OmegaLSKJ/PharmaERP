import { useState } from 'react'
import { ShoppingCart, Trash2, Banknote, Smartphone } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import Typeahead from '../../components/ui/Typeahead'
import { useEffect } from 'react'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

export default function CounterSale() {
  const [available, setAvailable] = useState<Array<{name:string;rate:number;batch:string;stock:number;gst:number}>>([])
  const [cart,setCart] = useState<Array<{name:string;qty:number;rate:number;batch:string;stock:number;gst:number}>>([])
  const [pay,setPay] = useState<'cash'|'upi'>('cash')
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { getErp<any[]>('items').then((items) => setAvailable(items.flatMap((item) => (item.batches ?? []).filter((b:any) => b.stock > 0).map((b:any) => ({ name:item.name, rate:item.saleRate, batch:b.batch, stock:b.stock, gst:item.gstRate }))))).catch((e) => showToast(e.message)) }, [showToast])
  const add = (i:{name:string;rate:number;batch:string;stock:number;gst:number}) => {
    const ex = cart.find(c=>c.name===i.name && c.batch===i.batch)
    if (ex) setCart(cart.map(c=>c.name===i.name&&c.batch===i.batch?{...c,qty:Math.min(c.qty+1,c.stock)}:c))
    else setCart([...cart,{...i,qty:1}])
  }
  const total = cart.reduce((a,c)=>a+c.qty*c.rate,0)
  const complete = async () => { setSaving(true); try { const invoice = await postErp<{id:string}>('sales', { party:'Walk-in Customer', total, paymentMode:pay, lines:cart.map((line) => ({ ...line, freeQty:0, discount:0, gstRate:line.gst, amount:line.qty*line.rate })) }); showToast(`Counter invoice ${invoice.id} posted.`); setCart([]); setTimeout(() => window.print(), 0) } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to complete counter sale.') } finally { setSaving(false) } }
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
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
              sub: `Batch: ${i.batch} | Stock: ${i.stock}`,
              right: formatCurrency(i.rate)
            }))}
            value=""
            onSelect={(opt) => {
              const selectedItem = available.find(i => i.name === opt.label && `Batch: ${i.batch} | Stock: ${i.stock}` === opt.sub)
              if (selectedItem) add(selectedItem)
            }}
            placeholder="Type medicine name to quickly add to cart..."
          />
        </div>

        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">Quick Add Items</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {available.map(i=>(<button key={`${i.name}-${i.batch}`} onClick={()=>add(i)} className="bg-slate-900/50 border border-slate-800 hover:border-indigo-500 rounded-xl p-4 text-left transition">
            <div className="text-sm font-medium text-white truncate">{i.name}</div>
            <div className="text-xs text-slate-400 mt-1">{formatCurrency(i.rate)}</div>
          </button>))}
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShoppingCart size={16} className="text-indigo-400"/>Cart ({cart.reduce((a,c)=>a+c.qty,0)})</div>
        {cart.length===0 ? <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Tap items to add</div> :
          cart.map(c=>(<div key={c.name} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/50">
            <span className="text-slate-300 truncate">{c.name}</span>
            <div className="flex items-center gap-2">
              <button onClick={()=>setCart(cart.map(x=>x.name===c.name&&x.qty>1?{...x,qty:x.qty-1}:x.name===c.name?{...x,qty:0}:x).filter(Boolean) as typeof cart)} className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">-</button>
              <span className="font-mono w-6 text-right text-white">{c.qty}</span>
              <button onClick={()=>setCart(cart.map(x=>x.name===c.name?{...x,qty:x.qty+1}:x))} className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">+</button>
              <span className="font-mono w-14 text-right text-emerald-400">{formatCurrency(c.qty*c.rate)}</span>
              <button onClick={()=>setCart(cart.filter(x=>x.name!==c.name))} className="p-0.5 text-slate-500 hover:text-rose-400"><Trash2 size={12}/></button>
            </div>
          </div>))}
        <div className="mt-auto pt-3 border-t border-slate-700 space-y-3">
          <div className="flex justify-between text-xl font-bold"><span className="text-white">Total</span><span className="font-mono text-emerald-400">{formatCurrency(total)}</span></div>
          <div className="flex rounded-lg border border-slate-800 overflow-hidden">
            <button onClick={()=>setPay('cash')} className={cn('flex-1 p-2 text-sm font-medium flex items-center justify-center gap-2 transition',pay==='cash'?'bg-emerald-600 text-white':'bg-slate-950 text-slate-400')}><Banknote size={14}/>Cash</button>
            <button onClick={()=>setPay('upi')} className={cn('flex-1 p-2 text-sm font-medium flex items-center justify-center gap-2 transition',pay==='upi'?'bg-indigo-600 text-white':'bg-slate-950 text-slate-400')}><Smartphone size={14}/>UPI</button>
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

          <button onClick={complete} disabled={cart.length===0 || saving} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-lg text-sm font-semibold shadow-md">{saving ? 'Posting…' : 'Print Bill & Complete'}</button>
        </div>
      </div>
    </div>
  )
}
