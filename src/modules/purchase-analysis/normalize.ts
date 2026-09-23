import type { PurchaseData, PurchaseRecord, SourceData, SourceRow } from './types'
import { lookupCatalogManufacturer } from '../../lib/catalogManufacturers'

export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const text = (value: unknown) => value == null ? '' : String(value)
const eligible = (status: unknown) => ['posted', 'processed'].includes(text(status).toLowerCase())
const index = (rows: SourceRow[] = []) => new Map(rows.map(row => [text(row.id), row]))
const sum = (rows: PurchaseRecord[], key: string) => round(rows.reduce((total, row) => total + n(row[key]), 0))
export function localDate(value: unknown) {
  const raw = text(value); if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
function blank(patch: Partial<PurchaseRecord>): PurchaseRecord {
  return { id: '', documentId: '', date: '', document: '', supplierInvoice: '', type: 'PURCHASE', status: '', supplier: 'Unassigned', supplierId: '', item: 'Unallocated bill values', itemId: '', company: 'Unallocated', companyId: '', batch: '', quantity: null, freeQuantity: null, rate: null, gross: null, discount: null, net: null, tax: null, rounding: 0, total: 0, detail: '', reference: '', amendmentValue: null, ...patch }
}

export function normalizePurchaseSources(source: SourceData, organization: string, loadedAt = new Date().toISOString()): PurchaseData {
  const records: PurchaseRecord[] = [], warnings: string[] = []
  const parties = index(source.parties), items = index(source.items), companies = index(source.manufacturers), batches = index(source.item_batches)
  const byName = new Map<string, SourceRow[]>()
  for (const item of items.values()) { const key = text(item.name).toLowerCase().trim(); byName.set(key, [...(byName.get(key) || []), item]) }
  const party = (id: unknown, fallback?: unknown) => ({ supplierId: text(id), supplier: text(parties.get(text(id))?.legal_name) || text(fallback) || 'Unassigned' })
  const identity = (item?: SourceRow, batch?: SourceRow) => {
    const rawCompany = text(companies.get(text(item?.manufacturer_id))?.name) || text(item?.manufacturer) || text(item?.company)
    const fallbackCompany = (!rawCompany || rawCompany === 'Unallocated') ? lookupCatalogManufacturer(text(item?.name), text(item?.code)) : ''
    const company = rawCompany || fallbackCompany || 'Unallocated'
    const companyId = text(item?.manufacturer_id) || (fallbackCompany ? `catalog:${fallbackCompany}` : '')
    return { itemId: text(item?.id), item: text(item?.name) || 'Unallocated bill values', companyId, company, batch: text(batch?.batch_number) }
  }
  const resolve = (line: SourceRow) => {
    let item = items.get(text(line.item_id || line.itemId))
    if (!item) { const matches = byName.get(text(line.name || line.itemName).toLowerCase().trim()) || []; if (matches.length === 1) item = matches[0] }
    const batch = batches.get(text(line.item_batch_id || line.batchId)) || [...batches.values()].find(row => row.item_id === item?.id && row.batch_number === (line.batch || line.batchNumber))
    return { item, batch }
  }
  const lineRecord = (line: SourceRow, common: Partial<PurchaseRecord>, sign = 1): PurchaseRecord => {
    const { item, batch } = resolve(line), quantity = n(line.quantity ?? line.qty), free = n(line.free_quantity ?? line.freeQty ?? line.free), rate = n(line.rate)
    const gross = round(quantity * rate), discount = round(gross * n(line.discount_percent ?? line.discount) / 100), net = round(gross - discount)
    const total = line.line_total != null ? n(line.line_total) : round(net * (1 + n(line.gst_rate ?? line.gstRate) / 100))
    return blank({ ...common, ...identity(item, batch), item: text(item?.name || line.name || line.itemName) || 'Unallocated bill values', batch: text(batch?.batch_number || line.batch || line.batchNumber), id: `${common.documentId}:${text(line.id) || records.length}`, quantity: sign * quantity, freeQuantity: sign * free, rate, gross: sign * gross, discount: sign * discount, net: sign * net, tax: sign * round(total - net), total: sign * total, detail: 'Item line' })
  }
  const linesByInvoice = new Map<string, SourceRow[]>()
  for (const line of source.purchase_invoice_lines || []) { const key = text(line.invoice_id); linesByInvoice.set(key, [...(linesByInvoice.get(key) || []), line]) }
  let headerOnly = 0
  for (const invoice of source.purchase_invoices || []) {
    if (!eligible(invoice.status)) continue
    const common = { documentId: `purchase:${invoice.id}`, document: text(invoice.invoice_number), supplierInvoice: text(invoice.supplier_invoice_number), date: localDate(invoice.invoice_date), type: 'PURCHASE' as const, status: text(invoice.status), ...party(invoice.party_id) }
    const lines = (linesByInvoice.get(text(invoice.id)) || []).map(line => lineRecord(line, common)); records.push(...lines)
    const gross = n(invoice.subtotal), discount = n(invoice.discount_total), tax = n(invoice.tax_total), net = round(gross - discount), total = n(invoice.grand_total), rounding = round(total - net - tax)
    const delta = { gross: round(gross - sum(lines, 'gross')), discount: round(discount - sum(lines, 'discount')), net: round(net - sum(lines, 'net')), tax: round(tax - sum(lines, 'tax')), total: round(total - sum(lines, 'total')), rounding }
    const justRounding = lines.length > 0 && [delta.gross, delta.discount, delta.net, delta.tax].every(value => Math.abs(value) < .005)
    if (!lines.length || Object.values(delta).some(value => Math.abs(value) >= .005)) {
      const lineCompanies = Array.from(new Set(lines.map(l => l.company).filter(c => c && c !== 'Unallocated')))
      const roundCompany = lineCompanies.length === 1 ? lineCompanies[0] : (lineCompanies.length > 1 ? 'Multiple' : 'Round-off')
      const roundCompanyId = lineCompanies.length === 1 ? (lines.find(l => l.company === roundCompany)?.companyId || `catalog:${roundCompany}`) : 'round-off'
      records.push(blank({ ...common, id: `${common.documentId}:reconciliation`, ...delta, ...(justRounding ? { quantity: 0, freeQuantity: 0, item: 'Bill Round-off', company: roundCompany, companyId: roundCompanyId } : {}), detail: lines.length ? 'Bill-level adjustment / round-off' : 'Purchase bill has no item lines' }))
    }
    if (!lines.length) headerOnly++
  }
  if (headerOnly) warnings.push(`${headerOnly} posted purchase bill(s) have no item lines. Their recorded totals are included under Unallocated bill values.`)
  const types: Record<string, PurchaseRecord['type']> = { purchase_return: 'RETURN', purchase_return_note: 'RETURN', breakage: 'MISC', expiry: 'MISC', other: 'MISC', adjustment: 'MISC', price_difference: 'MISC' }
  for (const doc of source.business_documents || []) {
    const type = types[text(doc.document_type)], detail = doc.details && typeof doc.details === 'object' ? doc.details : {}
    if (!type || ['cancelled', 'rejected', 'draft'].includes(text(doc.status).toLowerCase())) continue
    if (type === 'RETURN' && !eligible(doc.status)) continue
    const common = { documentId: `document:${doc.id}`, document: text(doc.document_number), date: localDate(doc.document_date), type, status: text(doc.status), ...party(doc.party_id, detail.supplier), reference: text(detail.origInvoice || detail.reference), detail: text(detail.mode || detail.entryType) }
    const sign = type === 'RETURN' ? -1 : 1, lines = (Array.isArray(detail.lines) ? detail.lines : []).map((line: SourceRow, i: number) => lineRecord({ ...line, id: line.id || i }, common, sign))
    records.push(...lines)
    const delta = round(sign * n(doc.total) - sum(lines, 'total'))
    if (!lines.length || Math.abs(delta) >= .005) records.push(blank({ ...common, id: `${common.documentId}:reconciliation`, total: delta, gross: null, discount: null, net: null, tax: null, detail: lines.length ? 'Unallocated document value' : 'Document has no item lines' }))
  }
  const invoices = index(source.purchase_invoices)
  for (const audit of source.audit_logs || []) {
    if (audit.entity_type !== 'purchases' || audit.action !== 'amended') continue
    const before = audit.before_state || {}, after = audit.after_state || {}, replacementNo = text(audit.metadata?.replacement_number || after.id)
    const replacement = (source.purchase_invoices || []).find(row => row.invoice_number === replacementNo), original = invoices.get(text(audit.entity_id)), value = after.total ?? replacement?.grand_total
    records.push(blank({ id: `amendment:${audit.id}`, documentId: `amendment:${audit.id}`, document: replacementNo || text(before.number), date: localDate(audit.occurred_at), type: 'AMENDMENT', status: 'posted', ...party(replacement?.party_id || original?.party_id), reference: text(before.number || original?.invoice_number), amendmentValue: value != null && Number.isFinite(Number(value)) ? Number(value) : null, detail: 'Audited bill replacement; informational, not an additional purchase' }))
  }
  if (!(source.business_documents || []).some(doc => text(doc.document_type).startsWith('purchase_return'))) warnings.push('No purchase return documents are recorded in this organization; Purchase Return Book is empty.')
  const companyOptions = new Map<string, string>()
  for (const row of companies.values()) { if (row.id && row.name) companyOptions.set(text(row.id), text(row.name)) }
  for (const record of records) { if (record.companyId && record.company && !['Unallocated', 'Round-off', 'Multiple'].includes(record.company) && !companyOptions.has(record.companyId)) companyOptions.set(record.companyId, record.company) }
  return { organization, loadedAt, records, warnings, counts: Object.fromEntries(Object.entries(source).map(([key, rows]) => [key, rows.length])), options: { suppliers: [...parties.values()].map(row => ({ id: text(row.id), name: text(row.legal_name) })), items: [...items.values()].map(row => ({ id: text(row.id), name: `${text(row.name)}${row.code ? ` · ${row.code}` : ''}` })), companies: [...companyOptions.entries()].map(([id, name]) => ({ id, name })) } }
}
