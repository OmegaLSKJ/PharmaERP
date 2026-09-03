import { useState, useEffect } from 'react'
import { FileText, Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { fetchLiveFinancialData, type TrialBalanceItem, type PnLData, type BalanceSheetData } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

export default function FinancialReports() {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceItem[]>([])
  const [pnlData, setPnlData] = useState<PnLData>({ income: [], expenses: [] })
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData>({ assets: [], liabilities: [] })

  useEffect(() => {
    fetchLiveFinancialData().then((res) => {
      setTrialBalance(res.trialBalance)
      setPnlData(res.pnl)
      setBalanceSheet(res.balanceSheet)
    })
  }, [])

  const totalDr = trialBalance.reduce((a, r) => a + r.debit, 0)
  const totalCr = trialBalance.reduce((a, r) => a + r.credit, 0)

  const totalIncome = pnlData.income.reduce((a, r) => a + r.amount, 0)
  const totalExpense = pnlData.expenses.reduce((a, r) => a + r.amount, 0)
  const netProfit = totalIncome - totalExpense

  const totalAssets = balanceSheet.assets.reduce((a, r) => a + r.amount, 0)
  const totalLiabilities = balanceSheet.liabilities.reduce((a, r) => a + r.amount, 0)

  return (
    <div className="p-6 space-y-5">
      <PrintHeader title="Financial Statements" />
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">FY 2025-26 | Trial Balance, P&L, Balance Sheet</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border">
            <FileText size={16} /> Export PDF
          </button>
          <button onClick={() => import('../../lib/download').then(({ exportVisibleTables }) => exportVisibleTables('financial-report', useUIStore.getState().company))} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Trial Balance Statement */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Trial Balance</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Ledger</th>
              <th className="text-left px-4 py-3 font-semibold">Group</th>
              <th className="text-right px-4 py-3 font-semibold w-32">Debit</th>
              <th className="text-right px-4 py-3 font-semibold w-32">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {trialBalance.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.ledger}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.group}</td>
                <td className="px-4 py-2.5 text-right font-mono">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary/30 border-t border-b-2 border-border text-foreground font-bold">
              <td colSpan={2} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalDr)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="px-4 py-2.5 text-right border-t border-border bg-secondary/10">
          <span className={cn('text-xs font-bold', totalDr === totalCr ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {totalDr === totalCr ? 'Balanced' : 'Difference: ' + formatCurrency(Math.abs(totalDr - totalCr))}
          </span>
        </div>
      </div>

      {/* Profit & Loss and Balance Sheet Statements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* P&L statement */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-semibold text-foreground">Profit & Loss Statement</h3>
          </div>
          <div className="p-4 space-y-5">
            <div>
              <div className="border-l-2 border-emerald-500 pl-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-2">Income</div>
              {pnlData.income.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-b-0">
                  <span className="text-muted-foreground">{i.item}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(i.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5 mt-1.5">
                <span className="text-foreground">Total Income</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome)}</span>
              </div>
            </div>
            <div>
              <div className="border-l-2 border-rose-500 pl-2 text-xs text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider mb-2">Expenses</div>
              {pnlData.expenses.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-b-0">
                  <span className="text-muted-foreground">{i.item}</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">{formatCurrency(i.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5 mt-1.5">
                <span className="text-foreground">Total Expenses</span>
                <span className="font-mono text-rose-600 dark:text-rose-400">{formatCurrency(totalExpense)}</span>
              </div>
            </div>
            <div className={cn('flex justify-between text-lg font-bold border-t border-b-2 border-border pt-2 pb-1.5', netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              <span>Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
              <span className="font-mono">{formatCurrency(Math.abs(netProfit))}</span>
            </div>
          </div>
        </div>

        {/* Balance sheet */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-semibold text-foreground">Balance Sheet</h3>
          </div>
          <div className="p-4 space-y-5">
            <div>
              <div className="border-l-2 border-blue-500 pl-2 text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-2">Assets</div>
              {balanceSheet.assets.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-b-0">
                  <span className="text-muted-foreground">{i.item}</span>
                  <span className="font-mono text-foreground">{formatCurrency(i.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-b-2 border-border pt-1.5 pb-1.5 mt-1.5">
                <span className="text-foreground">Total Assets</span>
                <span className="font-mono text-foreground">{formatCurrency(totalAssets)}</span>
              </div>
            </div>
            <div>
              <div className="border-l-2 border-purple-500 pl-2 text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-2">Liabilities & Capital</div>
              {balanceSheet.liabilities.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-b-0">
                  <span className="text-muted-foreground">{i.item}</span>
                  <span className="font-mono text-foreground">{formatCurrency(i.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-b-2 border-border pt-1.5 pb-1.5 mt-1.5">
                <span className="text-foreground">Total Liabilities</span>
                <span className="font-mono text-foreground">{formatCurrency(totalLiabilities)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-Only Signature & Sign-Off Section */}
      <div className="hidden print:flex justify-between mt-12 pt-10 border-t border-border/60 text-xs text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Prepared By</p>
          <p className="mt-10 border-t border-dashed border-border/80 pt-1 w-36">Accounts Manager</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-foreground">Authorized Signatory</p>
          <p className="mt-10 border-t border-dashed border-border/80 pt-1 w-36 inline-block">Partner / Director</p>
        </div>
      </div>
    </div>
  )
}
