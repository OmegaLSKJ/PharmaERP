import { useState } from 'react'
import { Download, FileText, Calculator } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface Gstr3bSection { section: string; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }

const SECTIONS: Gstr3bSection[] = [
  { section: '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', taxable: 680000, cgst: 40800, sgst: 40800, igst: 0, totalTax: 81600 },
  { section: '3.1(b) Outward taxable supplies (zero rated)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
  { section: '3.1(c) Other outward supplies (Nil rated, exempted)', taxable: 35000, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
  { section: '3.2 Inward supplies (liable to reverse charge)', taxable: 120000, cgst: 7200, sgst: 7200, igst: 0, totalTax: 14400 },
  { section: '4 Eligible ITC - (A) ITB on inward supplies', taxable: 580000, cgst: 34800, sgst: 34800, igst: 0, totalTax: 69600 },
  { section: '4 Eligible ITC - (B) Other ITC', taxable: 25000, cgst: 1500, sgst: 1500, igst: 0, totalTax: 3000 },
]

const EXEMPT_SUPPLY = [
  { name: 'Nil rated medicines', value: 18000 },
  { name: 'Exempt formulations', value: 12000 },
  { name: 'Non-GST items', value: 5000 },
]

export default function Gstr3b() {
  const [month, setMonth] = useState('March 2026')

  const totalLiability = SECTIONS.slice(0, 3).reduce((a, s) => a + s.totalTax, 0)
  const totalITC = SECTIONS.slice(4).reduce((a, s) => a + s.totalTax, 0)
  const netLiability = totalLiability - totalITC
  const reverseCharge = SECTIONS[3].totalTax

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">GSTR-3B</h1>
          <p className="text-sm text-slate-400 mt-1">{month} | Monthly Summary Return</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
            <FileText size={16} /> Preview
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Tax Liability</div>
          <div className="text-lg font-bold text-rose-400 mt-1">{formatCurrency(totalLiability)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total ITC Available</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(totalITC)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Reverse Charge</div>
          <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(reverseCharge)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Tax Payable</div>
          <div className={cn('text-lg font-bold mt-1', netLiability > 0 ? 'text-rose-400' : 'text-emerald-400')}>{formatCurrency(netLiability)}</div>
        </div>
      </div>

      {/* 3.1 Outward Supplies */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Calculator size={14} /> 3.1 - Outward Supplies & Inward Supplies (Reverse Charge)</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Taxable</th>
              <th className="text-right px-4 py-3 font-medium">CGST</th>
              <th className="text-right px-4 py-3 font-medium">SGST</th>
              <th className="text-right px-4 py-3 font-medium">IGST</th>
              <th className="text-right px-4 py-3 font-medium">Total Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {SECTIONS.map((s, i) => (
              <tr key={i} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 text-white max-w-md">{s.section}</td>
                <td className="px-4 py-3 text-right font-mono">{s.taxable > 0 ? formatCurrency(s.taxable) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-400">{s.cgst > 0 ? formatCurrency(s.cgst) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-400">{s.sgst > 0 ? formatCurrency(s.sgst) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">{s.igst > 0 ? formatCurrency(s.igst) : '-'}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-white">{s.totalTax > 0 ? formatCurrency(s.totalTax) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exempt Breakdown */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <h3 className="text-sm font-semibold text-white">3.1(c) - Nil Rated / Exempted Breakdown</h3>
        </div>
        <div className="p-4 space-y-2">
          {EXEMPT_SUPPLY.map(e => (
            <div key={e.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-900/50">
              <span className="text-sm text-slate-300">{e.name}</span>
              <span className="text-sm font-mono text-slate-400">{formatCurrency(e.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 font-bold text-white text-sm">
            <span>Total Exempt</span>
            <span>{formatCurrency(EXEMPT_SUPPLY.reduce((a, e) => a + e.value, 0))}</span>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-300">Net Tax Payable for {month}</div>
            <div className={cn('text-3xl font-bold mt-1', netLiability > 0 ? 'text-white' : 'text-emerald-400')}>{formatCurrency(netLiability)}</div>
          </div>
          <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-lg transition">
            File GSTR-3B
          </button>
        </div>
      </div>
    </div>
  )
}
