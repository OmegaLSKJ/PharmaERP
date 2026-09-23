import type { AnalysisData, SaleRecord, SourceData, SourceRow } from './types'
import { lookupCatalogManufacturer } from '../../lib/catalogManufacturers'

export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const text = (value: unknown) => value == null ? '' : String(value)
const list = (value: unknown): SourceRow[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : []
const eligible = (status: unknown) => ['posted', 'processed'].includes(text(status).toLowerCase())
const index = (rows: SourceRow[] = []) => new Map(rows.map(r => [text(r.id), r]))
const sum = (rows: SaleRecord[], key: string) => round(rows.reduce((total, r) => total + n(r[key]), 0))
export function localDate(value: unknown) {
  const s = text(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const date = new Date(s)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
function blank(patch: Partial<SaleRecord>): SaleRecord {
  return { id: '', documentId: '', date: '', document: '', type: 'SALE', status: '', party: 'Unassigned', partyId: '', item: 'Unallocated invoice values', itemId: '', company: 'Unallocated', companyId: '', batch: '', quantity: null, freeQuantity: null, rate: null, gross: null, discount: null, net: null, tax: null, rounding: 0, total: 0, cost: null, margin: null, freeCost: null, salesperson: 'Unassigned', reference: '', transport: '', orderRef: '', detail: '', paidAmount: 0, claimAmount: 0, ...patch }
}

export function normalizeSources(source: SourceData, organization: string, loadedAt = new Date().toISOString()): AnalysisData {
  const records: SaleRecord[] = [], warnings: string[] = []
  const parties = index(source.parties), items = index(source.items), companies = index(source.manufacturers), batches = index(source.item_batches), warehouses = index(source.warehouses), accounts = index(source.chart_of_accounts)
  const itemByCode = new Map((source.items || []).map(i => [text(i.code), i]))
  const byName = new Map<string, SourceRow[]>()
  for (const i of items.values()) { const key = text(i.name).toLowerCase().trim(); byName.set(key, [...(byName.get(key) || []), i]) }
  const costFor = (item?: SourceRow, batch?: SourceRow) => {
    // Zero is the schema's default, not proof that goods were acquired for free.
    for (const value of [batch?.cost_price, batch?.purchase_price, item?.purchase_rate]) if (n(value) > 0) return n(value)
    return null
  }
  const identity = (item?: SourceRow, batch?: SourceRow) => {
    const rawCompany = text(companies.get(text(item?.manufacturer_id))?.name) || text(item?.manufacturer) || text(item?.company)
    const fallbackCompany = (!rawCompany || rawCompany === 'Unallocated') ? lookupCatalogManufacturer(text(item?.name), text(item?.code)) : ''
    const company = rawCompany || fallbackCompany || 'Unallocated'
    const companyId = text(item?.manufacturer_id) || (fallbackCompany ? `catalog:${fallbackCompany}` : '')
    return { itemId: text(item?.id), item: text(item?.name) || 'Unallocated invoice values', companyId, company, batch: text(batch?.batch_number) }
  }
  const partyInfo = (id: unknown, fallback?: unknown) => ({ partyId: text(id), party: text(parties.get(text(id))?.legal_name) || text(fallback) || 'Unassigned' })
  const resolveLine = (line: SourceRow) => {
    let item = items.get(text(line.item_id || line.itemId)) || itemByCode.get(text(line.itemCode))
    if (!item) { const matches = byName.get(text(line.name || line.itemName).toLowerCase().trim()) || []; if (matches.length === 1) item = matches[0] }
    const batch = batches.get(text(line.item_batch_id || line.batchId)) || [...batches.values()].find(b => b.item_id === item?.id && b.batch_number === (line.batch || line.batchNumber))
    return { item, batch }
  }
  function goods(line: SourceRow, common: Partial<SaleRecord>, sign = 1): SaleRecord {
    const { item, batch } = resolveLine(line)
    const quantity = n(line.quantity ?? line.qty), free = n(line.free_quantity ?? line.freeQty ?? line.free)
    const rate = n(line.rate), gross = round(quantity * rate), discount = round(gross * n(line.discount_percent ?? line.discount) / 100)
    const net = round(gross - discount), calculatedTax = round(net * n(line.gst_rate ?? line.gstRate) / 100)
    const total = line.line_total != null ? n(line.line_total) : round(net + calculatedTax)
    const tax = round(total - net), unitCost = costFor(item, batch)
    const cost = unitCost === null ? null : round((quantity + free) * unitCost)
    return blank({ ...common, ...identity(item, batch), item: text(item?.name || line.name || line.itemName) || 'Unallocated invoice values', batch: text(batch?.batch_number || line.batch || line.batchNumber), id: `${common.documentId}:${text(line.id) || records.length}`, quantity: sign * quantity, freeQuantity: sign * free, rate, gross: sign * gross, discount: sign * discount, net: sign * net, tax: sign * tax, total: sign * total, cost: cost === null ? null : sign * cost, margin: cost === null ? null : sign * round(net - cost), freeCost: unitCost === null ? null : sign * round(free * unitCost), detail: 'Item line' })
  }
  const linesByInvoice = new Map<string, SourceRow[]>()
  for (const line of source.sales_invoice_lines || []) { const key = text(line.invoice_id); linesByInvoice.set(key, [...(linesByInvoice.get(key) || []), line]) }
  let headerOnly = 0
  for (const invoice of source.sales_invoices || []) {
    if (!eligible(invoice.status)) continue
    const common = { documentId: `invoice:${invoice.id}`, document: text(invoice.invoice_number), date: localDate(invoice.invoice_date), type: 'SALE' as const, status: text(invoice.status), ...partyInfo(invoice.party_id) }
    const lines = (linesByInvoice.get(text(invoice.id)) || []).map(l => goods(l, common))
    records.push(...lines)
    const gross = n(invoice.subtotal), discount = n(invoice.discount_total), tax = n(invoice.tax_total), total = n(invoice.grand_total), net = round(gross - discount), rounding = round(total - net - tax)
    const delta = { gross: round(gross - sum(lines, 'gross')), discount: round(discount - sum(lines, 'discount')), net: round(net - sum(lines, 'net')), tax: round(tax - sum(lines, 'tax')), total: round(total - sum(lines, 'total')), rounding }
    const justRounding = lines.length > 0 && [delta.gross, delta.discount, delta.net, delta.tax].every(v => Math.abs(v) < .005)
    if (!lines.length || Object.values(delta).some(v => Math.abs(v) >= .005)) {
      const lineCompanies = Array.from(new Set(lines.map(l => l.company).filter(c => c && c !== 'Unallocated')))
      const roundCompany = lineCompanies.length === 1 ? lineCompanies[0] : (lineCompanies.length > 1 ? 'Multiple' : 'Round-off')
      const roundCompanyId = lineCompanies.length === 1 ? (lines.find(l => l.company === roundCompany)?.companyId || `catalog:${roundCompany}`) : 'round-off'
      records.push(blank({ ...common, id: `${common.documentId}:reconciliation`, ...delta, ...(justRounding ? { quantity: 0, freeQuantity: 0, cost: 0, margin: 0, freeCost: 0, item: 'Invoice Round-off', company: roundCompany, companyId: roundCompanyId } : {}), detail: lines.length ? 'Invoice-level adjustment / round-off' : 'Invoice has no item lines' }))
    }
    if (!lines.length) headerOnly++
  }
  if (headerOnly) warnings.push(`${headerOnly} posted invoice(s) have no item lines. Their recorded totals are included under Unallocated invoice values; item quantities and costs are unavailable.`)
  const invoices = index(source.sales_invoices)
  for (const audit of source.audit_logs || []) {
    if (audit.entity_type !== 'sales' || audit.action !== 'amended') continue
    const before = audit.before_state || {}, after = audit.after_state || {}
    const replacementNumber = text(audit.metadata?.replacement_number || after.id)
    const replacement = (source.sales_invoices || []).find(i => i.invoice_number === replacementNumber)
    const original = invoices.get(text(audit.entity_id))
    const recordedValue = after.total ?? replacement?.grand_total
    const amendmentValue = recordedValue != null && Number.isFinite(Number(recordedValue)) ? Number(recordedValue) : null
    records.push(blank({ id: `amendment:${audit.id}`, documentId: `amendment:${audit.id}`, document: replacementNumber || text(before.number), date: localDate(audit.occurred_at), type: 'AMENDMENT', status: 'posted', ...partyInfo(replacement?.party_id || original?.party_id), reference: text(before.number || original?.invoice_number), amendmentValue, detail: 'Audited invoice replacement; value is informational, not an additional sale' }))
  }
  const adjustmentLines = source.inventory_adjustment_lines || []
  for (const adjustment of source.inventory_adjustments || []) {
    if (!eligible(adjustment.status)) continue
    const lines = adjustmentLines.filter(l => l.adjustment_id === adjustment.id)
    for (const line of lines.length ? lines : [{ id: `${adjustment.id}:header` }]) {
      const batch = batches.get(text(line.item_batch_id)), item = items.get(text(batch?.item_id)), unitCost = costFor(item, batch)
      const quantity = line.quantity_delta == null ? null : n(line.quantity_delta)
      const activityValue = quantity === null || unitCost === null ? null : round(Math.abs(quantity) * unitCost)
      records.push(blank({ ...identity(item, batch), id: `adjustment:${line.id}`, documentId: `adjustment:${adjustment.id}`, document: text(adjustment.adjustment_number), date: localDate(adjustment.adjustment_date), type: 'OTHER', status: text(adjustment.status), quantity, activityValue, reference: text(line.reason || adjustment.reason), detail: `Inventory adjustment: ${quantity === null ? 'quantity unavailable' : quantity < 0 ? 'stock decrease' : 'stock increase'}; ${text(warehouses.get(text(line.warehouse_id))?.name) || 'unknown warehouse'}; current cost basis` }))
    }
  }
  const mapped: Record<string, SaleRecord['type']> = { sale_return: 'RETURN', counter_sale: 'SALE', order: 'ORDER', breakage: 'BREAKAGE', replacement: 'REPLACEMENT', other: 'OTHER', adjustment: 'OTHER', claim: 'CLAIM', incentive: 'CLAIM', amendment: 'AMENDMENT', price_difference: 'AMENDMENT' }
  for (const doc of source.business_documents || []) {
    const type = mapped[text(doc.document_type)], detail = doc.details && typeof doc.details === 'object' ? doc.details : {}
    if (!type || ['cancelled', 'rejected', 'draft'].includes(text(doc.status).toLowerCase())) continue
    if (['SALE', 'RETURN'].includes(type) && !eligible(doc.status)) continue
    if (type === 'ORDER' && (text(detail.type).toLowerCase() === 'purchase' || detail.partyType === 'supplier')) continue
    const common = { documentId: `document:${doc.id}`, document: text(doc.document_number), date: localDate(doc.document_date), type, status: text(doc.status), ...partyInfo(doc.party_id, detail.party || detail.supplier), salesperson: text(detail.salesperson) || 'Unassigned', reference: text(detail.origInvoice || detail.reference || detail.remark), transport: text(detail.transport), orderRef: text(detail.orderRef), detail: text(detail.mode || detail.entryType) }
    const sign = type === 'RETURN' ? -1 : 1
    if (type === 'CLAIM') { records.push(blank({ ...common, id: common.documentId, claimAmount: n(doc.total), total: n(doc.total) })); continue }
    const lines = list(detail.lines).map((l, i) => goods({ ...l, id: l.id || i }, common, sign))
    records.push(...lines)
    const total = sign * n(doc.total), delta = round(total - sum(lines, 'total'))
    if (!lines.length || Math.abs(delta) >= .005) {
      const onlyRounding = lines.length > 0 && Math.abs(delta) <= 1
      records.push(blank({ ...common, id: `${common.documentId}:reconciliation`, total: delta, gross: onlyRounding ? 0 : null, discount: onlyRounding ? 0 : null, net: onlyRounding ? 0 : null, tax: onlyRounding ? 0 : null, rounding: onlyRounding ? delta : 0, detail: onlyRounding ? 'Document round-off' : 'Unallocated document value; line/tax detail unavailable' }))
    }
  }
  // Receipt vouchers are authoritative. Explicit receipt allocations take precedence per voucher.
  const vouchers = index(source.vouchers), linkedReceipts = new Map<string, SourceRow[]>()
  for (const r of source.receipts_payments || []) if (r.voucher_id) { const key = text(r.voucher_id); linkedReceipts.set(key, [...(linkedReceipts.get(key) || []), r]) }
  const voucherLines = new Map<string, SourceRow[]>()
  for (const l of source.voucher_lines || []) { const key = text(l.voucher_id); voucherLines.set(key, [...(voucherLines.get(key) || []), l]) }
  const postedVoucherIdentities = new Set<string>()
  const legacyReceipts = (source.business_documents || []).filter(d => d.document_type === 'voucher' && eligible(d.status) && text(d.details?.type).toLowerCase() === 'receipt')
  let unallocatedReceipts = 0
  for (const voucher of vouchers.values()) {
    if (voucher.voucher_type !== 'receipt' || !eligible(voucher.status)) continue
    const common = { documentId: `receipt:${voucher.id}`, document: text(voucher.voucher_number), date: localDate(voucher.voucher_date), type: 'COLLECTION' as const, status: text(voucher.status), reference: text(voucher.narration) }
    postedVoucherIdentities.add(`${common.document}|${common.date}`)
    const allocations = linkedReceipts.get(text(voucher.id)) || []
    if (allocations.length) {
      for (const receipt of allocations) records.push(blank({ ...common, ...partyInfo(receipt.party_id), id: `receipt-allocation:${receipt.id}`, paidAmount: n(receipt.amount), reference: text(receipt.reference_number), detail: 'Receipt allocation' }))
    } else {
      const lines = voucherLines.get(text(voucher.id)) || []
      const partyLines = lines.filter(l => { const a = accounts.get(text(l.account_id)); return a?.account_type === 'party' || a?.party_id })
      for (const line of partyLines) {
        const a = accounts.get(text(line.account_id))
        records.push(blank({ ...common, ...partyInfo(a?.party_id, a?.name), id: `receipt-line:${line.id}`, paidAmount: round(n(line.credit) - n(line.debit)), detail: 'Receipt voucher party line' }))
      }
      if (!partyLines.length) {
        const legacy = legacyReceipts.find(d => localDate(d.document_date) === common.date && [text(d.document_number), text(d.details?.id)].includes(common.document))
        const legacyCredits = lines.length ? [] : list(legacy?.details?.lines).filter(l => n(l.credit) > 0)
        if (legacyCredits.length) {
          for (const [i, line] of legacyCredits.entries()) {
            const matching = [...accounts.values()].filter(a => a.name === line.ledger)
            const a = matching.length === 1 ? matching[0] : undefined
            records.push(blank({ ...common, ...partyInfo(a?.party_id, line.ledger), id: `${common.documentId}:legacy:${i}`, paidAmount: round(n(line.credit) - n(line.debit)), detail: 'Receipt recovered from matching legacy document' }))
          }
        } else {
          const paidAmount = lines.length ? round(lines.reduce((s, l) => s + n(l.credit), 0)) : null
          records.push(blank({ ...common, id: `${common.documentId}:unallocated`, paidAmount, detail: lines.length ? 'Receipt has no party allocation' : 'Receipt has no amount or voucher lines' }))
          unallocatedReceipts++
        }
      }
    }
  }
  for (const doc of source.business_documents || []) {
    const detail = doc.details || {}
    if (doc.document_type !== 'voucher' || !eligible(doc.status) || text(detail.type).toLowerCase() !== 'receipt') continue
    const document = text(doc.document_number), date = localDate(doc.document_date)
    if (postedVoucherIdentities.has(`${document}|${date}`) || postedVoucherIdentities.has(`${text(detail.id)}|${date}`)) continue
    for (const [i, line] of list(detail.lines).entries()) {
      if (n(line.credit) <= 0) continue
      const matching = [...accounts.values()].filter(a => a.name === line.ledger)
      const a = matching.length === 1 ? matching[0] : undefined
      records.push(blank({ id: `legacy-receipt:${doc.id}:${i}`, documentId: `legacy-receipt:${doc.id}`, document, date, type: 'COLLECTION', status: text(doc.status), ...partyInfo(a?.party_id, line.ledger), paidAmount: round(n(line.credit) - n(line.debit)), reference: text(line.narration), detail: 'Legacy receipt document' }))
    }
  }
  if (unallocatedReceipts) warnings.push(`${unallocatedReceipts} receipt voucher(s) lack party allocation or amount detail. They remain visible as Unassigned collections; unavailable amounts are blank.`)
  const unlinkedPayments = (source.receipts_payments || []).filter(r => !vouchers.has(text(r.voucher_id))).length
  if (unlinkedPayments) warnings.push(`${unlinkedPayments} receipt/payment record(s) have no matching voucher, so their direction cannot be verified and they are not counted as collections.`)
  const challans = index(source.delivery_challans), challanLines = source.delivery_challan_lines || []
  for (const c of challans.values()) {
    if (!eligible(c.status)) continue
    const lines = challanLines.filter(l => l.challan_id === c.id)
    for (const line of lines.length ? lines : [{ id: `${c.id}:header` }]) {
      const batch = batches.get(text(line.item_batch_id)), item = items.get(text(batch?.item_id))
      records.push(blank({ ...identity(item, batch), ...partyInfo(c.party_id), id: `challan:${line.id}`, documentId: `challan:${c.id}`, document: text(c.challan_number), date: localDate(c.challan_date), type: 'DISPATCH', status: text(c.status), quantity: line.quantity == null ? null : n(line.quantity), transport: text(c.transport_name), reference: text(c.invoice_id), detail: 'Delivery challan' }))
    }
  }
  const movements = (source.stock_movements || []).map(m => {
    const batch = batches.get(text(m.item_batch_id)), item = items.get(text(batch?.item_id))
    return { id: text(m.id), date: localDate(m.occurred_at), batchId: text(m.item_batch_id), ...identity(item, batch), warehouseId: text(m.warehouse_id), warehouse: text(warehouses.get(text(m.warehouse_id))?.name) || 'Unknown warehouse', quantity: n(m.quantity), unitCost: costFor(item, batch) }
  })
  if (records.some(r => ['SALE', 'RETURN'].includes(r.type) && r.quantity !== null && r.cost === null)) warnings.push('Some item lines have no positive recorded unit cost. Cost and margin totals containing those lines are shown as unavailable.')
  if (!(source.business_documents || []).some(d => ['claim', 'incentive'].includes(d.document_type))) warnings.push('No claim or incentive documents are recorded in this organization; that report will be empty.')
  const companyOptions = new Map<string, string>()
  for (const c of companies.values()) { if (c.id && c.name) companyOptions.set(text(c.id), text(c.name)) }
  for (const record of records) { if (record.companyId && record.company && !['Unallocated', 'Round-off', 'Multiple'].includes(record.company) && !companyOptions.has(record.companyId)) companyOptions.set(record.companyId, record.company) }
  return { organization, loadedAt, records, movements, warnings, counts: Object.fromEntries(Object.entries(source).map(([key, rows]) => [key, rows.length])), options: { parties: [...parties.values()].map(p => ({ id: text(p.id), name: text(p.legal_name) })), items: [...items.values()].map(i => ({ id: text(i.id), name: `${text(i.name)}${i.code ? ` · ${i.code}` : ''}` })), companies: [...companyOptions.entries()].map(([id, name]) => ({ id, name })) } }
}
