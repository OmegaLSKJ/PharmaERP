import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceData, SourceRow } from '../types'

// Only reporting fields are selected: no auth records, contact details or patient registers.
export const SOURCE_QUERIES = [
  ['parties', 'id,legal_name', 'organization_id'],
  ['items', 'id,code,name,manufacturer_id,purchase_rate', 'organization_id'],
  ['manufacturers', 'id,name', 'organization_id'],
  ['warehouses', 'id,name', 'organization_id'],
  ['item_batches', 'id,item_id,batch_number,cost_price,purchase_price,items!inner(organization_id)', 'items.organization_id'],
  ['sales_invoices', 'id,party_id,invoice_number,invoice_date,status,subtotal,discount_total,tax_total,grand_total,rounding_adjustment', 'organization_id'],
  ['sales_invoice_lines', 'id,invoice_id,item_id,item_batch_id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total,sales_invoices!inner(organization_id)', 'sales_invoices.organization_id'],
  ['business_documents', 'id,document_type,document_number,document_date,party_id,status,total,details', 'organization_id'],
  ['stock_movements', 'id,item_batch_id,warehouse_id,quantity,occurred_at', 'organization_id'],
  ['delivery_challans', 'id,party_id,challan_number,challan_date,transport_name,status,invoice_id', 'organization_id'],
  ['delivery_challan_lines', 'id,challan_id,item_batch_id,quantity,delivery_challans!inner(organization_id)', 'delivery_challans.organization_id'],
  ['receipts_payments', 'id,party_id,voucher_id,amount,reference_number,received_on', 'organization_id'],
  ['vouchers', 'id,voucher_type,voucher_number,voucher_date,status,narration', 'organization_id'],
  ['voucher_lines', 'id,voucher_id,account_id,debit,credit,vouchers!inner(organization_id)', 'vouchers.organization_id'],
  ['chart_of_accounts', 'id,name,account_type,party_id', 'organization_id'],
  ['audit_logs', 'id,entity_type,entity_id,action,before_state,after_state,occurred_at,metadata', 'organization_id'],
  ['inventory_adjustments', 'id,adjustment_number,adjustment_date,reason,status', 'organization_id'],
  ['inventory_adjustment_lines', 'id,adjustment_id,item_batch_id,warehouse_id,quantity_delta,reason,inventory_adjustments!inner(organization_id)', 'inventory_adjustments.organization_id'],
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
    for (const row of page.data) {
      if (!row.id || ids.has(String(row.id))) throw new Error(`${name} changed while loading. Refresh the report.`)
      ids.add(String(row.id)); rows.push(row)
    }
    if (rows.length === expected) return rows
    if (!page.data.length || rows.length > expected) throw new Error(`Incomplete ${name} dataset. Refresh the report.`)
  }
}
export async function loadAnalysisSources(client: SupabaseClient, organizationId: string): Promise<SourceData> {
  const entries = await Promise.all(SOURCE_QUERIES.map(async ([table, columns, scope]) => {
    const rows = await readEveryPage((from, to) => {
      let query = client.from(table).select(columns, { count: 'exact' }).eq(scope, organizationId)
      // Restrict audit reads to sales amendments; unrelated audit payloads are not report data.
      if (table === 'audit_logs') query = query.eq('entity_type', 'sales').eq('action', 'amended')
      return query.order('id').range(from, to) as unknown as PromiseLike<Page>
    }, table)
    return [table, rows] as const
  }))
  return Object.fromEntries(entries)
}
