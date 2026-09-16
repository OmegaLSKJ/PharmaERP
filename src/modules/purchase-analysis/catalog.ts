export const REPORTS = [
  ['consolidated', 'Consolidated Purchase Book', 'Posted purchase bills and returns, reconciled to recorded header totals.'],
  ['purchases', 'Purchase Book', 'Line-level posted purchase bills with invoice-level reconciliations.'],
  ['returns', 'Purchase Return Book', 'Posted or processed purchase returns as negative values.'],
  ['misc', 'Misc. Purchase Report', 'Purchase-related documents recorded outside the purchase bill register.'],
  ['item-percent', 'Item Wise Purchase & %', 'Item totals and share of recorded purchase value.'],
  ['company-summary', 'Company Wise Purchase', 'Manufacturer totals using the item master.'],
  ['summary', 'Purchase Summary', 'Supplier summary of posted bills and returns.'],
  ['adjustments', 'P/R, Breakage / Expiry & Bill Adjustments', 'Explicit purchase returns, breakage, expiry and bill adjustments.'],
  ['discount', 'Item Discount Summary', 'Recorded item-line discounts only.'],
  ['monthly', 'Monthly Summaries', 'Monthly purchase totals including tax.'],
  ['item', 'Item Wise Purchase', 'Item-level quantities and value.'],
  ['company', 'Company Wise Purchase', 'Manufacturer-level quantities and value.'],
  ['party', 'Party Wise Purchase', 'Supplier-level quantities and value.'],
] as const
export type ReportId = typeof REPORTS[number][0]
