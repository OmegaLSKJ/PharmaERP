import type { Cell, Filters, PurchaseData, ReportColumn, ReportRow } from './types'
import type { ReportId } from './catalog'
import { round } from './normalize'

const col = (key: string, label: string): ReportColumn => ({ key, label })
const money = (key: string, label: string): ReportColumn => ({ key, label, format: 'money', total: true })
const qty = (key: string, label: string): ReportColumn => ({ key, label, format: 'number', total: true })
const dates = [col('date', 'Date'), col('document', 'Bill no.'), col('supplier', 'Supplier')]
const amounts = [money('gross', 'Gross'), money('discount', 'Discount'), money('net', 'Net purchase'), money('tax', 'Tax'), money('rounding', 'Round-off'), money('total', 'Bill value')]
const sums = ['quantity', 'freeQuantity', 'gross', 'discount', 'net', 'tax', 'rounding', 'total']
function total(rows: ReportRow[], key: string): number | null {
  if (rows.some(row => row[key] === null)) return null
  const value = rows.reduce((sum, row) => sum + (typeof row[key] === 'number' ? row[key] as number : 0), 0)
  return ['quantity', 'freeQuantity'].includes(key) ? Math.round(value * 1000) / 1000 : round(value)
}
function group(rows: ReportRow[], keys: string[], labels: string[]) {
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) { const key = JSON.stringify(keys.map(k => row[k])); groups.set(key, [...(groups.get(key) || []), row]) }
  return [...groups.values()].map(members => {
    const row: ReportRow = Object.fromEntries([...keys, ...labels].map(key => [key, members[0][key]]))
    for (const key of sums) row[key] = total(members, key)
    row.documents = new Set(members.map(member => member.documentId)).size
    row.purchases = total(members.filter(member => member.type === 'PURCHASE'), 'total')
    const returns = total(members.filter(member => member.type === 'RETURN'), 'total'); row.returns = returns === null ? null : -returns
    return row
  })
}
export function buildPurchaseReport(id: ReportId, data: PurchaseData, filters: Filters) {
  const match = (row: ReportRow) => (!filters.from || String(row.date) >= filters.from) && (!filters.to || String(row.date) <= filters.to) && (!filters.supplier || row.supplierId === filters.supplier) && (!filters.company || row.companyId === filters.company) && (!filters.item || row.itemId === filters.item)
  const selected = data.records.filter(match), bills = selected.filter(row => row.type === 'PURCHASE' || row.type === 'RETURN')
  let rows: ReportRow[] = [], columns: ReportColumn[] = []
  switch (id) {
    case 'consolidated': rows = group(bills, ['documentId'], ['date', 'document', 'supplier', 'type']); columns = [...dates, col('type', 'Type'), ...amounts]; break
    case 'purchases': case 'returns': rows = bills.filter(row => row.type === (id === 'purchases' ? 'PURCHASE' : 'RETURN')); columns = [...dates, col('supplierInvoice', 'Supplier bill'), col('item', 'Item / allocation'), col('company', 'Company'), col('batch', 'Batch'), qty('quantity', 'Qty'), qty('freeQuantity', 'Free'), ...amounts, col('detail', 'Detail')]; break
    case 'misc': rows = selected.filter(row => row.type === 'MISC'); columns = [...dates, col('item', 'Item / allocation'), qty('quantity', 'Qty'), ...amounts, col('detail', 'Detail'), col('reference', 'Reference')]; break
    case 'item-percent': rows = group(bills, ['itemId'], ['item', 'company']); { const base = total(rows, 'total'); rows = rows.map(row => ({ ...row, purchasePercent: typeof base === 'number' && base !== 0 && typeof row.total === 'number' ? round((row.total as number) / base * 100) : null })) }; columns = [col('item', 'Item / allocation'), col('company', 'Company'), qty('quantity', 'Qty'), money('total', 'Purchase value'), { key: 'purchasePercent', label: 'Purchase %', format: 'percent' }]; break
    case 'company-summary': case 'company': rows = group(bills, ['companyId'], ['company']); columns = [col('company', 'Company'), qty('documents', 'Bills'), qty('quantity', 'Qty'), ...amounts]; break
    case 'summary': case 'party': rows = group(bills, ['supplierId', 'supplier'], []); columns = [col('supplier', 'Supplier'), qty('documents', 'Bills'), qty('quantity', 'Qty'), ...amounts]; break
    case 'adjustments': rows = selected.filter(row => ['RETURN', 'MISC'].includes(row.type)).map(row => ({ ...row, quantity: row.quantity === null ? null : Math.abs(row.quantity), freeQuantity: row.freeQuantity === null ? null : Math.abs(row.freeQuantity), activityValue: Math.abs(row.total) })); columns = [...dates, col('type', 'Activity'), col('item', 'Item / allocation'), qty('quantity', 'Qty'), money('activityValue', 'Activity value'), col('detail', 'Detail'), col('reference', 'Reference')]; break
    case 'discount': rows = bills.filter(row => row.discount !== 0); columns = [...dates, col('item', 'Item / allocation'), money('gross', 'Gross'), money('discount', 'Discount'), money('net', 'Net purchase'), col('detail', 'Detail')]; break
    case 'monthly': rows = group(bills.map(row => ({ ...row, month: String(row.date).slice(0, 7) })), ['month'], []); columns = [col('month', 'Month'), money('purchases', 'Purchases incl. tax'), money('returns', 'Returns incl. tax'), ...amounts]; break
    case 'item': rows = group(bills, ['itemId'], ['item', 'company']); columns = [col('item', 'Item / allocation'), col('company', 'Company'), qty('quantity', 'Qty'), qty('freeQuantity', 'Free'), ...amounts]; break
  }
  const search = filters.search.trim().toLowerCase(); if (search) rows = rows.filter(row => columns.some(column => formatCell(row[column.key], column).toLowerCase().includes(search)))
  return { rows, columns, totals: Object.fromEntries(columns.filter(column => column.total).map(column => [column.key, total(rows, column.key)])) }
}
export function formatCell(value: Cell | undefined, column: ReportColumn): string {
  if (value === null || value === undefined || value === '') return '—'
  if (column.format === 'money') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value))
  if (column.format === 'percent') return `${value}%`
  if (column.format === 'number') return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(value))
  return String(value)
}
export function csvReport(rows: ReportRow[], columns: ReportColumn[], metadata: string[][] = []) {
  const escape = (value: Cell | undefined) => { let text = value == null ? '' : String(value); if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`; return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
  return '\uFEFF' + [...metadata, columns.map(column => column.label), ...rows.map(row => columns.map(column => row[column.key]))].map(row => row.map(escape).join(',')).join('\r\n')
}
