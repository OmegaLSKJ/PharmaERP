import { useState } from 'react'
import { Download, Percent, FileText, Upload } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

type TaxRow = {
  id: string
  type: string
  party: string
  gstin: string
  amount: number
  rate: number
  tax: number
  date: string
  status: 'paid' | 'due'
}

const TDS: TaxRow[] = [
  { id: 'TDS01', type: '194C - Contractors', party: 'Astra Biotech Services', gstin: '27AAAAA1111A1Z1', amount: 450000, rate: 2, tax: 9000, date: '2026-08-01', status: 'paid' },
  { id: 'TDS02', type: '194J - Professional Services', party: 'Dr. Mehta Diagnostics', gstin: '27BBBBB2222B2Z2', amount: 120000, rate: 10, tax: 12000, date: '2026-08-05', status: 'due' },
  { id: 'TDS03', type: '194I - Rent', party: 'Narayana Realty Corp', gstin: '27CCCCC3333C3Z3', amount: 80000, rate: 10, tax: 8000, date: '2026-08-10', status: 'paid' },
  { id: 'TDS04', type: '194Q - Purchase of Goods', party: 'Cipla Wholesales Inc', gstin: '27DDDDD4444D4Z4', amount: 1500000, rate: 0.1, tax: 1500, date: '2026-08-12', status: 'due' }
]

const TCS: TaxRow[] = [
  { id: 'TCS01', type: '206C(1H) - Sale of Goods', party: 'Apollo Pharmacies Ltd', gstin: '27EEEEE5555E5Z5', amount: 2800000, rate: 0.1, tax: 2800, date: '2026-08-02', status: 'paid' },
  { id: 'TCS02', type: '206C(1) - Alcoholic Liquor', party: 'Alpha Distributors Ltd', gstin: '27FFFFF6666F6Z6', amount: 350000, rate: 1, tax: 3500, date: '2026-08-07', status: 'due' }
]

export default function TdsTcs() {
  const [tab, setTab] = useState<'tds' | 'tcs'>('tds')
  const rows = tab === 'tds' ? TDS : TCS
  const totalTax = rows.reduce((a, r) => a + r.tax, 0)

  // Download official Gov Upload text file (NSDL FVU Structure)
  const downloadGovFormat = () => {
    const header = `FH^TDS^2026-08-26^${tab === 'tds' ? '26Q' : '27EQ'}^1^Borgang Drug Distributors^27AABCP1234F1Z5^\r\n`
    const batch = `BH^1^${rows.length}^0.00^0.00^${totalTax.toFixed(2)}^0.00^0.00^\r\n`
    const records = rows.map((r, i) => (
      `DD^${i + 1}^${r.id}^${r.type.split(' ')[0]}^${r.party}^${r.gstin}^${r.amount.toFixed(2)}^${r.rate.toFixed(2)}^${r.tax.toFixed(2)}^${r.status === 'paid' ? 'Y' : 'N'}^\r\n`
    )).join('')
    const content = header + batch + records
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${tab.toUpperCase()}_NSDL_FVU_Q2_2025-26.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="TDS / TCS Register" />
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TDS / TCS</h1>
          <p className="text-sm text-muted-foreground mt-1">Deductee &amp; collector ledger | FY 2025-26</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={downloadGovFormat}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-md transition border border-emerald-500/20"
            title="Download NSDL FVU file for Government portal upload"
          >
            <Upload size={16} /> Export Gov Format (FVU)
          </button>
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('tds-tcs-register', useUIStore.getState().company))}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: tab === 'tds' ? 'Total Deducted' : 'Total Collected', v: formatCurrency(totalTax), c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Entries', v: String(rows.length), c: 'text-foreground' },
          { l: 'Pending Payment', v: formatCurrency(rows.filter((r) => r.status === 'due').reduce((a, r) => a + r.tax, 0)), c: 'text-amber-600 dark:text-amber-400' }
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">{s.l}</div>
            <div className={cn('text-xl font-bold mt-1', s.c)}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-1 bg-secondary/60 border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('tds')}
          className={cn(
            'px-5 py-2 rounded-md text-sm font-semibold transition-all duration-150',
            tab === 'tds' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          TDS Register
        </button>
        <button
          onClick={() => setTab('tcs')}
          className={cn(
            'px-5 py-2 rounded-md text-sm font-semibold transition-all duration-150',
            tab === 'tcs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          TCS Register
        </button>
      </div>

      {/* Ledger Table Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Type</th>
              <th className="text-left px-4 py-3 font-semibold">Party</th>
              <th className="text-left px-4 py-3 font-semibold">GSTIN</th>
              <th className="text-right px-4 py-3 font-semibold">Base Amount</th>
              <th className="text-right px-4 py-3 font-semibold w-16">
                <Percent size={11} className="inline mr-1" />
                Rate
              </th>
              <th className="text-right px-4 py-3 font-semibold">{tab === 'tds' ? 'Deducted' : 'Collected'}</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.type}</td>
                <td className="px-4 py-2.5 text-foreground">{r.party}</td>
                 <td className="px-4 py-2.5">
                   <span className="font-mono text-xs font-bold tracking-wider text-foreground select-all">
                     {r.gstin}
                   </span>
                 </td>
                <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(r.amount)}</td>
                <td className="px-4 py-2.5 text-right">{r.rate}%</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatCurrency(r.tax)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold capitalize',
                    r.status === 'paid'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  )}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
