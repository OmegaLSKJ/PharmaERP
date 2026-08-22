import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type LedgerEntry = { id: string; party: string; date: string; vType: string; vNo: string; debit: number; credit: number; narration: string }
type Line = { name: string; batch: string; qty: number; rate: number; amount?: number; expiry?: string; freeQty?: number; discount?: number; gstRate?: number; mrp?: number }
export type MutationActor = { id?: string; email?: string; requestId?: string }
const date = () => new Date().toISOString().slice(0, 10)
const number = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server credentials are not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
async function context() {
  const client = db()
  const { data: found, error } = await client.from('organizations').select('id').eq('name', 'PharmaERP').maybeSingle()
  if (error) throw error
  const organizationId = found?.id ?? (await client.from('organizations').insert({ name: 'PharmaERP' }).select('id').single()).data?.id
  if (!organizationId) throw new Error('Unable to initialize PharmaERP.')
  const year = new Date().getFullYear()
  const { data: fy, error: fyError } = await client.from('financial_years').upsert({ organization_id: organizationId, starts_on: `${year}-04-01`, ends_on: `${year + 1}-03-31` }, { onConflict: 'organization_id,starts_on' }).select('id').single()
  if (fyError) throw fyError
  const defaults = [ ['Sale Invoice', 'SI-', 4], ['Sale Return', 'SR-', 3], ['Purchase Bill', 'PB-', 4], ['Purchase Return', 'PR-', 3], ['Challan', 'CH-', 4], ['Credit Note', 'CN-', 3], ['Debit Note', 'DN-', 3], ['Sales Order', 'SO-', 3], ['Purchase Order', 'PO-', 3] ]
  const { error: seriesError } = await client.from('document_series').upsert(defaults.map(([document_type, prefix, padding]) => ({ organization_id: organizationId, document_type, prefix, padding, next_number: 1 })), { onConflict: 'organization_id,document_type', ignoreDuplicates: true })
  if (seriesError) throw seriesError
  return { client, organizationId, financialYearId: fy.id }
}
async function party(client: ReturnType<typeof db>, organizationId: string, name: string, partyType: 'customer' | 'supplier' = 'customer') {
  const { data } = await client.from('parties').select('id').eq('organization_id', organizationId).eq('legal_name', name).maybeSingle()
  if (data) return data.id
  const { data: created, error } = await client.from('parties').insert({ organization_id: organizationId, code: `PTY-${Date.now()}`, party_type: partyType, legal_name: name }).select('id').single()
  if (error) throw error
  return created.id
}
async function account(client: ReturnType<typeof db>, organizationId: string, name: string, partyId?: string) {
  const { data } = await client.from('chart_of_accounts').select('id').eq('organization_id', organizationId).eq('name', name).maybeSingle()
  if (data) return data.id
  const { data: created, error } = await client.from('chart_of_accounts').insert({ organization_id: organizationId, code: `ACC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name, account_type: partyId ? 'party' : 'general', party_id: partyId ?? null }).select('id').single()
  if (error) throw error
  return created.id
}
async function stock(client: ReturnType<typeof db>, organizationId: string, line: Line) {
  const { data: i } = await client.from('items').select('id').eq('organization_id', organizationId).eq('name', line.name).maybeSingle()
  const itemId = i?.id ?? (await client.from('items').insert({ organization_id: organizationId, code: `ITM-${Date.now()}`, name: line.name, mrp: +line.rate, sale_rate: +line.rate }).select('id').single()).data?.id
  const batchNumber = line.batch || 'UNSPECIFIED'
  const { data: b } = await client.from('item_batches').select('id').eq('item_id', itemId!).eq('batch_number', batchNumber).maybeSingle()
  const batchId = b?.id ?? (await client.from('item_batches').insert({ item_id: itemId!, batch_number: batchNumber, expiry_on: line.expiry || null, mrp: +(line.mrp ?? line.rate) }).select('id').single()).data?.id
  const { data: w } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('code', 'MAIN').maybeSingle()
  const warehouseId = w?.id ?? (await client.from('warehouses').insert({ organization_id: organizationId, code: 'MAIN', name: 'Main Warehouse' }).select('id').single()).data?.id
  if (!itemId || !batchId || !warehouseId) throw new Error('Unable to create inventory data.')
  return { itemId, batchId, warehouseId }
}
export async function list(resource: string, partyName?: string) {
  const { client, organizationId, financialYearId } = await context()
  if (resource === 'dashboard') {
    const [{ data: sales, error: salesError }, { data: purchases, error: purchaseError }, { data: items, error: itemError }, { data: stock, error: stockError }] = await Promise.all([
      client.from('sales_invoices').select('id,invoice_number,invoice_date,status,grand_total,parties(legal_name),sales_invoice_lines(quantity,line_total,items(name))').eq('organization_id', organizationId).neq('status', 'cancelled').order('invoice_date', { ascending: false }),
      client.from('purchase_invoices').select('invoice_date,status,grand_total').eq('organization_id', organizationId).neq('status', 'cancelled'),
      client.from('items').select('id').eq('organization_id', organizationId).eq('is_active', true),
      client.from('erp_stock_position').select('item_name,batch_number,expiry_on,quantity').eq('organization_id', organizationId).gt('quantity', 0),
    ])
    const error = salesError || purchaseError || itemError || stockError; if (error) throw error
    const monthly = new Map<string, { month: string; sale: number; purchase: number }>()
    const addMonth = (value: any, kind: 'sale' | 'purchase') => { const key = String(value.invoice_date).slice(0, 7); const row = monthly.get(key) ?? { month: key, sale: 0, purchase: 0 }; row[kind] += Number(value.grand_total); monthly.set(key, row) }
    ;(sales ?? []).forEach((row: any) => addMonth(row, 'sale')); (purchases ?? []).forEach((row: any) => addMonth(row, 'purchase'))
    const itemTotals = new Map<string, { name: string; qty: number; amount: number }>()
    ;(sales ?? []).flatMap((row: any) => row.sales_invoice_lines ?? []).forEach((line: any) => { const name = line.items?.name ?? 'Unknown'; const current = itemTotals.get(name) ?? { name, qty: 0, amount: 0 }; current.qty += Number(line.quantity); current.amount += Number(line.line_total); itemTotals.set(name, current) })
    return {
      kpis: { sales: (sales ?? []).reduce((n: number, x: any) => n + Number(x.grand_total), 0), purchases: (purchases ?? []).reduce((n: number, x: any) => n + Number(x.grand_total), 0), activeItems: items?.length ?? 0, pendingInvoices: (sales ?? []).filter((x: any) => x.status === 'draft').length },
      salesData: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
      topItems: [...itemTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 6),
      recentInvoices: (sales ?? []).slice(0, 8).map((x: any) => ({ id: x.invoice_number, party: x.parties?.legal_name ?? '', amount: Number(x.grand_total), date: x.invoice_date, status: x.status })),
      expiryAlerts: (stock ?? []).filter((x: any) => x.expiry_on).sort((a: any, b: any) => String(a.expiry_on).localeCompare(String(b.expiry_on))).slice(0, 8).map((x: any) => ({ item: x.item_name, batch: x.batch_number, expiry: x.expiry_on, qty: Number(x.quantity) })),
    }
  }
  if (resource === 'report-financial') { const { data, error } = await client.from('erp_trial_balance').select('*').eq('organization_id', organizationId).order('name'); if (error) throw error; return (data ?? []).map((x: any) => ({ ledger: x.name, group: x.account_group, debit: Number(x.debit), credit: Number(x.credit), balance: Number(x.balance) })) }
  if (resource === 'report-stock') { const { data, error } = await client.from('erp_stock_position').select('*').eq('organization_id', organizationId).order('item_name'); if (error) throw error; return (data ?? []).map((x: any) => ({ name: x.item_name, batch: x.batch_number, expiry: x.expiry_on ?? '', qty: Number(x.quantity), reserved: Number(x.reserved_quantity), location: x.warehouse_name, schedule: x.schedule_class, recalled: x.is_recalled })) }
  if (resource === 'parties') {
    const { data, error } = await client.from('parties').select('id,code,party_type,legal_name,phone,email,gstin,credit_limit,is_blocked,created_at,party_addresses(city,is_default)').eq('organization_id', organizationId).order('legal_name')
    if (error) throw error
    return (data ?? []).map((p: any) => ({ id: p.id, code: p.code, name: p.legal_name, type: p.party_type, phone: p.phone ?? '', email: p.email ?? '', city: p.party_addresses?.find((a: any) => a.is_default)?.city ?? p.party_addresses?.[0]?.city ?? '', gstin: p.gstin ?? '', balance: 0, creditLimit: Number(p.credit_limit), lastSale: '', status: p.is_blocked ? 'blocked' : 'active' }))
  }
  if (resource === 'items') {
    const { data, error } = await client.from('items').select('id,code,name,packing,mrp,sale_rate,purchase_rate,is_active,schedule_class,prescription_required,cold_chain,controlled_substance,is_recalled,manufacturers(name),salts(name),hsn_codes(code,gst_rate),item_batches(id,batch_number,expiry_on,mrp,stock_movements(quantity,warehouses(name)))').eq('organization_id', organizationId).order('name')
    if (error) throw error
    return (data ?? []).map((i: any) => ({ id: i.id, code: i.code, name: i.name, packing: i.packing ?? '', manufacturer: i.manufacturers?.name ?? '', salt: i.salts?.name ?? '', hsn: i.hsn_codes?.code ?? '', gstRate: Number(i.hsn_codes?.gst_rate ?? 0), mrp: Number(i.mrp), saleRate: Number(i.sale_rate), purchaseRate: Number(i.purchase_rate), scheduleClass:i.schedule_class, prescriptionRequired:i.prescription_required, coldChain:i.cold_chain, controlledSubstance:i.controlled_substance, recalled:i.is_recalled, stock: (i.item_batches ?? []).flatMap((b: any) => b.stock_movements ?? []).reduce((sum: number, m: any) => sum + Number(m.quantity), 0), batches: (i.item_batches ?? []).map((b: any) => ({ id: b.id, batch: b.batch_number, expiry: b.expiry_on, mrp: Number(b.mrp), stock: (b.stock_movements ?? []).reduce((sum: number, m: any) => sum + Number(m.quantity), 0), stockByLocation: (b.stock_movements ?? []).reduce((byLocation: Record<string, number>, m: any) => { const location = m.warehouses?.name ?? 'Main Warehouse'; byLocation[location] = (byLocation[location] ?? 0) + Number(m.quantity); return byLocation }, {}) })), batchCount: i.item_batches?.length ?? 0, category: 'Medicine', status: i.is_active ? 'active' : 'banned' }))
  }
  if (resource === 'hsn') { const { data, error } = await client.from('hsn_codes').select('*').eq('organization_id', organizationId).order('code'); if (error) throw error; return data }
  if (resource === 'manufacturers') { const { data, error } = await client.from('manufacturers').select('*').eq('organization_id', organizationId).order('name'); if (error) throw error; return data }
  if (resource === 'salts') { const { data, error } = await client.from('salts').select('id,code,name,composition,category,items(count)').eq('organization_id', organizationId).order('name'); if (error) throw error; return (data ?? []).map((s: any) => ({ ...s, itemcount: Number(s.items?.[0]?.count ?? 0), items: undefined })) }
  if (resource === 'warehouses') { const { data, error } = await client.from('warehouses').select('*').eq('organization_id', organizationId).order('name'); if (error) throw error; return (data ?? []).map((w: any) => ({ id: w.id, code: w.code, name: w.name, type: w.warehouse_type, address: w.address ?? '', capacity: Number(w.capacity), used: 0, status: w.is_active ? 'active' : 'inactive' })) }
  if (resource === 'accounts') { const { data, error } = await client.from('chart_of_accounts').select('id,code,name,account_type,account_group,opening_balance,is_active,voucher_lines(debit,credit)').eq('organization_id', organizationId).order('name'); if (error) throw error; return (data ?? []).map((a: any) => { const balance = Number(a.opening_balance) + (a.voucher_lines ?? []).reduce((sum: number, line: any) => sum + Number(line.debit) - Number(line.credit), 0); return { id: a.id, code: a.code, name: a.name, group: a.account_group, balance: Math.abs(balance), type: balance < 0 ? 'Cr' : 'Dr', active: a.is_active } }) }
  if (resource === 'series') { const { data, error } = await client.from('document_series').select('*').eq('organization_id', organizationId).order('document_type'); if (error) throw error; return (data ?? []).map((s: any) => ({ id: s.id, doc: s.document_type, prefix: s.prefix, suffix: s.suffix, nextNo: Number(s.next_number), padding: s.padding, fyReset: s.financial_year_reset, active: s.is_active })) }
  if (resource === 'communication-blocks') { const { data, error } = await client.from('communication_blocks').select('*').eq('organization_id', organizationId).order('blocked_on', { ascending: false }); if (error) throw error; return (data ?? []).map((b: any) => ({ id: b.id, type: b.channel, value: b.destination, reason: b.reason ?? '', blockedOn: b.blocked_on })) }
  const documentResources: Record<string, string> = { 'sale-returns': 'sale_return', 'purchase-returns': 'purchase_return', orders: 'order', breakages: 'breakage', replacements: 'replacement', 'counter-sales': 'counter_sale', pendings: 'pending', 'price-differences': 'price_difference', 'item-mappings': 'item_mapping' }
  if (documentResources[resource]) { const { data, error } = await client.from('business_documents').select('id,document_number,document_date,status,total,details,parties(legal_name)').eq('organization_id', organizationId).eq('document_type', documentResources[resource]).order('document_date', { ascending: false }); if (error) throw error; return (data ?? []).map((row: any) => ({ id: row.id, number: row.document_number, date: row.document_date, status: row.status, total: Number(row.total), party: row.parties?.legal_name ?? '', ...row.details })) }
  if (resource === 'sales') { const { data, error } = await client.from('sales_invoices').select('id,invoice_number,invoice_date,status,grand_total,parties(legal_name),sales_invoice_lines(count)').eq('organization_id', organizationId).order('invoice_date', { ascending: false }); if (error) throw error; return (data ?? []).map((v: any) => ({ id: v.invoice_number, dbId: v.id, party: v.parties?.legal_name ?? '', date: v.invoice_date, status: v.status, items: Number(v.sales_invoice_lines?.[0]?.count ?? 0), total: Number(v.grand_total) })) }
  if (resource === 'purchases') { const { data, error } = await client.from('purchase_invoices').select('id,invoice_number,supplier_invoice_number,invoice_date,status,grand_total,parties(legal_name),purchase_invoice_lines(count)').eq('organization_id', organizationId).order('invoice_date', { ascending: false }); if (error) throw error; return (data ?? []).map((v: any) => ({ id: v.invoice_number, dbId: v.id, supplierInvoice: v.supplier_invoice_number ?? '', party: v.parties?.legal_name ?? '', date: v.invoice_date, status: v.status === 'posted' ? 'received' : v.status, items: Number(v.purchase_invoice_lines?.[0]?.count ?? 0), total: Number(v.grand_total) })) }
  if (resource === 'challans') { const { data, error } = await client.from('delivery_challans').select('id,challan_number,challan_date,transport_name,status,parties(legal_name)').eq('organization_id', organizationId).order('challan_date', { ascending: false }); if (error) throw error; return (data ?? []).map((v: any) => ({ id: v.challan_number, dbId: v.id, party: v.parties?.legal_name ?? '', date: v.challan_date, transport: v.transport_name ?? '', status: v.status })) }
  if (resource === 'vouchers') { const { data, error } = await client.from('vouchers').select('*').order('voucher_date', { ascending: false }); if (error) throw error; return data }
  if (resource === 'ledgers') { const { data, error } = await client.from('voucher_lines').select('id,debit,credit,narration,vouchers!inner(voucher_date,voucher_number,voucher_type),chart_of_accounts!inner(name)'); if (error) throw error; return (data ?? []).filter((v: any) => !partyName || v.chart_of_accounts.name === partyName).map((v: any) => ({ id: v.id, party: v.chart_of_accounts.name, date: v.vouchers.voucher_date, vType: v.vouchers.voucher_type, vNo: v.vouchers.voucher_number, debit: +v.debit, credit: +v.credit, narration: v.narration ?? '' })) }
  throw new Error('Unknown ERP resource.')
}

type ImportRow = Record<string, unknown>

const importRequired: Record<string, string[]> = {
  parties: ['code', 'party_type', 'legal_name'],
  manufacturers: ['name'],
  salts: ['code', 'name'],
  hsn: ['code'],
  warehouses: ['code', 'name'],
  accounts: ['code', 'name'],
  items: ['code', 'name'],
  'opening-stock': ['item_code', 'batch', 'warehouse_code', 'quantity'],
  sales: ['invoice_number', 'invoice_date', 'customer', 'item_code', 'batch', 'quantity', 'rate'],
  purchases: ['invoice_number', 'invoice_date', 'supplier', 'item_code', 'batch', 'quantity', 'purchase_rate'],
}

const importText = (row: ImportRow, key: string) => String(row[key] ?? '').trim()
const importNumber = (row: ImportRow, key: string, fallback = 0) => {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : fallback
}

async function importDataset(type: string, rows: ImportRow[], actor: MutationActor = {}) {
  if (!importRequired[type]) throw new Error('Unsupported import type.')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('The import file has no data rows.')
  if (rows.length > 5000) throw new Error('Import files are limited to 5,000 rows per upload.')
  const invalid = rows.flatMap((row, index) => importRequired[type].filter((key) => !importText(row, key)).map((key) => `Row ${index + 2}: ${key} is required`))
  if (invalid.length) throw new Error(invalid.slice(0, 20).join('; '))

  const { client, organizationId, financialYearId } = await context()
  if (!['sales', 'purchases'].includes(type)) {
    const { data, error } = await client.rpc('erp_import_master', { p_type: type, p_organization_id: organizationId, p_rows: rows, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
    if (error) throw error
    return data
  }
  if (type === 'parties') {
    const payload = rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), party_type: importText(row, 'party_type').toLowerCase(), legal_name: importText(row, 'legal_name'), phone: importText(row, 'phone') || null, email: importText(row, 'email') || null, gstin: importText(row, 'gstin') || null, credit_limit: importNumber(row, 'credit_limit'), is_blocked: importText(row, 'status').toLowerCase() === 'blocked' }))
    if (payload.some((row) => !['customer', 'supplier', 'both'].includes(row.party_type))) throw new Error('party_type must be customer, supplier, or both.')
    const { data, error } = await client.from('parties').upsert(payload, { onConflict: 'organization_id,code' }).select('id,code'); if (error) throw error
    for (const partyRow of data ?? []) { const source = rows.find((row) => importText(row, 'code') === partyRow.code); const city = source ? importText(source, 'city') : ''; if (!city) continue; const { data: existing } = await client.from('party_addresses').select('id').eq('party_id', partyRow.id).eq('is_default', true).maybeSingle(); const address = { party_id: partyRow.id, address_type: 'business', line1: importText(source!, 'address') || city, city, state_code: importText(source!, 'state') || null, postal_code: importText(source!, 'pincode') || null, is_default: true }; const { error: addressError } = existing ? await client.from('party_addresses').update(address).eq('id', existing.id) : await client.from('party_addresses').insert(address); if (addressError) throw addressError }
    return { type, importedRows: rows.length, records: data?.length ?? 0 }
  }
  if (type === 'manufacturers') { const { data, error } = await client.from('manufacturers').upsert(rows.map((row) => ({ organization_id: organizationId, name: importText(row, 'name'), code: importText(row, 'code') || null, is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,name' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'salts') { const { data, error } = await client.from('salts').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), composition: importText(row, 'composition') || null, category: importText(row, 'category') || null })), { onConflict: 'organization_id,name' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'hsn') { const { data, error } = await client.from('hsn_codes').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), description: importText(row, 'description') || null, gst_rate: importNumber(row, 'gst_rate') })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'warehouses') { const { data, error } = await client.from('warehouses').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), warehouse_type: importText(row, 'warehouse_type') || 'Store Room', address: importText(row, 'address') || null, capacity: importNumber(row, 'capacity'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'accounts') { const { data, error } = await client.from('chart_of_accounts').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), account_type: importText(row, 'account_type') || 'general', account_group: importText(row, 'account_group') || 'General', opening_balance: importNumber(row, 'opening_balance'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'items') {
    const [{ data: manufacturers }, { data: salts }, { data: hsnCodes }] = await Promise.all([client.from('manufacturers').select('id,name').eq('organization_id', organizationId), client.from('salts').select('id,name').eq('organization_id', organizationId), client.from('hsn_codes').select('id,code').eq('organization_id', organizationId)])
    const manufacturerMap = new Map((manufacturers ?? []).map((row) => [row.name.toLowerCase(), row.id])), saltMap = new Map((salts ?? []).map((row) => [row.name.toLowerCase(), row.id])), hsnMap = new Map((hsnCodes ?? []).map((row) => [row.code.toLowerCase(), row.id]))
    const missing = rows.flatMap((row, index) =>
      ([['manufacturer', manufacturerMap], ['salt', saltMap], ['hsn_code', hsnMap]] as const).flatMap(([key, map]) => {
        const value = importText(row, key)
        return value && !map.has(value.toLowerCase()) ? [`Row ${index + 2}: ${key} "${value}" is not in its master table`] : []
      }),
    )
    if (missing.length) throw new Error(missing.slice(0, 20).join('; '))
    const payload = rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), packing: importText(row, 'packing') || null, manufacturer_id: manufacturerMap.get(importText(row, 'manufacturer').toLowerCase()) ?? null, salt_id: saltMap.get(importText(row, 'salt').toLowerCase()) ?? null, hsn_id: hsnMap.get(importText(row, 'hsn_code').toLowerCase()) ?? null, mrp: importNumber(row, 'mrp'), sale_rate: importNumber(row, 'sale_rate'), purchase_rate: importNumber(row, 'purchase_rate'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' }))
    const { data, error } = await client.from('items').upsert(payload, { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 }
  }
  if (type === 'opening-stock') {
    const [{ data: items }, { data: warehouses }] = await Promise.all([client.from('items').select('id,code').eq('organization_id', organizationId), client.from('warehouses').select('id,code').eq('organization_id', organizationId)])
    const itemMap = new Map((items ?? []).map((row) => [row.code.toLowerCase(), row.id])), warehouseMap = new Map((warehouses ?? []).map((row) => [row.code.toLowerCase(), row.id]))
    for (const [index, row] of rows.entries()) { const itemId = itemMap.get(importText(row, 'item_code').toLowerCase()), warehouseId = warehouseMap.get(importText(row, 'warehouse_code').toLowerCase()), quantity = importNumber(row, 'quantity'); if (!itemId || !warehouseId || quantity < 0) throw new Error(`Row ${index + 2}: item, warehouse, or quantity is invalid.`); const { data: batch, error: batchError } = await client.from('item_batches').upsert({ item_id: itemId, batch_number: importText(row, 'batch'), expiry_on: importText(row, 'expiry') || null, mrp: importNumber(row, 'mrp') }, { onConflict: 'item_id,batch_number' }).select('id').single(); if (batchError) throw batchError; const { error: deleteError } = await client.from('stock_movements').delete().eq('organization_id', organizationId).eq('item_batch_id', batch.id).eq('warehouse_id', warehouseId).eq('movement_type', 'opening'); if (deleteError) throw deleteError; const { error: movementError } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: batch.id, warehouse_id: warehouseId, movement_type: 'opening', quantity, source_type: 'csv_import', remarks: importText(row, 'remarks') || 'Opening stock import' }); if (movementError) throw movementError }
    return { type, importedRows: rows.length, records: rows.length }
  }
  const partyKey = type === 'sales' ? 'customer' : 'supplier', rateKey = type === 'sales' ? 'rate' : 'purchase_rate'
  const [{ data: parties }, { data: items }] = await Promise.all([client.from('parties').select('legal_name,party_type').eq('organization_id', organizationId), client.from('items').select('code,name').eq('organization_id', organizationId)])
  const partyMap = new Map((parties ?? []).map((row) => [row.legal_name.toLowerCase(), row.party_type])), itemMap = new Map((items ?? []).map((row) => [row.code.toLowerCase(), row.name]) )
  const groups = new Map<string, ImportRow[]>()
  for (const [index, row] of rows.entries()) { const partyName = importText(row, partyKey), itemName = itemMap.get(importText(row, 'item_code').toLowerCase()); if (!partyMap.has(partyName.toLowerCase()) || !itemName) throw new Error(`Row ${index + 2}: party or item code does not exist in the master data.`); const invoice = importText(row, 'invoice_number'); groups.set(invoice, [...(groups.get(invoice) ?? []), row]) }
  const documents = [...groups].map(([invoiceNumber, invoiceRows]) => { const first = invoiceRows[0]; return { id: invoiceNumber, party: importText(first, partyKey), supplierInvoice: importText(first, 'supplier_invoice_number') || invoiceNumber, date: importText(first, 'invoice_date'), lines: invoiceRows.map((row) => ({ name: itemMap.get(importText(row, 'item_code').toLowerCase())!, itemCode: importText(row, 'item_code'), batch: importText(row, 'batch'), expiry: importText(row, 'expiry') || undefined, qty: importNumber(row, 'quantity'), freeQty: importNumber(row, 'free_quantity'), rate: importNumber(row, rateKey), discount: importNumber(row, 'discount_percent'), gstRate: importNumber(row, 'gst_rate'), mrp: importNumber(row, 'mrp') })) } })
  const { data, error } = await client.rpc('erp_import_invoices', { p_kind: type, p_organization_id: organizationId, p_financial_year_id: financialYearId, p_documents: documents, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
  if (error) throw error
  return { ...data, importedRows: rows.length }
}

export async function create(resource: string, body: any, actor: MutationActor = {}) {
  const { client, organizationId, financialYearId } = await context()
  if (resource === 'bulk-import') return importDataset(String(body.type ?? ''), body.rows, actor)
  if (resource === 'cancellations') { if (!['sales','purchases'].includes(body.kind) || !body.id) throw new Error('Invoice kind and database id are required.'); const { error } = await client.rpc('erp_cancel_invoice',{ p_kind:body.kind,p_organization_id:organizationId,p_invoice_id:body.id,p_reason:body.reason ?? '',p_actor_auth_id:actor.id ?? null,p_actor_email:actor.email ?? null,p_request_id:actor.requestId ?? null }); if(error) throw error; return { id:body.id,status:'cancelled' } }
  if (resource === 'inventory-adjustments') { const { data,error }=await client.rpc('erp_post_inventory_adjustment',{p_organization_id:organizationId,p_document:body,p_actor_auth_id:actor.id ?? null,p_actor_email:actor.email ?? null,p_request_id:actor.requestId ?? null}); if(error) throw error; return data }
  if (resource === 'parties') {
    if (!body.name) throw new Error('Party name is required.')
    const { data, error } = await client.from('parties').insert({ organization_id: organizationId, code: body.code || `PTY-${Date.now()}`, party_type: body.type || 'customer', legal_name: body.name, phone: body.phone || null, email: body.email || null, gstin: body.gstin || null, credit_limit: Number(body.creditLimit || 0) }).select('id,code').single()
    if (error) throw error
    if (body.city) { const { error: addressError } = await client.from('party_addresses').insert({ party_id: data.id, address_type: 'business', line1: body.address || body.city, city: body.city, is_default: true }); if (addressError) throw addressError }
    return { ...body, id: data.id, code: data.code, balance: 0, status: 'active' }
  }
  if (resource === 'hsn') { const { data, error } = await client.from('hsn_codes').insert({ organization_id: organizationId, code: body.code, description: body.description ?? body.name ?? null, gst_rate: Number(body.gst_rate ?? body.gstRate ?? 0) }).select('*').single(); if (error) throw error; return data }
  if (resource === 'manufacturers') { const { data, error } = await client.from('manufacturers').insert({ organization_id: organizationId, name: body.name, code: body.code || null, is_active: body.status !== 'inactive' }).select('*').single(); if (error) throw error; return data }
  if (resource === 'salts') { const { data, error } = await client.from('salts').insert({ organization_id: organizationId, code: body.code || `S-${Date.now()}`, name: body.name, composition: body.composition || null, category: body.category || null }).select('*').single(); if (error) throw error; return { ...data, itemcount: 0 } }
  if (resource === 'warehouses') { const { data, error } = await client.from('warehouses').insert({ organization_id: organizationId, code: body.code || `WH-${Date.now()}`, name: body.name, warehouse_type: body.type || 'Store Room', address: body.address || null, capacity: Number(body.capacity || 0) }).select('*').single(); if (error) throw error; return { id: data.id, code: data.code, name: data.name, type: data.warehouse_type, address: data.address ?? '', capacity: Number(data.capacity), used: 0, status: 'active' } }
  if (resource === 'accounts') { const { data, error } = await client.from('chart_of_accounts').insert({ organization_id: organizationId, code: body.code || `ACC-${Date.now()}`, name: body.name, account_type: body.accountType || 'general', account_group: body.group || 'General', opening_balance: Number(body.openingBalance || 0) }).select('*').single(); if (error) throw error; return { id: data.id, name: data.name, group: data.account_group, balance: Math.abs(Number(data.opening_balance)), type: Number(data.opening_balance) < 0 ? 'Cr' : 'Dr' } }
  if (resource === 'series') { const { data, error } = await client.from('document_series').insert({ organization_id: organizationId, document_type: body.doc, prefix: body.prefix || '', suffix: body.suffix || '', next_number: Number(body.nextNo || 1), padding: Number(body.padding || 4), financial_year_reset: body.fyReset !== false, is_active: body.active !== false }).select('*').single(); if (error) throw error; return { ...body, id: data.id } }
  if (resource === 'communication-blocks') { const { data, error } = await client.from('communication_blocks').insert({ organization_id: organizationId, channel: body.type, destination: body.value, reason: body.reason || null }).select('*').single(); if (error) throw error; return { id: data.id, type: data.channel, value: data.destination, reason: data.reason ?? '', blockedOn: data.blocked_on } }
  if (resource === 'breakages') {
    if (!body.lines?.length) throw new Error('Add at least one expiry or breakage line.')
    const documentNumber = body.number || number(body.entryType === 'expiry' ? 'EXP' : 'BRK')
    const prepared: Array<{ batchId: string; warehouseId: string; qty: number; name: string }> = []
    for (const line of body.lines) { const resolved = await stock(client, organizationId, { ...line, rate: line.rate ?? 0 }); const { data: movements, error: movementError } = await client.from('stock_movements').select('quantity').eq('item_batch_id', resolved.batchId).eq('warehouse_id', resolved.warehouseId); if (movementError) throw movementError; const available = (movements ?? []).reduce((sum, movement) => sum + Number(movement.quantity), 0); if (available < Number(line.qty)) throw new Error(`Only ${available} units of ${line.name} are available.`); prepared.push({ batchId: resolved.batchId, warehouseId: resolved.warehouseId, qty: Number(line.qty), name: line.name }) }
    const { data: document, error: documentError } = await client.from('business_documents').insert({ organization_id: organizationId, document_type: 'breakage', document_number: documentNumber, document_date: body.date || date(), status: 'posted', total: Number(body.total || 0), details: body }).select('id').single(); if (documentError) throw documentError
    for (const row of prepared) { const { error } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: row.batchId, warehouse_id: row.warehouseId, movement_type: body.entryType === 'expiry' ? 'expiry' : 'breakage', quantity: -Math.abs(row.qty), source_type: 'breakage', source_id: document.id, remarks: body.remark || null }); if (error) throw error }
    return { ...body, id: document.id, number: documentNumber, date: body.date || date() }
  }
  const documentResources: Record<string, { type: string; prefix: string }> = { 'sale-returns': { type: 'sale_return', prefix: 'SR' }, 'purchase-returns': { type: 'purchase_return', prefix: 'PR' }, orders: { type: 'order', prefix: 'ORD' }, replacements: { type: 'replacement', prefix: 'REP' }, 'counter-sales': { type: 'counter_sale', prefix: 'CS' }, pendings: { type: 'pending', prefix: 'PND' }, 'price-differences': { type: 'price_difference', prefix: 'PD' }, 'item-mappings': { type: 'item_mapping', prefix: 'MAP' } }
  if (documentResources[resource]) { const config = documentResources[resource]; const partyId = body.party ? await party(client, organizationId, body.party, body.partyType === 'supplier' ? 'supplier' : 'customer') : null; const documentNumber = body.number || number(config.prefix); const { data, error } = await client.from('business_documents').insert({ organization_id: organizationId, document_type: config.type, document_number: documentNumber, document_date: body.date || date(), party_id: partyId, status: body.status || 'posted', total: Number(body.total || 0), details: body }).select('id').single(); if (error) throw error; return { ...body, id: data.id, number: documentNumber, date: body.date || date() } }
  if (resource === 'items') {
    if (!body.name) throw new Error('Item name is required.')
    const manufacturerId = body.manufacturer ? (await client.from('manufacturers').select('id').eq('organization_id', organizationId).eq('name', body.manufacturer).maybeSingle()).data?.id : null
    const saltId = body.salt ? (await client.from('salts').select('id').eq('organization_id', organizationId).eq('name', body.salt).maybeSingle()).data?.id : null
    const hsnId = body.hsn ? (await client.from('hsn_codes').select('id').eq('organization_id', organizationId).eq('code', body.hsn).maybeSingle()).data?.id : null
    const { data, error } = await client.from('items').insert({ organization_id: organizationId, code: body.code || `ITM-${Date.now()}`, name: body.name, packing: body.packing || null, manufacturer_id: manufacturerId ?? null, salt_id: saltId ?? null, hsn_id: hsnId ?? null, mrp: Number(body.mrp || 0), sale_rate: Number(body.saleRate || 0), purchase_rate: Number(body.purchaseRate || 0), is_active: body.status !== 'banned', schedule_class:body.scheduleClass || 'OTC', prescription_required:Boolean(body.prescriptionRequired), cold_chain:Boolean(body.coldChain), controlled_substance:Boolean(body.controlledSubstance) }).select('id,code').single()
    if (error) throw error
    return { ...body, id: data.id, code: data.code, stock: 0, batchCount: 0, status: body.status ?? 'active' }
  }
  if (resource === 'stock-transfers') {
    if (!body.lines?.length) throw new Error('Add at least one stock transfer line.')
    const prepared: Array<{ line: any; batchId: string; fromId: string; toId: string }> = []
    for (const line of body.lines) {
      if (!line.from || !line.to || line.from === line.to || Number(line.qty) <= 0) throw new Error('Each transfer needs different locations and a positive quantity.')
      const { data: itemRow } = await client.from('items').select('id').eq('organization_id', organizationId).eq('name', line.itemName).maybeSingle()
      const { data: batchRow } = itemRow ? await client.from('item_batches').select('id').eq('item_id', itemRow.id).eq('batch_number', line.batch).maybeSingle() : { data: null }
      const { data: fromRow } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('name', line.from).maybeSingle()
      const { data: toRow } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('name', line.to).maybeSingle()
      if (!batchRow || !fromRow || !toRow) throw new Error(`Inventory references are incomplete for ${line.itemName}.`)
      const { data: movements, error: movementError } = await client.from('stock_movements').select('quantity').eq('item_batch_id', batchRow.id).eq('warehouse_id', fromRow.id); if (movementError) throw movementError
      const available = (movements ?? []).reduce((sum, movement) => sum + Number(movement.quantity), 0)
      if (available < Number(line.qty)) throw new Error(`Only ${available} units of ${line.itemName} are available in ${line.from}.`)
      prepared.push({ line, batchId: batchRow.id, fromId: fromRow.id, toId: toRow.id })
    }
    const documentNumber = body.id || number('TRF')
    const { data: document, error: documentError } = await client.from('business_documents').insert({ organization_id: organizationId, document_type: 'stock_transfer', document_number: documentNumber, document_date: body.date || date(), status: 'posted', details: { lines: body.lines } }).select('id').single(); if (documentError) throw documentError
    for (const row of prepared) { const common = { organization_id: organizationId, item_batch_id: row.batchId, source_type: 'stock_transfer', source_id: document.id, occurred_at: `${body.date || date()}T12:00:00Z` }; const { error } = await client.from('stock_movements').insert([{ ...common, warehouse_id: row.fromId, movement_type: 'transfer_out', quantity: -Math.abs(Number(row.line.qty)), remarks: `Transfer to ${row.line.to}` }, { ...common, warehouse_id: row.toId, movement_type: 'transfer_in', quantity: Math.abs(Number(row.line.qty)), remarks: `Transfer from ${row.line.from}` }]); if (error) throw error }
    return { id: documentNumber, date: body.date || date(), lines: body.lines }
  }
  if (resource === 'sales') {
    const { data, error } = await client.rpc('erp_post_invoice', { p_kind: 'sales', p_organization_id: organizationId, p_financial_year_id: financialYearId, p_document: { ...body, id: body.id || number('SI'), date: body.date || date() }, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
    if (error) throw error
    return data
    /* Legacy posting retained below temporarily for migration traceability.
    if (!body.party || !body.lines?.length) throw new Error('Party and at least one sale line are required.')
    const invoiceNumber = body.id || number('SI'), invoiceDate = body.date || date(), partyId = await party(client, organizationId, body.party), total = +body.total
    const prepared: Array<Awaited<ReturnType<typeof stock>>> = []
    for (const line of body.lines as Line[]) { const resolved = await stock(client, organizationId, line); const { data: movements, error: stockError } = await client.from('stock_movements').select('quantity').eq('item_batch_id', resolved.batchId).eq('warehouse_id', resolved.warehouseId); if (stockError) throw stockError; const available = (movements ?? []).reduce((sum, movement) => sum + Number(movement.quantity), 0); if (available < Number(line.qty) + Number(line.freeQty ?? 0)) throw new Error(`Insufficient stock for ${line.name} (${line.batch}). Available: ${available}.`); prepared.push(resolved) }
    const { data: invoice, error } = await client.from('sales_invoices').insert({ organization_id: organizationId, financial_year_id: financialYearId, party_id: partyId, invoice_number: invoiceNumber, invoice_date: invoiceDate, status: 'posted', subtotal: total, grand_total: total }).select('id').single(); if (error) throw error
    for (let index = 0; index < body.lines.length; index += 1) { const line = body.lines[index] as Line, s = prepared[index]; const { error: lineError } = await client.from('sales_invoice_lines').insert({ invoice_id: invoice.id, item_id: s.itemId, item_batch_id: s.batchId, quantity: +line.qty, free_quantity: Number(line.freeQty ?? 0), rate: +line.rate, discount_percent: Number(line.discount ?? 0), gst_rate: Number(line.gstRate ?? 0), line_total: +(line.amount ?? line.qty * line.rate) }); if (lineError) throw lineError; const { error: movementError } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: s.batchId, warehouse_id: s.warehouseId, movement_type: 'sale', quantity: -Math.abs(+line.qty + Number(line.freeQty ?? 0)), source_type: 'sales_invoice', source_id: invoice.id }); if (movementError) throw movementError }
    const partyAccount = await account(client, organizationId, body.party, partyId), salesAccount = await account(client, organizationId, 'Sales')
    const { data: voucher, error: voucherError } = await client.from('vouchers').insert({ organization_id: organizationId, financial_year_id: financialYearId, voucher_type: 'sale', voucher_number: invoiceNumber, voucher_date: invoiceDate, status: 'posted', narration: `Sales invoice ${invoiceNumber}` }).select('id').single(); if (voucherError) throw voucherError
    const { error: postingError } = await client.from('voucher_lines').insert([{ voucher_id: voucher.id, account_id: partyAccount, debit: total }, { voucher_id: voucher.id, account_id: salesAccount, credit: total }]); if (postingError) throw postingError
    await client.from('sales_invoices').update({ voucher_id: voucher.id }).eq('id', invoice.id)
    return { id: invoiceNumber, party: body.party, date: invoiceDate, lines: body.lines, total } */
  }
  if (resource === 'purchases') {
    const { data, error } = await client.rpc('erp_post_invoice', { p_kind: 'purchases', p_organization_id: organizationId, p_financial_year_id: financialYearId, p_document: { ...body, id: body.id || number('PB'), date: body.date || date() }, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
    if (error) throw error
    return data
    /* Legacy posting retained below temporarily for migration traceability.
    if (!body.party || !body.lines?.length) throw new Error('Supplier and at least one purchase line are required.')
    const invoiceNumber = body.id || number('PB'), invoiceDate = body.date || date(), partyId = await party(client, organizationId, body.party, 'supplier')
    const subtotal = Number(body.subtotal ?? body.lines.reduce((sum: number, line: Line) => sum + Number(line.amount ?? line.qty * line.rate), 0))
    const taxTotal = Number(body.taxTotal ?? 0), total = Number(body.total ?? subtotal + taxTotal)
    const { data: invoice, error } = await client.from('purchase_invoices').insert({ organization_id: organizationId, financial_year_id: financialYearId, party_id: partyId, invoice_number: invoiceNumber, supplier_invoice_number: body.supplierInvoice || null, invoice_date: invoiceDate, status: 'posted', subtotal, tax_total: taxTotal, grand_total: total }).select('id').single()
    if (error) throw error
    for (const line of body.lines as Line[]) {
      const s = await stock(client, organizationId, line)
      const lineTotal = Number(line.amount ?? line.qty * line.rate)
      const { error: lineError } = await client.from('purchase_invoice_lines').insert({ invoice_id: invoice.id, item_id: s.itemId, item_batch_id: s.batchId, quantity: Number(line.qty), free_quantity: Number(line.freeQty || 0), rate: Number(line.rate), discount_percent: Number(line.discount || 0), gst_rate: Number(line.gstRate || 0), line_total: lineTotal })
      if (lineError) throw lineError
      const { error: movementError } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: s.batchId, warehouse_id: s.warehouseId, movement_type: 'purchase', quantity: Math.abs(Number(line.qty) + Number(line.freeQty || 0)), source_type: 'purchase_invoice', source_id: invoice.id })
      if (movementError) throw movementError
    }
    const supplierAccount = await account(client, organizationId, body.party, partyId), purchaseAccount = await account(client, organizationId, 'Purchases')
    const { data: voucher, error: voucherError } = await client.from('vouchers').insert({ organization_id: organizationId, financial_year_id: financialYearId, voucher_type: 'purchase', voucher_number: invoiceNumber, voucher_date: invoiceDate, status: 'posted', narration: `Purchase invoice ${invoiceNumber}` }).select('id').single()
    if (voucherError) throw voucherError
    const { error: postingError } = await client.from('voucher_lines').insert([{ voucher_id: voucher.id, account_id: purchaseAccount, debit: total }, { voucher_id: voucher.id, account_id: supplierAccount, credit: total }])
    if (postingError) throw postingError
    const { error: linkError } = await client.from('purchase_invoices').update({ voucher_id: voucher.id }).eq('id', invoice.id)
    if (linkError) throw linkError
    return { id: invoiceNumber, party: body.party, supplierInvoice: body.supplierInvoice ?? '', date: invoiceDate, lines: body.lines, total, status: 'posted' } */
  }
  if (resource === 'challans') {
    if (!body.party || !body.lines?.length) throw new Error('Party and at least one challan line are required.')
    const challanNumber = body.id || number('CH'), challanDate = body.date || date(), partyId = await party(client, organizationId, body.party)
    const { data: challan, error } = await client.from('delivery_challans').insert({ organization_id: organizationId, financial_year_id: financialYearId, party_id: partyId, challan_number: challanNumber, challan_date: challanDate, transport_name: body.transport ?? null, status: 'posted' }).select('id').single(); if (error) throw error
    for (const line of body.lines as Line[]) { const s = await stock(client, organizationId, line); const { error: lineError } = await client.from('delivery_challan_lines').insert({ challan_id: challan.id, item_batch_id: s.batchId, quantity: +line.qty }); if (lineError) throw lineError }
    return { id: challanNumber, party: body.party, transport: body.transport ?? '', date: challanDate, lines: body.lines }
  }
  if (resource === 'vouchers') {
    const debit = body.lines?.reduce((sum: number, v: any) => sum + +(v.debit || 0), 0) ?? 0, credit = body.lines?.reduce((sum: number, v: any) => sum + +(v.credit || 0), 0) ?? 0
    if (!body.lines?.length || debit <= 0 || debit !== credit) throw new Error('Voucher must contain balanced debit and credit lines.')
    const voucherNumber = body.id || number('VCH'), voucherDate = body.date || date()
    const { data: voucher, error } = await client.from('vouchers').insert({ organization_id: organizationId, financial_year_id: financialYearId, voucher_type: 'journal', voucher_number: voucherNumber, voucher_date: voucherDate, status: 'posted', narration: body.narration ?? null }).select('id').single(); if (error) throw error
    for (const line of body.lines) { const accountId = await account(client, organizationId, line.ledger); const { error: lineError } = await client.from('voucher_lines').insert({ voucher_id: voucher.id, account_id: accountId, debit: +(line.debit || 0), credit: +(line.credit || 0), narration: line.narration ?? body.narration ?? null }); if (lineError) throw lineError }
    return { id: voucherNumber, type: body.type ?? 'Journal', date: voucherDate, narration: body.narration ?? '', lines: body.lines }
  }
  throw new Error('Unknown ERP resource.')
}

export async function update(resource: string, id: string, body: any) {
  const { client, organizationId } = await context()
  if (resource === 'parties') { const values: any = {}; if ('name' in body) values.legal_name = body.name; if ('type' in body) values.party_type = body.type; if ('phone' in body) values.phone = body.phone; if ('email' in body) values.email = body.email; if ('gstin' in body) values.gstin = body.gstin; if ('creditLimit' in body) values.credit_limit = Number(body.creditLimit); if ('status' in body) values.is_blocked = body.status === 'blocked'; const { data, error } = await client.from('parties').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'series') { const values = { document_type: body.doc, prefix: body.prefix, suffix: body.suffix, next_number: Number(body.nextNo), padding: Number(body.padding), financial_year_reset: body.fyReset, is_active: body.active }; const { data, error } = await client.from('document_series').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'warehouses') { const values: any = {}; if ('name' in body) values.name = body.name; if ('type' in body) values.warehouse_type = body.type; if ('address' in body) values.address = body.address; if ('capacity' in body) values.capacity = Number(body.capacity); if ('status' in body) values.is_active = body.status === 'active'; const { data, error } = await client.from('warehouses').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'accounts') { const values: any = {}; if ('name' in body) values.name = body.name; if ('group' in body) values.account_group = body.group; if ('openingBalance' in body) values.opening_balance = Number(body.openingBalance); const { data, error } = await client.from('chart_of_accounts').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'items') { const values: any = {}; if ('code' in body) values.code = body.code; if ('name' in body) values.name = body.name; if ('packing' in body) values.packing = body.packing; if ('mrp' in body) values.mrp = Number(body.mrp); if ('saleRate' in body) values.sale_rate = Number(body.saleRate); if ('purchaseRate' in body) values.purchase_rate = Number(body.purchaseRate); if ('status' in body) values.is_active = body.status !== 'banned'; if ('scheduleClass' in body) values.schedule_class=body.scheduleClass; if ('prescriptionRequired' in body) values.prescription_required=Boolean(body.prescriptionRequired); if ('coldChain' in body) values.cold_chain=Boolean(body.coldChain); if ('controlledSubstance' in body) values.controlled_substance=Boolean(body.controlledSubstance); const { data, error } = await client.from('items').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  const masterTables: Record<string, string> = { manufacturers: 'manufacturers', salts: 'salts', hsn: 'hsn_codes' }
  if (!masterTables[resource]) throw new Error('Unknown ERP resource.')
  const { data, error } = await client.from(masterTables[resource]).update(body).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data
}

export async function remove(resource: string, id: string) {
  const { client, organizationId } = await context()
  if (resource === 'item-mappings') { const { error } = await client.from('business_documents').delete().eq('id', id).eq('organization_id', organizationId).eq('document_type', 'item_mapping'); if (error) throw error; return { id } }
  const masterTables: Record<string, string> = { parties: 'parties', manufacturers: 'manufacturers', salts: 'salts', hsn: 'hsn_codes', warehouses: 'warehouses', accounts: 'chart_of_accounts', items: 'items', series: 'document_series', 'communication-blocks': 'communication_blocks' }
  if (!masterTables[resource]) throw new Error('Unknown ERP resource.')
  const { error } = await client.from(masterTables[resource]).delete().eq('id', id).eq('organization_id', organizationId); if (error) throw error
  return { id }
}
