import { useState, useEffect } from 'react'
import { Download, FileText } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { fetchLiveFinancialData, type BalanceSheetData } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import PrintButton from '../../components/common/PrintButton'
import { useUIStore } from '../../store/uiStore'

export default function BalanceSheet() {
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData>({ assets: [], liabilities: [] })

  useEffect(() => {
    fetchLiveFinancialData().then((res) => setBalanceSheet(res.balanceSheet))
  }, [])

  const totalAssets = balanceSheet.assets.reduce((a, i) => a + i.amount, 0)
  const totalLiabilities = balanceSheet.liabilities.reduce((a, i) => a + i.amount, 0)
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <PrintHeader title="Balance Sheet" subtitle="As on 31st March 2026" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Balance Sheet</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">As on 31st March 2026</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton
            label="Export PDF"
            autoOrientationHint="portrait"
            className="no-print"
          />
          <button
            onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('balance-sheet', useUIStore.getState().company))}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-primary/20 cursor-pointer"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-blue-600 dark:text-blue-400">
            Assets
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[300px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                  <th className="text-left px-4 py-2 font-semibold">Asset Particulars</th>
                  <th className="text-right px-4 py-2 font-semibold w-48">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {balanceSheet.assets.map((i) => (
                  <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 pl-6 text-foreground">{i.item}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">
                      {formatCurrency(i.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30 font-bold border-t border-border">
                  <td className="px-4 py-3 text-foreground">Total Assets</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {formatCurrency(totalAssets)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Liabilities Card Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="text-sm font-semibold uppercase px-4 py-3 bg-secondary/50 border-b border-border text-purple-600 dark:text-purple-400">
            Liabilities &amp; Capital
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[300px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider bg-secondary/20">
                  <th className="text-left px-4 py-2 font-semibold">Liability Particulars</th>
                  <th className="text-right px-4 py-2 font-semibold w-48">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {balanceSheet.liabilities.map((i) => (
                  <tr key={i.item} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 pl-6 text-foreground">{i.item}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">
                      {formatCurrency(i.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30 font-bold border-t border-border">
                  <td className="px-4 py-3 text-foreground">Total Liabilities &amp; Capital</td>
                  <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">
                    {formatCurrency(totalLiabilities)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Balancing Status Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm p-4 text-center">
        <span className={cn(
          'font-bold text-sm',
          totalAssets === totalLiabilities ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        )}>
          {totalAssets === totalLiabilities
            ? 'Balance Sheet is Balanced'
            : 'Difference: ' + formatCurrency(Math.abs(totalAssets - totalLiabilities))}
        </span>
      </div>
    </div>
  )
}
