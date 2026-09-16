import type { AnalysisData, Cell, Filters, ReportColumn, ReportRow } from './types'
import type { ReportId } from './catalog'
import { round } from './normalize'

const col = (key: string, label: string): ReportColumn => ({ key, label })
const money = (key: string, label: string): ReportColumn => ({ key, label, format: 'money', total: true })
const qty = (key: string, label: string): ReportColumn => ({ key, label, format: 'number', total: true })
const dates = [col('date', 'Date'), col('document', 'Document'), col('party', 'Party')]
const amounts = [money('gross', 'Gross'), money('discount', 'Discount'), money('net', 'Net sales'), money('tax', 'Tax'), money('rounding', 'Round-off'), money('total', 'Invoice value')]
const sumKeys = ['quantity', 'freeQuantity', 'gross', 'discount', 'net', 'tax', 'rounding', 'total', 'cost', 'margin', 'freeCost']
function total(rows: ReportRow[], key: string): number | null {
  if (rows.some(r => r[key] === null)) return null
  const amount = rows.reduce((sum, r) => sum + (typeof r[key] === 'number' ? r[key] as number : 0), 0)
  return ['quantity', 'freeQuantity'].includes(key) ? Math.round(amount * 1000) / 1000 : round(amount)
}
function group(rows: ReportRow[], keys: string[], labels: string[]) {
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) { const key = JSON.stringify(keys.map(k => row[k])); groups.set(key, [...(groups.get(key) || []), row]) }
  return [...groups.values()].map(members => {
    const row: ReportRow = Object.fromEntries([...keys, ...labels].map(k => [k, members[0][k]]))
    for (const key of sumKeys) row[key] = total(members, key)
    row.documents = new Set(members.map(r => r.documentId)).size
    row.sales = total(members.filter(r => r.type === 'SALE'), 'total')
    const returned = total(members.filter(r => r.type === 'RETURN'), 'total')
    row.returns = returned === null ? null : -returned
    row.marginPercent = typeof row.net === 'number' && row.net !== 0 && typeof row.margin === 'number' ? round(row.margin / row.net * 100) : null
    return row
  })
}
export function buildAnalysisReport(id: ReportId, data: AnalysisData, filters: Filters) {
  const matches = (r: ReportRow) => (!filters.from || String(r.date) >= filters.from) && (!filters.to || String(r.date) <= filters.to) && (!filters.party || r.partyId === filters.party) && (!filters.company || r.companyId === filters.company) && (!filters.item || r.itemId === filters.item)
  const selected = data.records.filter(matches)
  const sales = selected.filter(r => r.type === 'SALE' || r.type === 'RETURN')
  let rows: ReportRow[] = [], columns: ReportColumn[] = []
  switch (id) {
    case 'consolidated': rows = group(sales, ['documentId'], ['date', 'document', 'party', 'type']); columns = [...dates, col('type', 'Type'), ...amounts]; break
    case 'sales': case 'returns': rows = sales.filter(r => r.type === (id === 'sales' ? 'SALE' : 'RETURN')); columns = [...dates, col('item', 'Item / allocation'), col('company', 'Company'), col('batch', 'Batch'), qty('quantity', 'Qty'), qty('freeQuantity', 'Free'), ...amounts, col('detail', 'Detail')]; break
    case 'misc': rows = group(sales, ['salesperson'], []); columns = [col('salesperson', 'Salesperson'), qty('documents', 'Documents'), ...amounts]; break
    case 'item-analysis': rows = group(sales, ['itemId'], ['item', 'company']); columns = [col('item', 'Item / allocation'), col('company', 'Company'), qty('quantity', 'Net qty'), qty('freeQuantity', 'Net free'), money('net', 'Net sales'), money('cost', 'Current cost basis'), money('margin', 'Indicative margin'), { key: 'marginPercent', label: 'Margin %', format: 'percent' }]; break
    case 'claims': rows = selected.filter(r => r.type === 'CLAIM'); columns = [...dates, col('status', 'Status'), money('claimAmount', 'Claim amount'), col('reference', 'Reference')]; break
    case 'free': rows = group(sales.filter(r => r.freeQuantity !== null && r.freeQuantity !== 0), ['itemId'], ['item', 'company']); columns = [col('item', 'Item'), col('company', 'Company'), qty('quantity', 'Net billed qty'), qty('freeQuantity', 'Net free qty'), money('freeCost', 'Free goods cost')]; break
    case 'adjustments': rows = selected.filter(r => ['RETURN', 'BREAKAGE', 'REPLACEMENT', 'OTHER'].includes(r.type)).map(r => ({ ...r, quantity: r.quantity === null ? null : Math.abs(r.quantity), freeQuantity: r.freeQuantity === null ? null : Math.abs(r.freeQuantity), activityValue: r.activityValue !== undefined ? r.activityValue : Math.abs(r.total) })); columns = [...dates, col('type', 'Activity'), col('item', 'Item / allocation'), qty('quantity', 'Qty'), qty('freeQuantity', 'Free'), money('activityValue', 'Activity value'), col('detail', 'Detail'), col('reference', 'Reference')]; break
    case 'stock': {
      const groups = new Map<string, ReportRow>()
      for (const m of data.movements) {
        if ((filters.to && m.date > filters.to) || (filters.company && m.companyId !== filters.company) || (filters.item && m.itemId !== filters.item)) continue
        const key = JSON.stringify([m.batchId, m.warehouseId])
        const row = groups.get(key) || { item: m.item, company: m.company, batch: m.batch, warehouse: m.warehouse, quantity: 0, unitCost: m.unitCost, lastMovement: m.date, valuation: null }
        row.quantity = Math.round(((row.quantity as number) + m.quantity) * 1000) / 1000
        if (m.date > String(row.lastMovement)) row.lastMovement = m.date
        groups.set(key, row)
      }
      rows = [...groups.values()].filter(r => r.quantity !== 0).map(r => ({ ...r, valuation: r.unitCost === null ? null : round((r.quantity as number) * (r.unitCost as number)) }))
      columns = [col('item', 'Item'), col('company', 'Company'), col('batch', 'Batch'), col('warehouse', 'Warehouse'), qty('quantity', 'On hand'), { key: 'unitCost', label: 'Current unit cost', format: 'money' }, money('valuation', 'Stock value'), col('lastMovement', 'Last movement')]; break
    }
    case 'dispatch': rows = selected.filter(r => r.type === 'ORDER' || r.type === 'DISPATCH'); columns = [...dates, col('type', 'Activity'), col('item', 'Item / allocation'), { key: 'quantity', label: 'Qty', format: 'number' }, col('transport', 'Transport'), col('orderRef', 'Order ref.'), col('status', 'Status')]; break
    case 'collection': rows = selected.filter(r => ['SALE', 'RETURN', 'COLLECTION', 'AMENDMENT'].includes(r.type)).map(r => ({ ...r, salesValue: ['SALE', 'RETURN'].includes(r.type) ? r.total : 0, amendmentValue: r.type === 'AMENDMENT' ? (r.amendmentValue !== undefined ? r.amendmentValue : r.total) : 0 })); columns = [...dates, col('type', 'Activity'), money('salesValue', 'Sales incl. tax'), money('amendmentValue', 'Amendment value'), money('paidAmount', 'Collected'), col('detail', 'Detail'), col('reference', 'Reference')]; break
    case 'discount': rows = sales.filter(r => r.discount !== 0); columns = [...dates, col('item', 'Item / allocation'), money('gross', 'Gross'), money('discount', 'Discount'), money('net', 'Net sales'), col('detail', 'Detail')]; break
    case 'monthly': rows = group(sales.map(r => ({ ...r, month: r.date.slice(0, 7) })), ['month'], []); columns = [col('month', 'Month'), money('sales', 'Sales incl. tax'), money('returns', 'Credits incl. tax'), ...amounts]; break
    case 'item': rows = group(sales, ['itemId'], ['item', 'company']); columns = [col('item', 'Item / allocation'), col('company', 'Company'), qty('quantity', 'Net qty'), qty('freeQuantity', 'Net free'), ...amounts]; break
    case 'company': rows = group(sales, ['companyId'], ['company']); columns = [col('company', 'Company'), ...amounts]; break
    case 'party': rows = group(sales, ['partyId', 'party'], []); columns = [col('party', 'Party'), qty('documents', 'Documents'), ...amounts]; break
  }
  const search = filters.search.trim().toLowerCase()
  if (search) rows = rows.filter(r => columns.some(c => formatCell(r[c.key], c).toLowerCase().includes(search)))
  const totals: ReportRow = Object.fromEntries(columns.filter(c => c.total).map(c => [c.key, total(rows, c.key)]))
  return { rows, columns, totals }
}
export function formatCell(value: Cell | undefined, column: ReportColumn): string {
  if (value === null || value === undefined || value === '') return '—'
  if (column.format === 'money') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value))
  if (column.format === 'percent') return `${value}%`
  if (column.format === 'number') return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(value))
  return String(value)
}
export function csvReport(rows: ReportRow[], columns: ReportColumn[], metadata: string[][] = []) {
  const escape = (value: Cell | undefined) => {
    let s = value == null ? '' : String(value)
    if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(s)) s = "'" + s
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + [...metadata, columns.map(c => c.label), ...rows.map(r => columns.map(c => r[c.key]))].map(row => row.map(escape).join(',')).join('\r\n')
}
