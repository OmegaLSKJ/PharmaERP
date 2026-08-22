export const trialBalance = [
  { ledger: 'Cash in Hand', group: 'Cash', debit: 350000, credit: 0 },
  { ledger: 'HDFC Bank Current', group: 'Bank', debit: 2840000, credit: 0 },
  { ledger: 'MediCare Pharma', group: 'Sundry Debtors', debit: 78000, credit: 0 },
  { ledger: 'HealthFirst Distributors', group: 'Sundry Debtors', debit: 0, credit: 45000 },
  { ledger: 'CareWell Pharmacy', group: 'Sundry Debtors', debit: 78000, credit: 0 },
  { ledger: 'Sun Pharma Industries', group: 'Sundry Creditors', debit: 0, credit: 515000 },
  { ledger: 'Cipla Ltd', group: 'Sundry Creditors', debit: 0, credit: 560000 },
  { ledger: "Dr. Reddy's Labs", group: 'Sundry Creditors', debit: 0, credit: 180000 },
  { ledger: 'Sales Account', group: 'Sales', debit: 0, credit: 8100000 },
  { ledger: 'Purchase Account', group: 'Purchase', debit: 6500000, credit: 0 },
  { ledger: 'GST Output CGST', group: 'Tax', debit: 0, credit: 486000 },
  { ledger: 'GST Output SGST', group: 'Tax', debit: 0, credit: 486000 },
  { ledger: 'Salary Account', group: 'Expense', debit: 1200000, credit: 0 },
  { ledger: 'Rent Expense', group: 'Expense', debit: 300000, credit: 0 },
  { ledger: 'Discount Received', group: 'Income', debit: 0, credit: 85000 },
  { ledger: 'Freight Charges', group: 'Expense', debit: 45000, credit: 0 },
]

export const pnl = {
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

export const balanceSheet = {
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

export const cashFlow = {
  operating: [
    { item: 'Net Profit before tax', inflow: 1105000, outflow: 0 },
    { item: 'Depreciation add-back', inflow: 85000, outflow: 0 },
    { item: 'Increase in Debtors', inflow: 0, outflow: 156000 },
    { item: 'Increase in Creditors', inflow: 1255000, outflow: 0 },
    { item: 'Increase in Stock', inflow: 0, outflow: 1250000 },
    { item: 'Tax Paid', inflow: 0, outflow: 320000 },
  ],
  investing: [
    { item: 'Purchase of Furniture', inflow: 0, outflow: 120000 },
    { item: 'Interest Received', inflow: 15000, outflow: 0 },
  ],
  financing: [
    { item: 'Capital Introduced', inflow: 500000, outflow: 0 },
    { item: 'Drawings', inflow: 0, outflow: 200000 },
  ],
}
