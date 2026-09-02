import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, ShieldCheck, CreditCard, Building } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getErp } from '../../lib/erpApi'

export default function Party360() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<'overview' | 'transactions' | 'items'>('overview')
  const [partyData, setPartyData] = useState<any>({
    name: 'Loading...',
    type: 'customer',
    phone: '—',
    city: '—',
    state: '18-ASSAM',
    station: '',
    gstin: '',
    pan: '',
    dlNo: '',
    dlExp: '',
    creditLimit: 50000,
    outstanding: 0,
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    billsCount: 0,
    avgSaleDays: 14,
    avgCollectionDays: 21,
    turnoverRatio: 4.2,
    salesHistory: [
      { month: 'Apr', value: 12000 },
      { month: 'May', value: 18500 },
      { month: 'Jun', value: 24000 },
      { month: 'Jul', value: 19500 },
      { month: 'Aug', value: 32000 },
      { month: 'Sep', value: 28000 },
    ],
    recentTxns: [],
    topItems: [],
  })

  useEffect(() => {
    if (!id) return
    getErp<any[]>('parties')
      .then((parties) => {
        const found = parties.find((p) => String(p.id).toLowerCase() === id.toLowerCase() || String(p.code || '').toLowerCase() === id.toLowerCase())
        if (found) {
          setPartyData((prev: any) => ({
            ...prev,
            ...found,
            outstanding: Math.abs(Number(found.balance || 0)),
            creditLimit: Number(found.creditLimit || 0),
            openingBalance: Number(found.openingBalance || 0),
            totalDebit: Number(found.totalDebit || 0),
            totalCredit: Number(found.totalCredit || 0),
          }))
        }
      })
      .catch(() => {})
  }, [id])

  const stats = [
    { label: 'Outstanding', value: formatCurrency(partyData.outstanding), color: 'text-amber-400' },
    { label: 'Credit Limit', value: formatCurrency(partyData.creditLimit), color: 'text-white' },
    { label: 'D.L. Number', value: partyData.dlNo || partyData.dlNumber || '—', color: 'text-blue-400 font-mono text-sm' },
    { label: 'Avg Sale Days', value: partyData.avgSaleDays + 'd', color: 'text-blue-400' },
    { label: 'Avg Collection', value: partyData.avgCollectionDays + 'd', color: 'text-purple-400' },
    { label: 'Turnover', value: partyData.turnoverRatio + 'x', color: 'text-emerald-400' },
  ]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{partyData.name}</h1>
          <p className="text-sm text-slate-400">Party 360 | {partyData.type || partyData.accountGroup || 'Ledger Master'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{s.label}</div>
            <div className={cn('text-lg font-bold mt-1 truncate', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Phone size={14} className="text-slate-500" />
            <span>{partyData.phone || partyData.mobile || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin size={14} className="text-slate-500" />
            <span>{partyData.station || partyData.city || '—'}, {partyData.state || '18-ASSAM'}</span>
          </div>
          <div className="text-foreground font-mono text-xs flex items-center gap-2">
            <span className="text-slate-500">GSTIN:</span>
            {partyData.gstin ? (
              <span className="font-mono text-xs font-bold tracking-wider text-white select-all">
                {partyData.gstin}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <div className="text-foreground font-mono text-xs flex items-center gap-2">
            <span className="text-slate-500">PAN:</span>
            <span className="font-mono text-xs font-bold text-white">
              {partyData.pan || (partyData.gstin && partyData.gstin.length >= 12 ? partyData.gstin.slice(2, 12) : '—')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-lg p-1">
        {(['overview', 'transactions', 'items'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2 rounded-md text-sm font-medium capitalize transition', tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>{t}</button>
        ))}</div>
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Balance Summary</h3>
            <div className="space-y-2">
              {[
                { l: 'Opening Balance', v: partyData.openingBalance || 0, c: 'text-white' },
                { l: 'Total Debit', v: partyData.totalDebit || 0, c: 'text-emerald-400' },
                { l: 'Total Credit', v: partyData.totalCredit || 0, c: 'text-rose-400' },
              ].map((r) => (
                <div key={r.l} className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-300">{r.l}</span>
                  <span className={cn('font-mono text-sm', r.c)}>{formatCurrency(r.v)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold">
                <span className="text-white">Net Outstanding</span>
                <span className="font-mono text-amber-400">{formatCurrency(partyData.outstanding || 0)}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4">6-Month Sales Trend</h3>
            <div className="h-48 sm:h-56 lg:h-64 xl:h-72 min-h-[180px] max-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partyData.salesHistory || []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      {tab === 'transactions' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Ref</th>
                <th className="text-right px-4 py-3 font-medium">Debit</th>
                <th className="text-right px-4 py-3 font-medium">Credit</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {(partyData.recentTxns || []).map((t: any, i: number) => (
                <tr key={i} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-mono text-slate-400">{t.date}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', t.type === 'Receipt' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400')}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white">{t.ref}</td>
                  <td className="px-4 py-3 text-right font-mono">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-amber-400">{formatCurrency(t.balance)}</td>
                </tr>
              ))}
              {(!partyData.recentTxns || partyData.recentTxns.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500">
                    No recent transactions recorded for this party.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'items' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {(partyData.topItems || []).map((item: any, i: number) => (
                <tr key={i} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-right">{item.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              {(!partyData.topItems || partyData.topItems.length === 0) && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-500">
                    No item purchase history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
