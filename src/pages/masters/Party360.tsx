import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const PARTY = {
  name: 'MediCare Pharma Pvt Ltd', type: 'Customer', phone: '9876543210',
  city: 'Mumbai', state: 'Maharashtra', gstin: '27AAACM1234F1Z5', drugLicence: 'MH-2024-1234',
  creditLimit: 500000, outstanding: 125000, openingBalance: 85000,
  totalDebit: 456000, totalCredit: 416000, lastSale: '2026-03-15', lastPayment: '2026-03-14',
  avgSaleDays: 3, avgCollectionDays: 12, turnoverRatio: 4.2, billsCount: 48,
  salesHistory: [
    { month: 'Oct', value: 180000 }, { month: 'Nov', value: 220000 }, { month: 'Dec', value: 195000 },
    { month: 'Jan', value: 240000 }, { month: 'Feb', value: 210000 }, { month: 'Mar', value: 175000 },
  ],
  recentTxns: [
    { date: '2026-03-15', type: 'Sale', ref: 'SI-2026-1842', debit: 45600, credit: 0, balance: 125000 },
    { date: '2026-03-14', type: 'Receipt', ref: 'REC-2026-045', debit: 0, credit: 45600, balance: 79400 },
    { date: '2026-03-12', type: 'Sale', ref: 'SI-2026-1836', debit: 33000, credit: 0, balance: 112400 },
    { date: '2026-03-08', type: 'Receipt', ref: 'REC-2026-038', debit: 0, credit: 40000, balance: 79400 },
  ],
  topItems: [
    { name: 'Amoxicillin 500mg', qty: 120, amount: 18240 },
    { name: 'Azithromycin 250mg', qty: 80, amount: 16160 },
    { name: 'Paracetamol 650mg', qty: 100, amount: 7600 },
  ],
}

const TS: Record<string, string> = { Sale: 'bg-blue-500/10 text-blue-400', Receipt: 'bg-emerald-500/10 text-emerald-400' }

export default function Party360() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'overview' | 'transactions' | 'items'>('overview')
  const stats = [
    { label: 'Outstanding', value: formatCurrency(PARTY.outstanding), color: 'text-amber-400' },
    { label: 'Credit Limit', value: formatCurrency(PARTY.creditLimit), color: 'text-white' },
    { label: 'Bills', value: String(PARTY.billsCount), color: 'text-white' },
    { label: 'Avg Sale Days', value: PARTY.avgSaleDays + 'd', color: 'text-blue-400' },
    { label: 'Avg Collection', value: PARTY.avgCollectionDays + 'd', color: 'text-purple-400' },
    { label: 'Turnover', value: PARTY.turnoverRatio + 'x', color: 'text-emerald-400' },
  ]
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><ArrowLeft size={18} /></button>
        <div className="flex-1"><h1 className="text-2xl font-bold tracking-tight text-white">{PARTY.name}</h1>
        <p className="text-sm text-slate-400">Party 360 | {PARTY.type}</p></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {stats.map(s => (<div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">{s.label}</div>
          <div className={cn('text-lg font-bold mt-1', s.color)}>{s.value}</div></div>))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300"><Phone size={14} className="text-slate-500" />{PARTY.phone}</div>
          <div className="flex items-center gap-2 text-slate-300"><MapPin size={14} className="text-slate-500" />{PARTY.city}, {PARTY.state}</div>
          <div className="text-slate-300 font-mono text-xs">GSTIN: {PARTY.gstin}</div>
        </div></div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1">
        {(['overview', 'transactions', 'items'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2 rounded-md text-sm font-medium capitalize transition', tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>{t}</button>
        ))}</div>
      {tab === 'overview' && (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><h3 className="text-sm font-semibold text-white mb-4">Balance Summary</h3>
          <div className="space-y-2">
            {[{ l: 'Opening Balance', v: PARTY.openingBalance, c: 'text-white' }, { l: 'Total Debit', v: PARTY.totalDebit, c: 'text-emerald-400' }, { l: 'Total Credit', v: PARTY.totalCredit, c: 'text-rose-400' }].map(r => (
              <div key={r.l} className="flex justify-between py-2 border-b border-slate-800"><span className="text-sm text-slate-300">{r.l}</span><span className={cn('font-mono text-sm', r.c)}>{formatCurrency(r.v)}</span></div>
            ))}
            <div className="flex justify-between py-2 font-bold"><span className="text-white">Net Outstanding</span><span className="font-mono text-amber-400">{formatCurrency(PARTY.outstanding)}</span></div>
          </div></div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"><h3 className="text-sm font-semibold text-white mb-4">6-Month Sales Trend</h3>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={PARTY.salesHistory}><XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer></div></div>
      </div>)}
      {tab === 'transactions' && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
        <th className="text-left px-4 py-3 font-medium">Date</th><th className="text-left px-4 py-3 font-medium">Type</th><th className="text-left px-4 py-3 font-medium">Ref</th><th className="text-right px-4 py-3 font-medium">Debit</th><th className="text-right px-4 py-3 font-medium">Credit</th><th className="text-right px-4 py-3 font-medium">Balance</th>
      </tr></thead><tbody className="divide-y divide-slate-800 text-slate-300">
        {PARTY.recentTxns.map((t, i) => (<tr key={i} className="hover:bg-slate-900/30">
          <td className="px-4 py-3 font-mono text-slate-400">{t.date}</td>
          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TS[t.type])}>{t.type}</span></td>
          <td className="px-4 py-3 font-mono text-white">{t.ref}</td>
          <td className="px-4 py-3 text-right font-mono">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
          <td className="px-4 py-3 text-right font-mono">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
          <td className="px-4 py-3 text-right font-mono font-medium text-amber-400">{formatCurrency(t.balance)}</td>
        </tr>))}
      </tbody></table></div>)}
      {tab === 'items' && (<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
        <th className="text-left px-4 py-3 font-medium">#</th><th className="text-left px-4 py-3 font-medium">Item</th><th className="text-right px-4 py-3 font-medium">Qty</th><th className="text-right px-4 py-3 font-medium">Amount</th>
      </tr></thead><tbody className="divide-y divide-slate-800 text-slate-300">
        {PARTY.topItems.map((item, i) => (<tr key={i} className="hover:bg-slate-900/30">
          <td className="px-4 py-3 text-slate-500">{i + 1}</td>
          <td className="px-4 py-3 font-medium text-white">{item.name}</td>
          <td className="px-4 py-3 text-right">{item.qty}</td>
          <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(item.amount)}</td>
        </tr>))}
      </tbody></table></div>)}
    </div>
  )
}
