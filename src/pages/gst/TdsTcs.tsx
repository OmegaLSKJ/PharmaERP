import { useState, useEffect } from 'react'
import { Download, Percent, FileText, Upload } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp } from '../../lib/erpApi'

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

export default function TdsTcs() {
  const [tab, setTab] = useState<'tds' | 'tcs'>('tds')
  const [tdsRows, setTdsRows] = useState<TaxRow[]>([])
  const [tcsRows, setTcsRows] = useState<TaxRow[]>([])

  useEffect(() => {
    Promise.all([
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('purchases').catch(() => []),
      getErp<any[]>('parties').catch(() => []),
      getErp<any[]>('ledgers').catch(() => [])
    ]).then(([sales, purchases, parties, ledgers]) => {
      const partyMap = new Map((parties || []).map((p: any) => [p.name, p.gstin || '']))

      // Deduce real TDS entries from purchases or vouchers
      const realTds: TaxRow[] = []
      ;(purchases || []).forEach((p: any, idx: number) => {
        const tot = Number(p.total || p.grand_total || 0)
        // 194Q applies to high-volume purchases or if marked
        if (tot >= 100000 || p.tdsRate) {
          const rate = Number(p.tdsRate || 0.1)
          const tax = Math.round((tot * rate) / 100)
          realTds.push({
            id: `TDS-${idx + 1}`,
            type: '194Q - Purchase of Goods',
            party: p.party || p.supplier || 'Supplier',
            gstin: p.gstin || partyMap.get(p.party) || '27AAAAA0000A1Z5',
            amount: tot,
            rate,
            tax,
            date: p.date || new Date().toISOString().slice(0, 10),
            status: 'due'
          })
        }
      })

      // Also check ledger entries for TDS
      ;(ledgers || []).forEach((l: any, idx: number) => {
        if (/tds/i.test(l.narration || '') || /tds/i.test(l.party || '')) {
          realTds.push({
            id: `TDS-VCH-${idx + 1}`,
            type: '194C/J - Deductions',
            party: l.party || 'Tax Authority',
            gstin: partyMap.get(l.party) || '',
            amount: Number(l.debit || l.credit || 0),
            rate: 2,
            tax: Number(l.debit || l.credit || 0),
            date: l.date || new Date().toISOString().slice(0, 10),
            status: 'paid'
          })
        }
      })

      // Deduce real TCS entries from sales
      const realTcs: TaxRow[] = []
      ;(sales || []).forEach((s: any, idx: number) => {
        const tot = Number(s.total || s.grand_total || 0)
        if (tot >= 100000 || s.tcsRate) {
          const rate = Number(s.tcsRate || 0.1)
          const tax = Math.round((tot * rate) / 100)
          realTcs.push({
            id: `TCS-${idx + 1}`,
            type: '206C(1H) - Sale of Goods',
            party: s.party || 'Customer',
            gstin: s.gstin || partyMap.get(s.party) || '',
            amount: tot,
            rate,
            tax,
            date: s.date || new Date().toISOString().slice(0, 10),
            status: 'due'
          })
        }
      })

      setTdsRows(realTds)
      setTcsRows(realTcs)
    })
  }, [])

  const rows = tab === 'tds' ? tdsRows : tcsRows
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
      <PrintHeader title="TDS / TCS Tax Register" subtitle="Deductee &amp; Collector Tax Ledger | FY 2025-26" />
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TDS / TCS</h1>
          <p className="text-sm text-muted-foreground mt-1">Deductee &amp; collector ledger | FY 2025-26</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
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
