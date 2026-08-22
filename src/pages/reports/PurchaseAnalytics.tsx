import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn, formatCurrency } from '../../lib/utils'
import { useEffect, useState } from 'react'
import { getErp } from '../../lib/erpApi'

const monthlyPurchases: Array<{ month:string; value:number }> = []
const topSuppliers: Array<{ name:string; purchases:number; growth:number }> = []

export default function PurchaseAnalytics() {
  const [report,setReport]=useState<{monthlyPurchases:Array<{month:string;value:number}>;topSuppliers:Array<{name:string;purchases:number;growth:number}>;activeSuppliers:number}>({monthlyPurchases:[],topSuppliers:[],activeSuppliers:0})
  useEffect(()=>{getErp<typeof report>('report-purchases').then(setReport)},[])
  const {monthlyPurchases,topSuppliers,activeSuppliers}=report
  const totalPurchases = monthlyPurchases.reduce((a, m) => a + m.value, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | Supplier and purchase intelligence</p>
        </div>
        <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('purchase-analytics'))} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Purchases</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalPurchases)}</div>
          <div className="flex items-center gap-1 mt-1 text-[10px]"><TrendingUp size={10} className="text-emerald-400" /><span className="text-emerald-400">0% YoY</span></div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Monthly</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalPurchases / 12)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Suppliers</div>
          <div className="text-xl font-bold text-white mt-1">{activeSuppliers}</div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Monthly Purchase Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyPurchases}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number | string) => formatCurrency(Number(v))} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Top Suppliers</h3></div>
        <div className="divide-y divide-slate-800">
          {topSuppliers.map((s, i) => (
            <div key={s.name} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30">
              <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-500 w-4">{i + 1}</span><span className="text-sm font-medium text-white">{s.name}</span></div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-slate-300">{formatCurrency(s.purchases)}</span>
                <span className={cn('text-[10px] font-semibold flex items-center gap-0.5', s.growth >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {s.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(s.growth)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
