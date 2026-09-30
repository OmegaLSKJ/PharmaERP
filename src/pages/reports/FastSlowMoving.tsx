import { useState, useEffect } from 'react'
import { Zap, Turtle, Printer } from 'lucide-react'
import { cn, formatCurrency, daysUntilExpiry } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import PrintButton from '../../components/common/PrintButton'
import { getErp } from '../../lib/erpApi'

type MovementRow = { name:string; sold:number; stock:number; days:number; value:number }

export default function FastSlowMoving() {
  const [tab, setTab] = useState<'fast'|'slow'>('fast')
  const [fastRows, setFastRows] = useState<MovementRow[]>([])
  const [slowRows, setSlowRows] = useState<MovementRow[]>([])

  useEffect(() => {
    Promise.all([
      getErp<any[]>('items').catch(() => []),
      getErp<any[]>('sales').catch(() => [])
    ]).then(([items, sales]) => {
      const soldMap = new Map<string, number>()
      ;(sales || []).forEach((s: any) => {
        (s.lines || []).forEach((l: any) => {
          const name = l.name || ''
          const qty = Number(l.qty || l.quantity || 0)
          soldMap.set(name, (soldMap.get(name) || 0) + qty)
        })
      })

      const fast: MovementRow[] = []
      const slow: MovementRow[] = []

      ;(items || []).forEach((item: any) => {
        const sold = soldMap.get(item.name) || 0
        const stock = Number(item.stock || 0)
        const rate = Number(item.purchaseRate || item.saleRate || 0)
        const value = stock * rate
        const cycleDays = sold > 0 ? Math.round((stock / sold) * 30) : 90

        const row: MovementRow = {
          name: item.name,
          sold,
          stock,
          days: cycleDays,
          value
        }

        if (sold > 0 && cycleDays <= 15) {
          fast.push(row)
        } else {
          slow.push(row)
        }
      })

      setFastRows(fast)
      setSlowRows(slow)
    })
  }, [])

  const rows = tab === 'fast' ? fastRows : slowRows
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <PrintHeader title="Fast / Slow Moving Analysis" subtitle="Movement velocity analysis for inventory & purchase planning" />
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Fast / Slow Moving Items</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Movement velocity analysis for purchase planning</p>
        </div>
        <PrintButton
          label="Export PDF"
          autoOrientationHint="portrait"
          className="w-fit"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-card border border-emerald-500/20 rounded-xl p-3 sm:p-4 shadow-xs"><div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold flex items-center gap-1"><Zap size={11}/>Fast Movers (&lt; 15d cycle)</div><div className="text-lg sm:text-xl font-bold text-foreground mt-1">{fastRows.length} items</div></div>
        <div className="bg-card border border-amber-500/20 rounded-xl p-3 sm:p-4 shadow-xs"><div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold flex items-center gap-1"><Turtle size={11}/>Slow Movers (&gt; 15d cycle)</div><div className="text-lg sm:text-xl font-bold text-foreground mt-1">{slowRows.length} items</div></div>
      </div>
      <div className="flex gap-1 bg-secondary/50 border border-border rounded-lg p-1 w-fit">
        <button onClick={()=>setTab('fast')} className={cn('px-4 sm:px-5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer',tab==='fast'?'bg-emerald-600 text-white shadow-xs':'text-muted-foreground hover:text-foreground')}>Fast Moving</button>
        <button onClick={()=>setTab('slow')} className={cn('px-4 sm:px-5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer',tab==='slow'?'bg-amber-600 text-white shadow-xs':'text-muted-foreground hover:text-foreground')}>Slow Moving</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead><tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Item</th><th className="text-right px-4 py-3 font-medium">Units Sold (30d)</th><th className="text-right px-4 py-3 font-medium">Current Stock</th><th className="text-right px-4 py-3 font-medium">Cycle (days)</th><th className="text-right px-4 py-3 font-medium">Stock Value</th><th className="text-center px-4 py-3 font-medium">Velocity</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-foreground">
              {rows.map((r,i)=>{const vel=Math.round(r.sold/(r.sold+r.stock)*100);return(<tr key={i} className="hover:bg-secondary/40">
                <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-3 text-right">{r.sold}</td><td className="px-4 py-3 text-right">{r.stock.toLocaleString()}</td>
                <td className={cn('px-4 py-3 text-right font-bold',tab==='fast'?'text-emerald-600 dark:text-emerald-400':'text-amber-600 dark:text-amber-400')}>{r.days}d</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.value)}</td>
                <td className="px-4 py-3"><div className="flex items-center justify-center gap-2"><div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden"><div className={cn('h-full',tab==='fast'?'bg-emerald-500':'bg-amber-500')} style={{width:vel+'%'}}/></div><span className="font-mono text-[10px] text-muted-foreground">{vel}%</span></div></td>
              </tr>)})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
