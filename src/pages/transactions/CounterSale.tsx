import { useState } from 'react'
import { ShoppingCart, Trash2, Banknote, Smartphone } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const ITEMS = [
  { name:'Dolo 650', rate:45 }, { name:'Cetirizine 10mg', rate:28 }, { name:'Paracetamol 650mg', rate:35 },
  { name:'ORS Sachet', rate:22 }, { name:'Vicks Inhaler', rate:85 }, { name:'Band-Aid (10)', rate:40 },
  { name:'Digene Gel', rate:120 }, { name:'Betadine 15ml', rate:95 },
]

export default function CounterSale() {
  const [cart,setCart] = useState<{name:string;qty:number;rate:number}[]>([])
  const [pay,setPay] = useState<'cash'|'upi'>('cash')
  const add = (i:typeof ITEMS[0]) => {
    const ex = cart.find(c=>c.name===i.name)
    if (ex) setCart(cart.map(c=>c.name===i.name?{...c,qty:c.qty+1}:c))
    else setCart([...cart,{name:i.name,qty:1,rate:i.rate}])
  }
  const total = cart.reduce((a,c)=>a+c.qty*c.rate,0)
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-2 space-y-3">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Counter Sale (POS)</h1>
          <p className="text-sm text-slate-400 mt-1">Walk-in customer | Quick billing</p></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ITEMS.map(i=>(<button key={i.name} onClick={()=>add(i)} className="bg-slate-900/50 border border-slate-800 hover:border-indigo-500 rounded-xl p-4 text-left transition">
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
          <button disabled={cart.length===0} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-lg text-sm font-semibold shadow-md">Print Bill &amp; Complete</button>
        </div>
      </div>
    </div>
  )
}
