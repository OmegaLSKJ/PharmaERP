import { useState, useEffect } from 'react'
import { Download, FileText, Calculator, ExternalLink } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp } from '../../lib/erpApi'

interface Gstr3bSection {
  section: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
}

export default function Gstr3b() {
  const [month] = useState('March 2026')
  const [sections, setSections] = useState<Gstr3bSection[]>([
    { section: '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    { section: '3.1(b) Outward taxable supplies (zero rated)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    { section: '3.1(c) Other outward supplies (Nil rated, exempted)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    { section: '3.2 Inward supplies (liable to reverse charge)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    { section: '4 Eligible ITC - (A) ITC on inward supplies (Purchases)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    { section: '4 Eligible ITC - (B) Other ITC / Adjustments', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 }
  ])

  useEffect(() => {
    Promise.all([
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('purchases').catch(() => [])
    ]).then(([sales, purchases]) => {
      // Calculate Outward Taxable Supplies from sales
      let outTaxable = 0
      let outCgst = 0
      let outSgst = 0
      let outIgst = 0

      ;(sales || []).forEach((s: any) => {
        const grandTotal = Number(s.total || s.grand_total || 0)
        if (Array.isArray(s.lines) && s.lines.length > 0) {
          s.lines.forEach((l: any) => {
            const lineAmt = Number(l.amount || (Number(l.qty || 0) * Number(l.rate || 0)))
            const gstRate = Number(l.gst || l.gstRate || 12)
            outTaxable += lineAmt
            const tax = (lineAmt * gstRate) / 100
            outCgst += tax / 2
            outSgst += tax / 2
          })
        } else {
          const taxable = grandTotal / 1.12
          outTaxable += taxable
          const tax = grandTotal - taxable
          outCgst += tax / 2
          outSgst += tax / 2
        }
      })

      // Calculate Inward Taxable Supplies / Eligible ITC from purchases
      let inTaxable = 0
      let inCgst = 0
      let inSgst = 0
      let inIgst = 0

      ;(purchases || []).forEach((p: any) => {
        const grandTotal = Number(p.total || p.grand_total || 0)
        if (Array.isArray(p.lines) && p.lines.length > 0) {
          p.lines.forEach((l: any) => {
            const lineAmt = Number(l.amount || (Number(l.qty || 0) * Number(l.rate || 0)))
            const gstRate = Number(l.gst || l.gstRate || 12)
            inTaxable += lineAmt
            const tax = (lineAmt * gstRate) / 100
            inCgst += tax / 2
            inSgst += tax / 2
          })
        } else {
          const taxable = grandTotal / 1.12
          inTaxable += taxable
          const tax = grandTotal - taxable
          inCgst += tax / 2
          inSgst += tax / 2
        }
      })

      setSections([
        {
          section: '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
          taxable: Math.round(outTaxable * 100) / 100,
          cgst: Math.round(outCgst * 100) / 100,
          sgst: Math.round(outSgst * 100) / 100,
          igst: Math.round(outIgst * 100) / 100,
          totalTax: Math.round((outCgst + outSgst + outIgst) * 100) / 100,
        },
        { section: '3.1(b) Outward taxable supplies (zero rated)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
        { section: '3.1(c) Other outward supplies (Nil rated, exempted)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
        { section: '3.2 Inward supplies (liable to reverse charge)', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
        {
          section: '4 Eligible ITC - (A) ITC on inward supplies (Purchases)',
          taxable: Math.round(inTaxable * 100) / 100,
          cgst: Math.round(inCgst * 100) / 100,
          sgst: Math.round(inSgst * 100) / 100,
          igst: Math.round(inIgst * 100) / 100,
          totalTax: Math.round((inCgst + inSgst + inIgst) * 100) / 100,
        },
        { section: '4 Eligible ITC - (B) Other ITC / Adjustments', taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 }
      ])
    })
  }, [])

  const totalLiability = sections.slice(0, 3).reduce((a, s) => a + s.totalTax, 0)
  const totalITC = sections.slice(4).reduce((a, s) => a + s.totalTax, 0)
  const netLiability = totalLiability - totalITC
  const reverseCharge = sections[3]?.totalTax || 0

  return (
    <div className="p-6 space-y-6">
      <PrintHeader title="GSTR-3B Monthly Return" subtitle={`${month} | Monthly Summary Return & Tax Liability`} />
      {/* Title block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-3B</h1>
          <p className="text-sm text-muted-foreground mt-1">{month} | Monthly Summary Return</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr3b-summary', useUIStore.getState().company))}
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
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr3b', { month, sections }))}
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
            {sections.map((s, i) => (
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
          {[
            { name: 'Intra-State Exempt Supplies', value: 0 },
            { name: 'Inter-State Exempt Supplies', value: 0 }
          ].map((e) => (
            <div key={e.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/40 transition-colors">
              <span className="text-sm text-foreground">{e.name}</span>
              <span className="text-sm font-mono text-foreground">{formatCurrency(e.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border font-bold text-foreground text-sm">
            <span>Total Exempt</span>
            <span>{formatCurrency(0)}</span>
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
