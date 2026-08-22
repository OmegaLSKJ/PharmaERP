import { useState } from 'react'
import { Download, FileText, Filter } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'

interface GstrEntry {
  id: string; invoiceNo: string; date: string; partyName: string; gstin: string;
  type: 'B2B' | 'B2C Large' | 'B2C Small' | 'Nil Rated' | 'Export';
  taxable: number; cgst: number; sgst: number; igst: number; totalTax: number; invoiceValue: number;
}

const GSTR_DATA: GstrEntry[] = [
  { id: '1', invoiceNo: 'SI-2026-1838', date: '2026-03-15', partyName: 'MediCare Pharma', gstin: '27AAACM1234F1Z5', type: 'B2B', taxable: 40714, cgst: 2443, sgst: 2443, igst: 0, totalTax: 4886, invoiceValue: 45600 },
  { id: '2', invoiceNo: 'SI-2026-1839', date: '2026-03-15', partyName: 'HealthFirst Distributors', gstin: '07BBBHM5678G1Z8', type: 'B2B', taxable: 28661, cgst: 1720, sgst: 1720, igst: 0, totalTax: 3440, invoiceValue: 32100 },
  { id: '3', invoiceNo: 'SI-2026-1840', date: '2026-03-14', partyName: 'CareWell Pharmacy', gstin: '29CCCPW9012H1Z1', type: 'B2B', taxable: 16875, cgst: 1013, sgst: 1013, igst: 0, totalTax: 2025, invoiceValue: 18900 },
  { id: '4', invoiceNo: 'SI-2026-1841', date: '2026-03-14', partyName: 'Walk-in Customer', gstin: '', type: 'B2C Small', taxable: 59821, cgst: 3589, sgst: 3589, igst: 0, totalTax: 7179, invoiceValue: 67000 },
  { id: '5', invoiceNo: 'SI-2026-1842', date: '2026-03-13', partyName: 'Wellness Pharma', gstin: '19JJJWT7890R1Z2', type: 'B2B', taxable: 20893, cgst: 1254, sgst: 1254, igst: 0, totalTax: 2508, invoiceValue: 23400 },
]

export default function GstReports() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const types = ['all', ...new Set(GSTR_DATA.map((g) => g.type))]

  const filtered = GSTR_DATA.filter((g) => typeFilter === 'all' || g.type === typeFilter)
  const totals = filtered.reduce((acc, g) => ({
    taxable: acc.taxable + g.taxable,
    cgst: acc.cgst + g.cgst,
    sgst: acc.sgst + g.sgst,
    igst: acc.igst + g.igst,
    totalTax: acc.totalTax + g.totalTax,
    invoiceValue: acc.invoiceValue + g.invoiceValue,
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceValue: 0 })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">GST Reports</h1>
          <p className="text-sm text-slate-400 mt-1">GSTR-1 Summary &bull; March 2026</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr1', GSTR_DATA))} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
            <FileText size={16} /> GSTR-1 JSON
          </button>
          <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr1'))} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Taxable', value: totals.taxable, color: 'text-white' },
          { label: 'CGST', value: totals.cgst, color: 'text-blue-400' },
          { label: 'SGST', value: totals.sgst, color: 'text-purple-400' },
          { label: 'IGST', value: totals.igst, color: 'text-amber-400' },
          { label: 'Invoice Value', value: totals.invoiceValue, color: 'text-emerald-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">{kpi.label}</div>
            <div className={cn('text-lg font-bold mt-1', kpi.color)}>{formatCurrency(kpi.value)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {types.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          )}>
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Invoice No</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Party</th>
                <th className="text-left px-4 py-3 font-medium">GSTIN</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Taxable</th>
                <th className="text-right px-4 py-3 font-medium">CGST</th>
                <th className="text-right px-4 py-3 font-medium">SGST</th>
                <th className="text-right px-4 py-3 font-medium">IGST</th>
                <th className="text-right px-4 py-3 font-medium">Total Tax</th>
                <th className="text-right px-4 py-3 font-medium">Invoice Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-mono text-white">{g.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{g.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{g.partyName}</td>
                  <td className="px-4 py-3 font-mono text-slate-400 text-[10px]">{g.gstin || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',
                      g.type === 'B2B' && 'bg-blue-500/10 text-blue-400',
                      g.type === 'B2C Small' && 'bg-amber-500/10 text-amber-400',
                      g.type === 'B2C Large' && 'bg-orange-500/10 text-orange-400',
                      g.type === 'Nil Rated' && 'bg-slate-500/10 text-slate-400',
                      g.type === 'Export' && 'bg-emerald-500/10 text-emerald-400',
                    )}>{g.type}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(g.taxable)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-400">{formatCurrency(g.cgst)}</td>
                  <td className="px-4 py-3 text-right font-mono text-purple-400">{formatCurrency(g.sgst)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(g.igst)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-white">{formatCurrency(g.totalTax)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{formatCurrency(g.invoiceValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold">
                <td colSpan={5} className="px-4 py-3">Total ({filtered.length} invoices)</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.taxable)}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-400">{formatCurrency(totals.cgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-400">{formatCurrency(totals.sgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(totals.igst)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.totalTax)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(totals.invoiceValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
