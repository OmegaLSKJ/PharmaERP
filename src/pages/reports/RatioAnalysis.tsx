import { formatCurrency } from '../../lib/utils'

const RATIOS = [
  { group: 'Liquidity Ratios', items: [
    { name: 'Current Ratio', value: '2.14', formula: 'Current Assets / Current Liabilities', good: true },
    { name: 'Quick Ratio', value: '1.68', formula: '(CA - Stock) / Current Liabilities', good: true },
    { name: 'Cash Ratio', value: '1.13', formula: 'Cash + Bank / Current Liabilities', good: true },
  ]},
  { group: 'Profitability Ratios', items: [
    { name: 'Gross Profit Margin', value: '19.8%', formula: 'Gross Profit / Net Sales', good: false },
    { name: 'Net Profit Margin', value: '12.9%', formula: 'Net Profit / Net Sales', good: true },
    { name: 'Return on Capital', value: '32.0%', formula: 'Net Profit / Capital Employed', good: true },
  ]},
  { group: 'Efficiency Ratios', items: [
    { name: 'Stock Turnover', value: '5.2x', formula: 'Cost of Goods / Avg Stock', good: true },
    { name: 'Debtors Turnover', value: '4.2x', formula: 'Credit Sales / Avg Debtors', good: false },
    { name: 'Avg Collection Days', value: '87 days', formula: '365 / Debtors Turnover', good: false },
  ]},
  { group: 'Solvency Ratios', items: [
    { name: 'Debt-Equity Ratio', value: '0.00x', formula: 'Total Debt / Shareholders Equity', good: true },
    { name: 'Interest Coverage', value: 'N/A', formula: 'EBIT / Interest Expense', good: true },
  ]},
]

export default function RatioAnalysis() {
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Ratio Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">Financial health indicators | FY 2025-26</p></div>
      {RATIOS.map(g => (
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
