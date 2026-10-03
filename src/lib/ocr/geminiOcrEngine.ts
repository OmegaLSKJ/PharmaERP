import { ExtractedInvoice, ExtractedLineItem, OcrProgressCallback } from './types'
import { mapExtractedItemsToMaster } from './medicineMapper'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'

const GEMINI_API_KEY_STORAGE = 'pharma_erp_gemini_api_key'
const DEFAULT_MODEL = 'gemini-1.5-flash'

export function getStoredGeminiApiKey(): string {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (key) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim())
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE)
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey() || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) : ''))
}

/**
 * Convert file to base64 string universally across browser and Node.js
 */
async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const mimeType = file.type || 'image/jpeg'
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
    // In browser or Node
    if (typeof Buffer !== 'undefined') {
      return { base64: Buffer.from(buffer).toString('base64'), mimeType }
    }
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return { base64: btoa(binary), mimeType }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      resolve({ base64, mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const PHARMA_INVOICE_PROMPT = `
You are an expert pharmaceutical billing and invoice document parser for Indian wholesale & retail pharmacies.
Analyze this invoice image / document carefully. It contains medicine purchases from distributors (e.g., ADITYA PHARMA, REBA, TIRUPATI, DEY DRUG, AMAR DRUG, etc.).

Extract the invoice data into structured JSON matching this exact format:
{
  "supplierName": "Distributor/supplier business name (e.g. ADITYA PHARMA, omit DL or phone prefix)",
  "supplierGstin": "15-character GSTIN if visible (or empty string)",
  "invoiceNo": "Invoice/Bill/Memo Number",
  "invoiceDate": "YYYY-MM-DD format (convert from DD-MM-YYYY or DD/MM/YY if needed)",
  "totalAmount": 0.00,
  "taxAmount": 0.00,
  "items": [
    {
      "itemName": "Medicine name including dosage form and strength (e.g. DOLO 650 TAB, TELMA 40, PAN 40MG, VILDAPRIDE-D 100/10)",
      "packing": "Pack specification (e.g. 10x10, 1x10, 200ml, 30's)",
      "hsn": "HSN Code (e.g. 30049079, 3004)",
      "batch": "Batch number",
      "expiry": "MM/YY format (e.g. 05/28, 11/27)",
      "qty": 10,
      "freeQty": 0,
      "purchaseRate": 0.00,
      "mrp": 0.00,
      "saleRate": 0.00,
      "discount": 0.00,
      "gstRate": 12,
      "amount": 0.00
    }
  ],
  "rawText": "Complete readable text extracted from the document"
}

Critical Instructions:
1. Do not miss ANY medicine rows. Read all rows in the items table from top to bottom.
2. Even if the print is dot-matrix, faded, or low-contrast, extract the medicine brand names and strengths accurately.
3. Schemes like "10+1" or "27+3": Billed qty is 10, freeQty is 1 (or 27 and 3).
4. If GST rate is split as CGST 2.5% + SGST 2.5%, gstRate is 5. If CGST 6% + SGST 6%, gstRate is 12. If CGST 9% + SGST 9%, gstRate is 18.
5. If saleRate is not explicitly printed, set saleRate to mrp * 0.9.
6. Return only valid JSON without markdown wrapping.
`

export async function processInvoiceWithGemini(
  file: File,
  onProgress?: OcrProgressCallback,
  overrideApiKey?: string
): Promise<ExtractedInvoice> {
  onProgress?.(15, 'Preparing document for Gemini AI Vision...')
  const { base64, mimeType } = await fileToBase64(file)

  const apiKey = overrideApiKey || getStoredGeminiApiKey() || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : '') || ''

  // 1. Try server-side API route first if available
  try {
    onProgress?.(35, 'Analyzing invoice with Gemini AI Vision...')
    const apiRes = await fetch('/api/ocr/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-api-key': apiKey } : {})
      },
      body: JSON.stringify({
        fileBase64: base64,
        mimeType,
        fileName: file.name
      })
    })

    if (apiRes.ok) {
      const data = await apiRes.json()
      if (data && data.items) {
        onProgress?.(85, 'Auto-mapping medicines to Master Catalog...')
        return normalizeGeminiResponse(data, file.name)
      }
    }
  } catch {
    // API route not reachable or in client-only mode, continue to direct client call
  }

  // 2. Direct client call to Gemini REST API if apiKey is available
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_REQUIRED')
  }

  onProgress?.(45, 'Sending image to Gemini 1.5 Flash Vision...')
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`

  const requestBody = {
    contents: [
      {
        parts: [
          { text: PHARMA_INVOICE_PROMPT },
          {
            inline_data: {
              mime_type: mimeType.startsWith('image/') || mimeType === 'application/pdf' ? mimeType : 'image/jpeg',
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json'
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 400 && errorText.includes('API_KEY_INVALID')) {
      throw new Error('INVALID_GEMINI_API_KEY')
    }
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`)
  }

  onProgress?.(80, 'Parsing structured pharma invoice data...')
  const geminiResult = await response.json()
  const candidateText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text
  if (!candidateText) {
    throw new Error('Gemini did not return any content for this document.')
  }

  let parsedJson: any
  try {
    parsedJson = JSON.parse(candidateText)
  } catch {
    // Clean any accidental markdown codeblock backticks
    const cleaned = candidateText.replace(/```(?:json)?/g, '').trim()
    parsedJson = JSON.parse(cleaned)
  }

  onProgress?.(95, 'Mapping medicines to All Items master catalog...')
  return normalizeGeminiResponse(parsedJson, file.name)
}

function normalizeGeminiResponse(parsed: any, fileName: string): ExtractedInvoice {
  const items: ExtractedLineItem[] = (parsed.items || []).map((item: any, idx: number) => {
    const purchaseRate = parseFloat(item.purchaseRate) || 0
    const mrp = parseFloat(item.mrp) || (purchaseRate > 0 ? Math.round(purchaseRate * 1.35 * 100) / 100 : 0)
    const saleRate = parseFloat(item.saleRate) || (mrp > 0 ? Math.round(mrp * 0.9 * 100) / 100 : 0)
    const qty = parseInt(item.qty, 10) || 1
    const freeQty = parseInt(item.freeQty, 10) || 0
    const gstRate = parseFloat(item.gstRate) || 12
    const discount = parseFloat(item.discount) || 0
    const amount = parseFloat(item.amount) || Math.round(purchaseRate * qty * (1 - discount / 100) * 100) / 100

    return {
      id: `gemini-${Date.now()}-${idx}`,
      itemName: String(item.itemName || '').trim(),
      packing: item.packing ? String(item.packing).trim() : '',
      hsn: item.hsn ? String(item.hsn).replace(/[^0-9]/g, '') : '',
      batch: item.batch ? String(item.batch).trim() : `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
      expiry: item.expiry ? String(item.expiry).trim() : '12/28',
      qty,
      freeQty,
      purchaseRate,
      mrp,
      saleRate,
      discount,
      gstRate,
      amount,
      confidence: 0.98
    }
  })

  // Auto-map with Pharma Master Catalog
  const mappedItems = mapExtractedItemsToMaster(items, PHARMA_MASTER_CATALOG)

  const totalAmount = parseFloat(parsed.totalAmount) || items.reduce((sum, it) => sum + it.amount, 0)
  const taxAmount = parseFloat(parsed.taxAmount) || items.reduce((sum, it) => sum + (it.amount * it.gstRate) / 100, 0)

  return {
    supplierName: String(parsed.supplierName || '').replace(/^[A-Za-z0-9\-\.\s\/]{2,15}\s*[-–:]\s*/, '').trim(),
    supplierGstin: String(parsed.supplierGstin || '').trim(),
    invoiceNo: String(parsed.invoiceNo || '').trim(),
    invoiceDate: String(parsed.invoiceDate || new Date().toISOString().split('T')[0]).trim(),
    totalAmount: Math.round(totalAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    items: mappedItems,
    rawText: parsed.rawText || JSON.stringify(parsed, null, 2),
    confidence: 0.98,
    sourceType: fileName.toLowerCase().endsWith('.pdf') ? 'digital_pdf' : 'image_ocr',
    pageCount: 1
  }
}
