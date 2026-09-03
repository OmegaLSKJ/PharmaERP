import { getErp } from './erpApi'

export interface TrialBalanceItem {
  ledger: string
  group: string
  debit: number
  credit: number
}

export interface PnLData {
  income: Array<{ item: string; amount: number }>
  expenses: Array<{ item: string; amount: number }>
}

export interface BalanceSheetData {
  assets: Array<{ item: string; amount: number }>
  liabilities: Array<{ item: string; amount: number }>
}

export interface CashFlowData {
  operating: Array<{ item: string; inflow: number; outflow: number }>
  investing: Array<{ item: string; inflow: number; outflow: number }>
  financing: Array<{ item: string; inflow: number; outflow: number }>
}

export const trialBalance: TrialBalanceItem[] = []

export const pnl: PnLData = {
  income: [],
  expenses: []
}

export const balanceSheet: BalanceSheetData = {
  assets: [],
  liabilities: []
}

export const cashFlow: CashFlowData = {
  operating: [],
  investing: [],
  financing: []
}

export async function fetchLiveFinancialData(): Promise<{
  trialBalance: TrialBalanceItem[]
  pnl: PnLData
  balanceSheet: BalanceSheetData
  cashFlow: CashFlowData
}> {
  const [accounts, parties, sales, purchases, items, vouchers] = await Promise.all([
    getErp<any[]>('accounts').catch(() => []),
    getErp<any[]>('parties').catch(() => []),
    getErp<any[]>('sales').catch(() => []),
    getErp<any[]>('purchases').catch(() => []),
    getErp<any[]>('items').catch(() => []),
    getErp<any[]>('vouchers').catch(() => [])
  ])

  // 1. Trial Balance calculation
  const tb: TrialBalanceItem[] = []

  // Bank & Cash accounts
  let cashBalance = 0
  let bankBalance = 0
  ;(accounts || []).forEach((acc: any) => {
    const bal = Number(acc.balance || 0)
    const isDr = acc.type === 'Dr' || bal >= 0
    const absVal = Math.abs(bal)
    tb.push({
      ledger: acc.name || acc.code,
      group: acc.group || (acc.name?.toLowerCase().includes('bank') ? 'Bank' : 'Cash'),
      debit: isDr ? absVal : 0,
      credit: !isDr ? absVal : 0
    })
    if (acc.group === 'Cash-in-hand' || acc.name?.toLowerCase().includes('cash')) {
      cashBalance += isDr ? absVal : -absVal
    } else {
      bankBalance += isDr ? absVal : -absVal
    }
  })

  // Sundry Debtors & Creditors
  let totalDebtors = 0
  let totalCreditors = 0
  ;(parties || []).forEach((p: any) => {
    const bal = Number(p.balance || 0)
    if (bal !== 0) {
      const isDebtor = p.type === 'customer' || bal > 0
      const absBal = Math.abs(bal)
      tb.push({
        ledger: p.name,
        group: isDebtor ? 'Sundry Debtors' : 'Sundry Creditors',
        debit: isDebtor ? absBal : 0,
        credit: !isDebtor ? absBal : 0
      })
      if (isDebtor) totalDebtors += absBal
      else totalCreditors += absBal
    }
  })

  // Sales and Output GST
  let totalSalesRev = 0
  let totalOutputTax = 0
  ;(sales || []).forEach((s: any) => {
    const tot = Number(s.total || s.grand_total || 0)
    const taxable = tot / 1.12
    const tax = tot - taxable
    totalSalesRev += taxable
    totalOutputTax += tax
  })

  if (totalSalesRev > 0) {
    tb.push({ ledger: 'Sales Account', group: 'Sales', debit: 0, credit: Math.round(totalSalesRev) })
    tb.push({ ledger: 'GST Output CGST', group: 'Tax', debit: 0, credit: Math.round(totalOutputTax / 2) })
    tb.push({ ledger: 'GST Output SGST', group: 'Tax', debit: 0, credit: Math.round(totalOutputTax / 2) })
  }

  // Purchases and Input GST
  let totalPurchasesCost = 0
  let totalInputTax = 0
  ;(purchases || []).forEach((p: any) => {
    const tot = Number(p.total || p.grand_total || 0)
    const taxable = tot / 1.12
    const tax = tot - taxable
    totalPurchasesCost += taxable
    totalInputTax += tax
  })

  if (totalPurchasesCost > 0) {
    tb.push({ ledger: 'Purchase Account', group: 'Purchase', debit: Math.round(totalPurchasesCost), credit: 0 })
    tb.push({ ledger: 'GST Input CGST', group: 'Tax', debit: Math.round(totalInputTax / 2), credit: 0 })
    tb.push({ ledger: 'GST Input SGST', group: 'Tax', debit: Math.round(totalInputTax / 2), credit: 0 })
  }

  // Vouchers / Other Expenses
  let totalExpenses = 0
  ;(vouchers || []).forEach((v: any) => {
    const amt = Number(v.amount || 0)
    if (amt > 0 && v.voucher_type === 'payment') {
      totalExpenses += amt
      tb.push({
        ledger: v.narration || 'General Expense',
        group: 'Expense',
        debit: amt,
        credit: 0
      })
    }
  })

  // Closing inventory stock valuation
  let closingStockVal = 0
  ;(items || []).forEach((item: any) => {
    const st = Number(item.stock || 0)
    const rate = Number(item.purchaseRate || item.saleRate || 0)
    closingStockVal += st * rate
  })

  // 2. Profit & Loss (Trading and Profit & Loss Account)
  // In standard accounting, Closing Stock is credited to Income (Trading Account),
  // offsetting inward purchases so that only the actual Cost of Goods Sold impacts profit.
  const pnlResult: PnLData = {
    income: [
      { item: 'Sales Revenue', amount: Math.round(totalSalesRev) }
    ],
    expenses: [
      { item: 'Gross Purchases (Inward Stock)', amount: Math.round(totalPurchasesCost) }
    ]
  }

  if (closingStockVal > 0) {
    pnlResult.income.push({ item: 'Closing Stock (Inventory on Hand)', amount: Math.round(closingStockVal) })
  }

  if (totalExpenses > 0) {
    pnlResult.expenses.push({ item: 'Operating & Admin Expenses', amount: Math.round(totalExpenses) })
  }

  const totalTradingIncome = totalSalesRev + closingStockVal
  const totalTradingExpenses = totalPurchasesCost + totalExpenses
  const netProfit = Math.round(totalTradingIncome - totalTradingExpenses)

  // 3. Balance Sheet
  const netGstPayable = Math.max(0, Math.round(totalOutputTax - totalInputTax))
  const capital = Math.max(0, Math.round((cashBalance + bankBalance + totalDebtors + closingStockVal) - (totalCreditors + netGstPayable)))

  const bsResult: BalanceSheetData = {
    assets: [
      { item: 'Cash in Hand', amount: Math.max(0, Math.round(cashBalance)) },
      { item: 'Bank Balance', amount: Math.max(0, Math.round(bankBalance)) },
      { item: 'Sundry Debtors', amount: Math.round(totalDebtors) },
      { item: 'Closing Stock', amount: Math.round(closingStockVal) },
    ],
    liabilities: [
      { item: 'Sundry Creditors', amount: Math.round(totalCreditors) },
      { item: 'GST Payable', amount: netGstPayable },
      { item: 'Capital & Reserves', amount: capital },
    ]
  }

  // 4. Cash Flow
  const cfResult: CashFlowData = {
    operating: [
      { item: 'Net Operational Profit', inflow: netProfit > 0 ? netProfit : 0, outflow: netProfit < 0 ? Math.abs(netProfit) : 0 },
      { item: 'Debtors Movement', inflow: 0, outflow: Math.round(totalDebtors) },
      { item: 'Creditors Movement', inflow: Math.round(totalCreditors), outflow: 0 },
      { item: 'Inventory Movement', inflow: 0, outflow: Math.round(closingStockVal) },
    ],
    investing: [],
    financing: []
  }

  return {
    trialBalance: tb,
    pnl: pnlResult,
    balanceSheet: bsResult,
    cashFlow: cfResult
  }
}
