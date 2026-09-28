import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

type Delivery = { id:string; order:string; customer:string; items:number; total:number; transport:string; status:string }
const colors: Record<string,string> = { draft:'text-amber-400', dispatched:'text-blue-400', delivered:'text-emerald-400', cancelled:'text-rose-400' }

export default function DeliveryManagement() {
  const [rows, setRows] = useState<Delivery[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getErp<any[]>('challans')
      .then((data) => setRows((data || []).map((row) => ({
        id: String(row.dbId || row.id), order: row.number || row.id, customer: row.party || '',
        items: (row.lines || []).reduce((n:number,line:any) => n + Number(line.qty || 0), 0),
        total: (row.lines || []).reduce((n:number,line:any) => n + Number(line.qty || 0) * Number(line.rate || 0), 0),
        transport: row.transport || '—', status: row.status || 'draft',
      }))))
      .finally(() => setLoading(false))
  }, [])
  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Delivery Management</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2">
          <Truck size={14} className="text-cyan-500 dark:text-cyan-400" /> Live delivery challans from Supabase
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'dispatched', 'delivered', 'cancelled'].map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer', filter === value ? 'bg-indigo-600 text-white shadow-xs' : 'bg-card border border-border text-muted-foreground hover:text-foreground shadow-xs')}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase text-[11px]">
                <th className="text-left p-3 min-w-[120px]">Challan</th>
                <th className="text-left p-3 min-w-[180px]">Customer</th>
                <th className="text-right p-3 min-w-[70px]">Items</th>
                <th className="text-right p-3 min-w-[110px]">Total</th>
                <th className="text-left p-3 min-w-[130px]">Transport</th>
                <th className="text-left p-3 min-w-[90px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Loading live challans…</td>
                </tr>
              ) : visible.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="p-3 font-mono text-foreground font-medium min-w-[120px]">{row.order}</td>
                  <td className="p-3 min-w-[180px]">{row.customer}</td>
                  <td className="p-3 text-right min-w-[70px]">{row.items}</td>
                  <td className="p-3 text-right font-mono font-medium min-w-[110px] whitespace-nowrap">{formatCurrency(row.total)}</td>
                  <td className="p-3 text-muted-foreground min-w-[130px]">{row.transport}</td>
                  <td className={cn('p-3 capitalize font-semibold min-w-[90px]', colors[row.status] || 'text-foreground')}>{row.status}</td>
                </tr>
              ))}
              {!loading && !visible.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No delivery challans match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
