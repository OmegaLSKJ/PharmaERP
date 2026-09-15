export type InvoiceLineInput = { qty: number; rate: number; discount?: number; gstRate?: number }
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateInvoice(lines: InvoiceLineInput[]) {
  const calculatedLines = lines.map((line) => {
    if (line.qty < 0 || line.rate < 0) throw new Error('Quantity and rate cannot be negative.')
    const discountRate = line.discount ?? 0, gstRate = line.gstRate ?? 0
    if (discountRate < 0 || discountRate > 100 || gstRate < 0 || gstRate > 100) throw new Error('Discount and GST must be between 0 and 100.')
    const gross = money(line.qty * line.rate)
    const discount = money(gross * discountRate / 100)
    const taxable = money(gross - discount)
    const tax = money(taxable * gstRate / 100)
    return { gross, discount, taxable, tax, total: money(taxable + tax) }
  })
  const subtotal = money(calculatedLines.reduce((sum, line) => sum + line.gross, 0))
  const discountTotal = money(calculatedLines.reduce((sum, line) => sum + line.discount, 0))
  const taxTotal = money(calculatedLines.reduce((sum, line) => sum + line.tax, 0))
  const unroundedTotal = money(calculatedLines.reduce((sum, line) => sum + line.total, 0))
  const grandTotal = Math.round(unroundedTotal)
  return { lines: calculatedLines, subtotal, discountTotal, taxTotal, unroundedTotal, roundingAdjustment: money(grandTotal - unroundedTotal), grandTotal }
}
