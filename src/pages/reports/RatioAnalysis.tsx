import { useState, useEffect } from 'react'
import { formatCurrency } from '../../lib/utils'
import { fetchLiveFinancialData } from '../../lib/financialData'
import PrintHeader from '../../components/layout/PrintHeader'
import { Printer } from 'lucide-react'

type RatioGroup = {
  group: string
  items: Array<{ name: string; value: string; formula: string; good: boolean }>
}

export default function RatioAnalysis() {
  const [ratios, setRatios] = useState<RatioGroup[]>([])

  useEffect(() => {
    fetchLiveFinancialData().then((res) => {
      const sales = res.pnl.income.find(i => i.item.includes('Sales'))?.amount || 0
      const purchases = res.pnl.expenses.find(e => e.item.includes('Purchase'))?.amount || 0
      const totalExpenses = res.pnl.expenses.reduce((a, e) => a + e.amount, 0)
      const netProfit = sales - totalExpenses

      const cash = res.balanceSheet.assets.find(a => a.item === 'Cash in Hand')?.amount || 0
      const bank = res.balanceSheet.assets.find(a => a.item === 'Bank Balance')?.amount || 0
      const debtors = res.balanceSheet.assets.find(a => a.item === 'Sundry Debtors')?.amount || 0
      const stock = res.balanceSheet.assets.find(a => a.item === 'Closing Stock')?.amount || 0
      const currentAssets = cash + bank + debtors + stock

      const creditors = res.balanceSheet.liabilities.find(l => l.item === 'Sundry Creditors')?.amount || 0
      const gstPayable = res.balanceSheet.liabilities.find(l => l.item === 'GST Payable')?.amount || 0
      const currentLiabilities = creditors + gstPayable

      const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : (currentAssets > 0 ? '> 5.0' : '0.00')
      const quickAssets = cash + bank + debtors
      const quickRatio = currentLiabilities > 0 ? (quickAssets / currentLiabilities).toFixed(2) : (quickAssets > 0 ? '> 5.0' : '0.00')
      const netProfitMargin = sales > 0 ? `${((netProfit / sales) * 100).toFixed(1)}%` : '0.0%'

      setRatios([
        {
          group: 'Liquidity & Solvency Ratios',
          items: [
            { name: 'Current Ratio', value: currentRatio, formula: 'Current Assets / Current Liabilities', good: Number(currentRatio) >= 1.33 },
            { name: 'Quick Ratio (Acid Test)', value: quickRatio, formula: '(Cash + Bank + Debtors) / Current Liabilities', good: Number(quickRatio) >= 1.0 },
          ]
        },
        {
          group: 'Profitability Ratios',
          items: [
            { name: 'Net Profit Margin', value: netProfitMargin, formula: 'Net Profit / Net Sales Revenue', good: netProfit >= 0 },
            { name: 'Operating Cost Ratio', value: sales > 0 ? `${((purchases / sales) * 100).toFixed(1)}%` : '0.0%', formula: 'Purchase Cost / Sales Revenue', good: true }
          ]
        }
      ])
    })
  }, [])

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Financial Ratio Analysis" subtitle="Key financial health indicators derived from live ledger books" />
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ratio Analysis</h1>
          <p className="text-sm text-slate-400 mt-1">Financial health indicators | FY 2025-26</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-sm font-semibold shadow-xs transition border border-neutral-700 cursor-pointer"
        >
          <Printer size={15} /> Export PDF
        </button>
      </div>
      {ratios.map(g => (
        <div key={g.group} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80"><h3 className="text-sm font-semibold text-white">{g.group}</h3></div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {g.items.map(r => (<tr key={r.name} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                <td className="px-4 py-3 text-slate-500">{r.formula}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-lg"><span className={r.good ? 'text-emerald-400' : 'text-amber-400'}>{r.value}</span></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
