export type SourceRow = Record<string, any>
export type SourceData = Record<string, SourceRow[]>
export type Cell = string | number | null
export type ReportRow = Record<string, Cell>
export type ReportColumn = { key: string; label: string; format?: 'money' | 'number' | 'percent'; total?: boolean }
export type PurchaseType = 'PURCHASE' | 'RETURN' | 'MISC' | 'AMENDMENT'

export interface PurchaseRecord extends ReportRow {
  id: string; documentId: string; date: string; document: string; supplierInvoice: string; type: PurchaseType; status: string
  supplier: string; supplierId: string; item: string; itemId: string; company: string; companyId: string; batch: string
  quantity: number | null; freeQuantity: number | null; rate: number | null; gross: number | null; discount: number | null
  net: number | null; tax: number | null; rounding: number; total: number; detail: string; reference: string; amendmentValue: number | null
}
export interface PurchaseData {
  organization: string; loadedAt: string; records: PurchaseRecord[]; counts: Record<string, number>; warnings: string[]
  options: { suppliers: Array<{ id: string; name: string }>; items: Array<{ id: string; name: string }>; companies: Array<{ id: string; name: string }> }
}
export interface Filters { from: string; to: string; supplier: string; company: string; item: string; search: string }
