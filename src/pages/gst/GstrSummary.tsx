import { useState, useEffect } from 'react'
import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp } from '../../lib/erpApi'

interface Row {
  desc: string
  count: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

export default function GstrSummary() {
  const [rows, setRows] = useState<Row[]>([
    { desc: 'B2B Supplies', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
    { desc: 'B2C Large Invoice (>2.5L)', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
    { desc: 'B2C Small Invoice (<2.5L)', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
    { desc: 'Nil Rated / Exempted', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
    { desc: 'Export Invoices', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  ])

  useEffect(() => {
    Promise.all([
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('parties').catch(() => [])
    ]).then(([sales, parties]) => {
      const partyMap = new Map((parties || []).map((p: any) => [p.name, p.gstin || '']))

      let b2b = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      let b2cLarge = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      let b2cSmall = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }

      ;(sales || []).forEach((s: any) => {
        const partyGstin = s.gstin || partyMap.get(s.party) || ''
        const grandTotal = Number(s.total || s.grand_total || 0)

        let taxable = 0
        let cgst = 0
        let sgst = 0

        if (Array.isArray(s.lines) && s.lines.length > 0) {
          s.lines.forEach((l: any) => {
            const lineAmt = Number(l.amount || (Number(l.qty || 0) * Number(l.rate || 0)))
            const gstRate = Number(l.gst || l.gstRate || 12)
            taxable += lineAmt
            const tax = (lineAmt * gstRate) / 100
            cgst += tax / 2
            sgst += tax / 2
          })
        } else {
          taxable = grandTotal / 1.12
          const tax = grandTotal - taxable
          cgst = tax / 2
          sgst = tax / 2
        }

        if (partyGstin && partyGstin.trim().length >= 10) {
          b2b.count += 1
          b2b.taxable += taxable
          b2b.cgst += cgst
          b2b.sgst += sgst
        } else if (grandTotal > 250000) {
          b2cLarge.count += 1
          b2cLarge.taxable += taxable
          b2cLarge.cgst += cgst
          b2cLarge.sgst += sgst
        } else {
          b2cSmall.count += 1
          b2cSmall.taxable += taxable
          b2cSmall.cgst += cgst
          b2cSmall.sgst += sgst
        }
      })

      setRows([
        {
          desc: 'B2B Supplies',
          count: b2b.count,
          taxable: Math.round(b2b.taxable * 100) / 100,
          cgst: Math.round(b2b.cgst * 100) / 100,
          sgst: Math.round(b2b.sgst * 100) / 100,
          igst: 0
        },
        {
          desc: 'B2C Large Invoice (>2.5L)',
          count: b2cLarge.count,
          taxable: Math.round(b2cLarge.taxable * 100) / 100,
          cgst: Math.round(b2cLarge.cgst * 100) / 100,
          sgst: Math.round(b2cLarge.sgst * 100) / 100,
          igst: 0
        },
        {
          desc: 'B2C Small Invoice (<2.5L)',
          count: b2cSmall.count,
          taxable: Math.round(b2cSmall.taxable * 100) / 100,
          cgst: Math.round(b2cSmall.cgst * 100) / 100,
          sgst: Math.round(b2cSmall.sgst * 100) / 100,
          igst: 0
        },
        { desc: 'Nil Rated / Exempted', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
        { desc: 'Export Invoices', count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      ])
    })
  }, [])

  const totalTaxable = rows.reduce((a, r) => a + r.taxable, 0)
  const totalTax = rows.reduce((a, r) => a + r.cgst + r.sgst + r.igst, 0)
  const totalCount = rows.reduce((a, r) => a + r.count, 0)

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="GSTR-1 Category Summary" subtitle="Return Period: March 2026 | Outward supply category breakdown" />
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GSTR-1 Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">March 2026 | Outward supply breakdown by category</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr1-summary', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr-summary', rows))}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground border border-border rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { l: 'Total Invoices', v: String(totalCount), c: 'text-foreground' },
          { l: 'Total Taxable', v: formatCurrency(totalTaxable), c: 'text-blue-600 dark:text-blue-400' },
          { l: 'Total Tax', v: formatCurrency(totalTax), c: 'text-emerald-600 dark:text-emerald-400' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* GSTR-1 Summary Grid Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Description</th>
              <th className="text-right px-4 py-3 font-semibold w-16">Count</th>
              <th className="text-right px-4 py-3 font-semibold">Taxable</th>
              <th className="text-right px-4 py-3 font-semibold">CGST</th>
              <th className="text-right px-4 py-3 font-semibold">SGST</th>
              <th className="text-right px-4 py-3 font-semibold">IGST</th>
              <th className="text-right px-4 py-3 font-semibold">Total Tax</th>
              <th className="text-right px-4 py-3 font-semibold">Invoice Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((r) => (
              <tr key={r.desc} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{r.desc}</td>
                <td className="px-4 py-3 text-right font-medium">{r.count}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.taxable)}</td>
                <td className={cn('px-4 py-3 text-right font-mono', r.cgst > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')}>
                  {r.cgst > 0 ? formatCurrency(r.cgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', r.sgst > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}>
                  {r.sgst > 0 ? formatCurrency(r.sgst) : '-'}
                </td>
                <td className={cn('px-4 py-3 text-right font-mono', r.igst > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                  {r.igst > 0 ? formatCurrency(r.igst) : '-'}
                </td>
                <td className={cn(
                  'px-4 py-3 text-right font-mono font-bold',
                  r.cgst + r.sgst + r.igst > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}>
                  {r.cgst + r.sgst + r.igst > 0 ? formatCurrency(r.cgst + r.sgst + r.igst) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                  {formatCurrency(r.taxable + r.cgst + r.sgst + r.igst)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary/30 border-t border-border text-foreground font-bold text-xs">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{totalCount}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(rows.reduce((a, r) => a + r.cgst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(rows.reduce((a, r) => a + r.sgst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(rows.reduce((a, r) => a + r.igst, 0))}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTax)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTaxable + totalTax)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
