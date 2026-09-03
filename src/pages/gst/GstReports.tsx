import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

interface GstrEntry {
  id: string
  invoiceNo: string
  date: string
  partyName: string
  gstin: string
  type: 'B2B' | 'B2C Large' | 'B2C Small' | 'Nil Rated' | 'Export'
  taxable: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  invoiceValue: number
}

const GSTR_DATA: GstrEntry[] = [
  { id: '1', invoiceNo: 'SI-2026/001', date: '2026-08-01', partyName: 'Apollo Pharmacy', gstin: '27AAAAA1111A1Z1', type: 'B2B', taxable: 85000, cgst: 7650, sgst: 7650, igst: 0, totalTax: 15300, invoiceValue: 100300 },
  { id: '2', invoiceNo: 'SI-2026/002', date: '2026-08-04', partyName: 'MedPlus Chemist', gstin: '07BBBBB2222B2Z2', type: 'B2B', taxable: 120000, cgst: 10800, sgst: 10800, igst: 0, totalTax: 21600, invoiceValue: 141600 },
  { id: '3', invoiceNo: 'SI-2026/003', date: '2026-08-10', partyName: 'Walk-in Customer A', gstin: '', type: 'B2C Small', taxable: 45000, cgst: 4050, sgst: 4050, igst: 0, totalTax: 8100, invoiceValue: 53100 },
  { id: '4', invoiceNo: 'SI-2026/004', date: '2026-08-15', partyName: 'Global Biotech Export', gstin: '99APEXG1234F9Z0', type: 'Export', taxable: 650000, cgst: 0, sgst: 0, igst: 117000, totalTax: 117000, invoiceValue: 767000 },
  { id: '5', invoiceNo: 'SI-2026/005', date: '2026-08-20', partyName: 'Metro Healthcare Group', gstin: '27DDDDD4444D4Z4', type: 'B2B', taxable: 950000, cgst: 85500, sgst: 85500, igst: 0, totalTax: 171000, invoiceValue: 1121000 }
]

export default function GstReports() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const types = ['all', ...new Set(GSTR_DATA.map((g) => g.type))]

  const filtered = GSTR_DATA.filter((g) => typeFilter === 'all' || g.type === typeFilter)
  const totals = filtered.reduce(
    (acc, g) => ({
      taxable: acc.taxable + g.taxable,
      cgst: acc.cgst + g.cgst,
      sgst: acc.sgst + g.sgst,
      igst: acc.igst + g.igst,
      totalTax: acc.totalTax + g.totalTax,
      invoiceValue: acc.invoiceValue + g.invoiceValue
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceValue: 0 }
  )

  return (
    <div className="p-6 space-y-6">
      <PrintHeader title="GSTR-1 Report" />
      {/* Header block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GST Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">GSTR-1 Summary &bull; March 2026</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportJson }) => exportJson('gstr1', GSTR_DATA))}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground border border-border rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Download size={16} /> GSTR-1 JSON
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('gstr1', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Taxable', value: totals.taxable, color: 'text-foreground font-bold' },
          { label: 'CGST', value: totals.cgst, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'SGST', value: totals.sgst, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'IGST', value: totals.igst, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Invoice Value', value: totals.invoiceValue, color: 'text-emerald-600 dark:text-emerald-400 font-bold' }
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{kpi.label}</div>
            <div className={cn('text-lg font-bold mt-1', kpi.color)}>{formatCurrency(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* Tabs type selector */}
      <div className="flex items-center gap-3">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition',
              typeFilter === t
                ? 'bg-primary text-primary-foreground border-primary/20 shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}
      </div>

      {/* Table grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Invoice No</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Party</th>
                <th className="text-left px-4 py-3 font-semibold">GSTIN</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-right px-4 py-3 font-semibold">Taxable</th>
                <th className="text-right px-4 py-3 font-semibold">CGST</th>
                <th className="text-right px-4 py-3 font-semibold">SGST</th>
                <th className="text-right px-4 py-3 font-semibold">IGST</th>
                <th className="text-right px-4 py-3 font-semibold">Total Tax</th>
                <th className="text-right px-4 py-3 font-semibold">Invoice Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-foreground font-semibold">{g.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{g.date}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{g.partyName}</td>
                  <td className="px-4 py-3">
                    {g.gstin ? (
                      <span className="font-mono text-xs font-bold tracking-wider text-foreground select-all">{g.gstin}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold',
                        g.type === 'B2B' && 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
                        g.type === 'B2C Small' && 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
                        g.type === 'B2C Large' && 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400',
                        g.type === 'Nil Rated' && 'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400',
                        g.type === 'Export' && 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      {g.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(g.taxable)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(g.cgst)}</td>
                  <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{formatCurrency(g.sgst)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(g.igst)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{formatCurrency(g.totalTax)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(g.invoiceValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 border-t border-border text-foreground font-bold text-xs">
                <td colSpan={5} className="px-4 py-3">
                  Total ({filtered.length} invoices)
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.taxable)}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(totals.cgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{formatCurrency(totals.sgst)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totals.igst)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.totalTax)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.invoiceValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
