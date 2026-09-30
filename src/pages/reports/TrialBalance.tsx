import { useState, useEffect } from 'react'
import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { fetchLiveFinancialData, type TrialBalanceItem } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import PrintButton from '../../components/common/PrintButton'
import { useUIStore } from '../../store/uiStore'

export default function TrialBalance() {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceItem[]>([])

  useEffect(() => {
    fetchLiveFinancialData().then((res) => setTrialBalance(res.trialBalance))
  }, [])

  const totalDr = trialBalance.reduce((a, r) => a + r.debit, 0)
  const totalCr = trialBalance.reduce((a, r) => a + r.credit, 0)
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <PrintHeader title="Trial Balance" subtitle="FY 2025-26 | As on 31st March 2026" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Trial Balance</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">FY 2025-26 | As on 31st March 2026</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton
            label="Export PDF"
            autoOrientationHint="portrait"
            className="no-print"
          />
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('trial-balance', useUIStore.getState().company))}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-primary/20 cursor-pointer"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Ledger</th>
                <th className="text-left px-4 py-3 font-semibold">Group</th>
                <th className="text-right px-4 py-3 font-semibold w-36">Debit</th>
                <th className="text-right px-4 py-3 font-semibold w-36">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {trialBalance.map((r, i) => (
                <tr key={i} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.ledger}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.group}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 border-t border-border text-foreground font-bold">
                <td colSpan={2} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalDr)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalCr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2.5 text-right border-t border-border bg-secondary/10">
          <span className={cn('text-xs font-bold', totalDr === totalCr ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {totalDr === totalCr ? 'Balanced' : 'Difference: ' + formatCurrency(Math.abs(totalDr - totalCr))}
          </span>
        </div>
      </div>
    </div>
  )
}
