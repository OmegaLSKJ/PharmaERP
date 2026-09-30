export interface ExtractedLineItem {
  id: string
  itemName: string
  packing?: string
  hsn: string
  batch: string
  expiry: string
  qty: number
  freeQty: number
  purchaseRate: number
  mrp: number
  saleRate: number
  discount: number
  gstRate: number
  amount: number
  confidence?: number
}

export interface ExtractedInvoice {
  supplierName: string
  supplierGstin: string
  invoiceNo: string
  invoiceDate: string
  totalAmount: number
  taxAmount: number
  items: ExtractedLineItem[]
  rawText: string
  confidence: number
  sourceType: 'digital_pdf' | 'image_ocr'
  pageCount: number
}

export type OcrProgressCallback = (percent: number, message: string) => void
