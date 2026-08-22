import { Download } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'

const trialBalance = [
  { ledger: 'Cash in Hand', group: 'Cash', debit: 350000, credit: 0 },
  { ledger: 'HDFC Bank Current', group: 'Bank', debit: 2840000, credit: 0 },
  { ledger: 'MediCare Pharma', group: 'Sundry Debtors', debit: 78000, credit: 0 },
  { ledger: 'HealthFirst Distributors', group: 'Sundry Debtors', debit: 0, credit: 45000 },
  { ledger: 'CareWell Pharmacy', group: 'Sundry Debtors', debit: 78000, credit: 0 },
  { ledger: 'Sun Pharma Industries', group: 'Sundry Creditors', debit: 0, credit: 515000 },
  { ledger: 'Cipla Ltd', group: 'Sundry Creditors', debit: 0, credit: 560000 },
  { ledger: 'Dr. Reddy Labs', group: 'Sundry Creditors', debit: 0, credit: 180000 },
  { ledger: 'Sales Account', group: 'Sales', debit: 0, credit: 8100000 },
  { ledger: 'Purchase Account', group: 'Purchase', debit: 6500000, credit: 0 },
  { ledger: 'GST Output CGST', group: 'Tax', debit: 0, credit: 486000 },
  { ledger: 'GST Output SGST', group: 'Tax', debit: 0, credit: 486000 },
  { ledger: 'Salary Account', group: 'Expense', debit: 1200000, credit: 0 },
  { ledger: 'Rent Expense', group: 'Expense', debit: 300000, credit: 0 },
  { ledger: 'Discount Received', group: 'Income', debit: 0, credit: 85000 },
  { ledger: 'Freight Charges', group: 'Expense', debit: 45000, credit: 0 },
]

const pnlData = {
  income: [
    { item: 'Sales Revenue', amount: 8100000 },
    { item: 'Discount Received', amount: 85000 },
    { item: 'Other Income', amount: 25000 },
  ],
  expenses: [
    { item: 'Purchase Cost', amount: 6500000 },
    { item: 'Salary', amount: 1200000 },
    { item: 'Rent', amount: 300000 },
    { item: 'Freight', amount: 45000 },
    { item: 'Other Expenses', amount: 60000 },
  ],
}

const balanceSheet = {
  assets: [
    { item: 'Cash in Hand', amount: 350000 },
    { item: 'Bank Balance', amount: 2840000 },
    { item: 'Sundry Debtors', amount: 156000 },
    { item: 'Closing Stock', amount: 1250000 },
  ],
  liabilities: [
    { item: 'Sundry Creditors', amount: 1255000 },
    { item: 'GST Payable', amount: 972000 },
    { item: 'Capital Account', amount: 2369000 },
  ],
}

export default function FinancialReports() {
  const totalDr = trialBalance.reduce((a, r) => a + r.debit, 0)
  const totalCr = trialBalance.reduce((a, r) => a + r.credit, 0)
  const totalIncome = pnlData.income.reduce((a, i) => a + i.amount, 0)
  const totalExpense = pnlData.expenses.reduce((a, i) => a + i.amount, 0)
  const netProfit = totalIncome - totalExpense
  const totalAssets = balanceSheet.assets.reduce((a, i) => a + i.amount, 0)
  const totalLiabilities = balanceSheet.liabilities.reduce((a, i) => a + i.amount, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Financial Reports</h1>
          <p className="text-sm text-slate-400 mt-1">FY 2025-26 | Trial Balance, P&L, Balance Sheet</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700">
          <Download size={16} /> Export PDF
        </button>
      </div>

      {/* Trial Balance */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <h3 className="text-sm font-semibold text-white">Trial Balance</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Ledger</th>
              <th className="text-left px-4 py-3 font-medium">Group</th>
              <th className="text-right px-4 py-3 font-medium">Debit</th>
              <th className="text-right px-4 py-3 font-medium">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {trialBalance.map((r, i) => (
              <tr key={i} className="hover:bg-slate-900/30">
                <td className="px-4 py-2 font-medium text-white">{r.ledger}</td>
                <td className="px-4 py-2 text-slate-400">{r.group}</td>
                <td className="px-4 py-2 text-right font-mono">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                <td className="px-4 py-2 text-right font-mono">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold">
              <td colSpan={2} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalDr)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="px-4 py-2 text-right">
          <span className={cn('text-xs font-bold', totalDr === totalCr ? 'text-emerald-400' : 'text-rose-400')}>
            {totalDr === totalCr ? 'Balanced' : 'Difference: ' + formatCurrency(Math.abs(totalDr - totalCr))}
          </span>
        </div>
      </div>

      {/* Profit & Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <h3 className="text-sm font-semibold text-white">Profit & Loss Statement</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-emerald-400 font-semibold uppercase mb-2">Income</div>
              {pnlData.income.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1"><span className="text-slate-300">{i.item}</span><span className="font-mono text-emerald-400">{formatCurrency(i.amount)}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-1 mt-1"><span className="text-white">Total Income</span><span className="font-mono text-emerald-400">{formatCurrency(totalIncome)}</span></div>
            </div>
            <div>
              <div className="text-xs text-rose-400 font-semibold uppercase mb-2">Expenses</div>
              {pnlData.expenses.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1"><span className="text-slate-300">{i.item}</span><span className="font-mono text-rose-400">{formatCurrency(i.amount)}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-1 mt-1"><span className="text-white">Total Expenses</span><span className="font-mono text-rose-400">{formatCurrency(totalExpense)}</span></div>
            </div>
            <div className={cn('flex justify-between text-lg font-bold border-t-2 border-slate-600 pt-2', netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              <span>Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
              <span>{formatCurrency(Math.abs(netProfit))}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <h3 className="text-sm font-semibold text-white">Balance Sheet</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-blue-400 font-semibold uppercase mb-2">Assets</div>
              {balanceSheet.assets.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1"><span className="text-slate-300">{i.item}</span><span className="font-mono text-slate-300">{formatCurrency(i.amount)}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-1 mt-1"><span className="text-white">Total Assets</span><span className="font-mono text-white">{formatCurrency(totalAssets)}</span></div>
            </div>
            <div>
              <div className="text-xs text-purple-400 font-semibold uppercase mb-2">Liabilities & Capital</div>
              {balanceSheet.liabilities.map(i => (
                <div key={i.item} className="flex justify-between text-sm py-1"><span className="text-slate-300">{i.item}</span><span className="font-mono text-slate-300">{formatCurrency(i.amount)}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-1 mt-1"><span className="text-white">Total Liabilities</span><span className="font-mono text-white">{formatCurrency(totalLiabilities)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
