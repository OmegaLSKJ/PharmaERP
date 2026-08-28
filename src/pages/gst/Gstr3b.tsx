import { useState } from 'react'
import { Download, FileText, Calculator, ExternalLink } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

interface Gstr3bSection {
  section: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
}

const SECTIONS: Gstr3bSection[] = [
  { section: '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', taxable: 850000, cgst: 76500, sgst: 76500, igst: 0, totalTax: 153000 },
  { section: '3.1(b) Outward taxable supplies (zero rated)', taxable: 120000, cgst: 0, sgst: 0, igst: 21600, totalTax: 21600 },
  { section: '3.1(c) Other outward supplies (Nil rated, exempted)', taxable: 45000, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
  { section: '3.2 Inward supplies (liable to reverse charge)', taxable: 15000, cgst: 1350, sgst: 1350, igst: 0, totalTax: 2700 },
  { section: '4 Eligible ITC - (A) ITB on inward supplies', taxable: 650000, cgst: 58500, sgst: 58500, igst: 0, totalTax: 117000 },
  { section: '4 Eligible ITC - (B) Other ITC', taxable: 80000, cgst: 7200, sgst: 7200, igst: 0, totalTax: 14400 }
]

const EXEMPT_SUPPLY = [
  { name: 'Intra-State Exempt Supplies', value: 25000 },
  { name: 'Inter-State Exempt Supplies', value: 20000 }
]

export default function Gstr3b() {
  const [month] = useState('March 2026')

  const totalLiability = SECTIONS.slice(0, 3).reduce((a, s) => a + s.totalTax, 0)
  const totalITC = SECTIONS.slice(4).reduce((a, s) => a + s.totalTax, 0)
  const netLiability = totalLiability - totalITC
  const reverseCharge = SECTIONS[3].totalTax

  return (
    <div className="p-6 space-y-6">
      {/* Title block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-3B</h1>
          <p className="text-sm text-muted-foreground mt-1">{month} | Monthly Summary Return</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr3b-summary'))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={() => window.open('https://services.gst.gov.in/services/login', '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-md transition border border-emerald-500/20"
            title="Open official GST Portal login page to file GSTR-3B"
          >
            <ExternalLink size={16} /> Login to GST Portal
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr3b', { month, sections: SECTIONS, exemptSupply: EXEMPT_SUPPLY }))}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground border border-border rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Tax Liability</div>
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{formatCurrency(totalLiability)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total ITC Available</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totalITC)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Reverse Charge</div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(reverseCharge)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Net Tax Payable</div>
          <div className={cn('text-lg font-bold mt-1', netLiability > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {formatCurrency(netLiability)}
          </div>
        </div>
      </div>

      {/* 3.1 Outward Supplies Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calculator size={14} /> 3.1 - Outward Supplies & Inward Supplies (Reverse Charge)
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Description</th>
              <th className="text-right px-4 py-3 font-semibold">Taxable</th>
              <th className="text-right px-4 py-3 font-semibold">CGST</th>
              <th className="text-right px-4 py-3 font-semibold">SGST</th>
              <th className="text-right px-4 py-3 font-semibold">IGST</th>
              <th className="text-right px-4 py-3 font-semibold">Total Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {SECTIONS.map((s, i) => (
              <tr key={i} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3 text-foreground max-w-md">{s.section}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{s.taxable > 0 ? formatCurrency(s.taxable) : '-'}</td>
                <td className={cn('px-4 py-3 text-right font-mono', s.cgst > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                  {s.cgst > 0 ? formatCurrency(s.cgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', s.sgst > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}>
                  {s.sgst > 0 ? formatCurrency(s.sgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', s.igst > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                  {s.igst > 0 ? formatCurrency(s.igst) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{s.totalTax > 0 ? formatCurrency(s.totalTax) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exempt Breakdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">3.1(c) - Nil Rated / Exempted Breakdown</h3>
        </div>
        <div className="p-4 space-y-2">
          {EXEMPT_SUPPLY.map((e) => (
            <div key={e.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/40 transition-colors">
              <span className="text-sm text-foreground">{e.name}</span>
              <span className="text-sm font-mono text-foreground">{formatCurrency(e.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border font-bold text-foreground text-sm">
            <span>Total Exempt</span>
            <span>{formatCurrency(EXEMPT_SUPPLY.reduce((a, e) => a + e.value, 0))}</span>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-gradient-to-r from-secondary/40 to-secondary/10 border border-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Net Tax Payable for {month}</div>
            <div className={cn('text-3xl font-bold mt-1', netLiability > 0 ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
              {formatCurrency(netLiability)}
            </div>
          </div>
          <button
            disabled
            title="Connect an authorized GST portal account before filing"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-lg opacity-50 cursor-not-allowed"
          >
            File GSTR-3B
          </button>
        </div>
      </div>
    </div>
  )
}
