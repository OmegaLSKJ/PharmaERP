import { useState } from 'react'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

const monthlySales: Array<{ month:string; value:number }> = []
const catData: Array<{ name:string; value:number }> = []
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const topParties: Array<{ name:string; sales:number; growth:number }> = []
const topItems: Array<{ name:string; qty:number; revenue:number; margin:number }> = []
type SalesReport = { monthlySales:Array<{month:string;value:number}>; categories:Array<{name:string;value:number}>; topParties:Array<{name:string;sales:number;growth:number}>; topItems:Array<{name:string;qty:number;revenue:number;margin:number}>; units:number }

export default function SalesAnalytics() {
  const [report,setReport]=useState<SalesReport>({monthlySales:[],categories:[],topParties:[],topItems:[],units:0})
  useEffect(()=>{getErp<SalesReport>('report-sales').then(setReport)},[])
  const {monthlySales,topParties,topItems,units}=report,catData=report.categories
  const totalSales = monthlySales.reduce((a, m) => a + m.value, 0)
  const avgMonthly = totalSales / 12
  const best = monthlySales.reduce((a, m) => m.value > a.value ? m : a, { month: 'No data', value: 0 })
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sales Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | Comprehensive sales intelligence</p>
        </div>
        <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('sales-analytics'))} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Sales</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalSales)}</div>
          <div className="flex items-center gap-1 mt-1 text-[10px]"><TrendingUp size={10} className="text-emerald-400" /><span className="text-emerald-400">0% YoY</span></div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Monthly</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(avgMonthly)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Best Month</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{best.month}</div>
          <div className="text-[10px] text-slate-500">{formatCurrency(best.value)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Units Sold</div>
          <div className="text-xl font-bold text-white mt-1">{units.toLocaleString()}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Sales Trend</h3>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlySales}><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip formatter={(v: number | string) => formatCurrency(Number(v))} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">By Category</h3>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>{catData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v: number | string) => formatCurrency(Number(v))} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-1 mt-2">{catData.map((c, i) => (<div key={c.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} /><span className="text-slate-300">{c.name}</span></div><span className="font-mono text-slate-400">{formatCurrency(c.value)}</span></div>))}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Top Parties by Sales</h3></div>
          <div className="divide-y divide-slate-800">{topParties.map((p, i) => (<div key={p.name} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30"><div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-500 w-4">{i + 1}</span><span className="text-sm font-medium text-white">{p.name}</span></div><div className="flex items-center gap-3"><span className="text-sm font-mono text-slate-300">{formatCurrency(p.sales)}</span><span className={cn('text-[10px] font-semibold flex items-center gap-0.5', p.growth >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{p.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(p.growth)}%</span></div></div>))}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Top Items by Revenue</h3></div>
          <div className="divide-y divide-slate-800">{topItems.map((item, i) => (<div key={item.name} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30"><div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-500 w-4">{i + 1}</span><div><div className="text-sm font-medium text-white">{item.name}</div><div className="text-[10px] text-slate-500">{item.qty.toLocaleString()} units | Margin: {item.margin}%</div></div></div><span className="text-sm font-mono text-slate-300">{formatCurrency(item.revenue)}</span></div>))}</div>
        </div>
      </div>
    </div>
  )
}
