import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type LedgerEntry = { id: string; party: string; date: string; vType: string; vNo: string; debit: number; credit: number; narration: string }
type Line = { name: string; batch: string; qty: number; rate: number; amount?: number }
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
  return { client, organizationId, financialYearId: fy.id }
}
async function party(client: ReturnType<typeof db>, organizationId: string, name: string) {
  const { data } = await client.from('parties').select('id').eq('organization_id', organizationId).eq('legal_name', name).maybeSingle()
  if (data) return data.id
  const { data: created, error } = await client.from('parties').insert({ organization_id: organizationId, code: `PTY-${Date.now()}`, party_type: 'customer', legal_name: name }).select('id').single()
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
  const batchId = b?.id ?? (await client.from('item_batches').insert({ item_id: itemId!, batch_number: batchNumber, mrp: +line.rate }).select('id').single()).data?.id
  const { data: w } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('code', 'MAIN').maybeSingle()
  const warehouseId = w?.id ?? (await client.from('warehouses').insert({ organization_id: organizationId, code: 'MAIN', name: 'Main Warehouse' }).select('id').single()).data?.id
  if (!itemId || !batchId || !warehouseId) throw new Error('Unable to create inventory data.')
  return { itemId, batchId, warehouseId }
}
export async function list(resource: string, partyName?: string) {
  const { client } = await context()
  if (resource === 'sales') { const { data, error } = await client.from('sales_invoices').select('*').order('invoice_date', { ascending: false }); if (error) throw error; return data }
  if (resource === 'challans') { const { data, error } = await client.from('delivery_challans').select('*').order('challan_date', { ascending: false }); if (error) throw error; return data }
  if (resource === 'vouchers') { const { data, error } = await client.from('vouchers').select('*').order('voucher_date', { ascending: false }); if (error) throw error; return data }
  if (resource === 'ledgers') { const { data, error } = await client.from('voucher_lines').select('id,debit,credit,narration,vouchers!inner(voucher_date,voucher_number,voucher_type),chart_of_accounts!inner(name)'); if (error) throw error; return (data ?? []).filter((v: any) => !partyName || v.chart_of_accounts.name === partyName).map((v: any) => ({ id: v.id, party: v.chart_of_accounts.name, date: v.vouchers.voucher_date, vType: v.vouchers.voucher_type, vNo: v.vouchers.voucher_number, debit: +v.debit, credit: +v.credit, narration: v.narration ?? '' })) }
  throw new Error('Unknown ERP resource.')
}
export async function create(resource: string, body: any) {
  const { client, organizationId, financialYearId } = await context()
  if (resource === 'sales') {
    if (!body.party || !body.lines?.length) throw new Error('Party and at least one sale line are required.')
    const invoiceNumber = body.id || number('SI'), invoiceDate = body.date || date(), partyId = await party(client, organizationId, body.party), total = +body.total
    const { data: invoice, error } = await client.from('sales_invoices').insert({ organization_id: organizationId, financial_year_id: financialYearId, party_id: partyId, invoice_number: invoiceNumber, invoice_date: invoiceDate, status: 'posted', subtotal: total, grand_total: total }).select('id').single(); if (error) throw error
    for (const line of body.lines as Line[]) { const s = await stock(client, organizationId, line); const { error: lineError } = await client.from('sales_invoice_lines').insert({ invoice_id: invoice.id, item_id: s.itemId, item_batch_id: s.batchId, quantity: +line.qty, rate: +line.rate, line_total: +(line.amount ?? line.qty * line.rate) }); if (lineError) throw lineError; const { error: movementError } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: s.batchId, warehouse_id: s.warehouseId, movement_type: 'sale', quantity: -Math.abs(+line.qty), source_type: 'sales_invoice', source_id: invoice.id }); if (movementError) throw movementError }
    const partyAccount = await account(client, organizationId, body.party, partyId), salesAccount = await account(client, organizationId, 'Sales')
    const { data: voucher, error: voucherError } = await client.from('vouchers').insert({ organization_id: organizationId, financial_year_id: financialYearId, voucher_type: 'sale', voucher_number: invoiceNumber, voucher_date: invoiceDate, status: 'posted', narration: `Sales invoice ${invoiceNumber}` }).select('id').single(); if (voucherError) throw voucherError
    const { error: postingError } = await client.from('voucher_lines').insert([{ voucher_id: voucher.id, account_id: partyAccount, debit: total }, { voucher_id: voucher.id, account_id: salesAccount, credit: total }]); if (postingError) throw postingError
    await client.from('sales_invoices').update({ voucher_id: voucher.id }).eq('id', invoice.id)
    return { id: invoiceNumber, party: body.party, date: invoiceDate, lines: body.lines, total }
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
