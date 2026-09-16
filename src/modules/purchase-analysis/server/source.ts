import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceData, SourceRow } from '../types'

// Reporting fields only; supplier contact, auth and patient records are never selected.
export const SOURCE_QUERIES = [
  ['parties', 'id,legal_name', 'organization_id'],
  ['items', 'id,code,name,manufacturer_id', 'organization_id'],
  ['manufacturers', 'id,name', 'organization_id'],
  ['item_batches', 'id,item_id,batch_number,purchase_price,cost_price,items!inner(organization_id)', 'items.organization_id'],
  ['purchase_invoices', 'id,party_id,invoice_number,supplier_invoice_number,invoice_date,status,subtotal,discount_total,tax_total,rounding_adjustment,grand_total', 'organization_id'],
  ['purchase_invoice_lines', 'id,invoice_id,item_id,item_batch_id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total,purchase_invoices!inner(organization_id)', 'purchase_invoices.organization_id'],
  ['business_documents', 'id,document_type,document_number,document_date,party_id,status,total,details', 'organization_id'],
  ['audit_logs', 'id,entity_type,entity_id,action,before_state,after_state,occurred_at,metadata', 'organization_id'],
] as const
type Page = { data: SourceRow[] | null; error: unknown; count: number | null }
export async function readEveryPage(fetchPage: (from: number, to: number) => PromiseLike<Page>, name: string) {
  const rows: SourceRow[] = [], ids = new Set<string>(); let expected: number | null = null
  for (;;) {
    const page = await fetchPage(rows.length, rows.length + 499)
    if (page.error) throw new Error(`Unable to read ${name}.`)
    if (page.count === null || !Array.isArray(page.data)) throw new Error(`Unable to verify the complete ${name} dataset.`)
    if (expected !== null && expected !== page.count) throw new Error(`${name} changed while loading. Refresh the report.`)
    expected = page.count
    for (const row of page.data) { if (!row.id || ids.has(String(row.id))) throw new Error(`${name} changed while loading. Refresh the report.`); ids.add(String(row.id)); rows.push(row) }
    if (rows.length === expected) return rows
    if (!page.data.length || rows.length > expected) throw new Error(`Incomplete ${name} dataset. Refresh the report.`)
  }
}
export async function loadPurchaseSources(client: SupabaseClient, organizationId: string): Promise<SourceData> {
  const entries = await Promise.all(SOURCE_QUERIES.map(async ([table, columns, scope]) => {
    const rows = await readEveryPage((from, to) => {
      let query = client.from(table).select(columns, { count: 'exact' }).eq(scope, organizationId)
      if (table === 'audit_logs') query = query.eq('entity_type', 'purchases').eq('action', 'amended')
      return query.order('id').range(from, to) as unknown as PromiseLike<Page>
    }, table)
    return [table, rows] as const
  }))
  return Object.fromEntries(entries)
}
