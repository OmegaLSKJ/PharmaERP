export type SourceRow = Record<string, any>
export type SourceData = Record<string, SourceRow[]>
export type Cell = string | number | null
export type ReportRow = Record<string, Cell>
export type ReportColumn = { key: string; label: string; format?: 'money' | 'number' | 'percent'; total?: boolean }
export type RecordType = 'SALE' | 'RETURN' | 'CLAIM' | 'BREAKAGE' | 'REPLACEMENT' | 'OTHER' | 'ORDER' | 'DISPATCH' | 'AMENDMENT' | 'COLLECTION'
export interface SaleRecord extends ReportRow {
  id: string; documentId: string; date: string; document: string; type: RecordType; status: string
  party: string; partyId: string; item: string; itemId: string; company: string; companyId: string; batch: string
  quantity: number | null; freeQuantity: number | null; rate: number | null; gross: number | null
  discount: number | null; net: number | null; tax: number | null; rounding: number; total: number
  cost: number | null; margin: number | null; freeCost: number | null
  salesperson: string; reference: string; transport: string; orderRef: string; detail: string
  paidAmount: number | null; claimAmount: number
}
export interface StockMovement {
  id: string; date: string; batchId: string; item: string; itemId: string; company: string; companyId: string
  batch: string; warehouse: string; warehouseId: string; quantity: number; unitCost: number | null
}
export interface AnalysisData {
  organization: string; loadedAt: string; records: SaleRecord[]; movements: StockMovement[]
  counts: Record<string, number>; warnings: string[]
  options: { parties: Array<{ id: string; name: string }>; items: Array<{ id: string; name: string }>; companies: Array<{ id: string; name: string }> }
}
export interface Filters { from: string; to: string; party: string; company: string; item: string; search: string }
