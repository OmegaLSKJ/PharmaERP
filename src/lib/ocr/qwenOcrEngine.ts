import { ExtractedInvoice, ExtractedLineItem, OcrProgressCallback } from './types'
import { mapExtractedItemsToMaster } from './medicineMapper'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'

const OLLAMA_ENDPOINT_STORAGE = 'pharma_erp_ollama_endpoint'
const OLLAMA_MODEL_STORAGE = 'pharma_erp_ollama_model'

export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
export const DEFAULT_QWEN_MODELS = [
  'qwen2-vl:7b',
  'qwen2-vl:2b',
  'qwen2-vl:latest',
  'qwen2.5-vl:7b',
  'qwen2.5-vl:3b',
  'llama3.2-vision:11b',
  'llama3.2-vision:latest',
  'llava:latest',
  'llava:7b'
]

export function getStoredOllamaEndpoint(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_OLLAMA_ENDPOINT
  try {
    return localStorage.getItem(OLLAMA_ENDPOINT_STORAGE) || DEFAULT_OLLAMA_ENDPOINT
  } catch {
    return DEFAULT_OLLAMA_ENDPOINT
  }
}

export function setStoredOllamaEndpoint(endpoint: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (endpoint) {
      localStorage.setItem(OLLAMA_ENDPOINT_STORAGE, endpoint.trim().replace(/\/+$/, ''))
    } else {
      localStorage.removeItem(OLLAMA_ENDPOINT_STORAGE)
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredOllamaModel(): string {
  if (typeof localStorage === 'undefined') return 'qwen2-vl:7b'
  try {
    return localStorage.getItem(OLLAMA_MODEL_STORAGE) || 'qwen2-vl:7b'
  } catch {
    return 'qwen2-vl:7b'
  }
}

export function setStoredOllamaModel(model: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (model) {
      localStorage.setItem(OLLAMA_MODEL_STORAGE, model.trim())
    } else {
      localStorage.removeItem(OLLAMA_MODEL_STORAGE)
    }
  } catch {
    // Ignore storage errors
  }
}

export interface OllamaStatus {
  online: boolean
  endpoint: string
  models: string[]
  detectedVisionModel: string | null
  error?: string
}

/**
 * Check if local Ollama daemon is active and list all installed models
 */
export async function checkOllamaStatus(customEndpoint?: string): Promise<OllamaStatus> {
  const endpoint = customEndpoint || getStoredOllamaEndpoint() || DEFAULT_OLLAMA_ENDPOINT
  
  // Try direct fetch first
  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000)
    })
    
    if (res.ok) {
      const data = await res.json()
      const models: string[] = (data.models || []).map((m: any) => m.name || m.model)
      const detectedVisionModel =
        models.find((m) => DEFAULT_QWEN_MODELS.includes(m)) ||
        models.find((m) => m.toLowerCase().includes('qwen2-vl') || m.toLowerCase().includes('vision') || m.toLowerCase().includes('llava')) ||
        models[0] ||
        null

      return {
        online: true,
        endpoint,
        models,
        detectedVisionModel
      }
    }
  } catch (directErr: any) {
    // Fallback: check via server proxy route if browser CORS blocked direct access
    try {
      const proxyRes = await fetch(`/api/ocr/qwen?check=1&endpoint=${encodeURIComponent(endpoint)}`, {
        signal: AbortSignal.timeout(3000)
      })
      if (proxyRes.ok) {
        const data = await proxyRes.json()
        return {
          online: data.online ?? true,
          endpoint,
          models: data.models || [],
          detectedVisionModel: data.detectedVisionModel || null
        }
      }
    } catch {
      // Both failed
    }

    return {
      online: false,
      endpoint,
      models: [],
      detectedVisionModel: null,
      error: directErr?.message || 'Could not connect to Ollama daemon on ' + endpoint
    }
  }

  return {
    online: false,
    endpoint,
    models: [],
    detectedVisionModel: null,
    error: 'Failed to communicate with Ollama'
  }
}

/**
 * Convert File or Blob to clean base64 string
 */
async function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  const mimeType = file.type || 'image/jpeg'
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
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
      const [, base64] = result.split(',')
      resolve({ base64, mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Render first page of PDF onto a Canvas to feed into Qwen2-VL vision model
 */
async function renderPdfPageToBlob(pdfFile: File): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }
  const arrayBuffer = await pdfFile.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(1)
  const viewport = page.getViewport({ scale: 2.0 })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for PDF rendering')

  await (page.render as any)({ canvas, canvasContext: ctx, viewport }).promise
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to convert PDF canvas to image blob'))
    }, 'image/jpeg', 0.95)
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
6. Return ONLY the raw JSON object. Do not include markdown code block syntax (\`\`\`json) or any conversational text.
`

/**
 * Clean and parse JSON returned from Vision LLMs
 */
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }
  return JSON.parse(cleaned)
}

/**
 * Scan invoice using local Qwen2-VL model running via Ollama
 */
export async function processInvoiceWithQwen(
  file: File,
  onProgress?: OcrProgressCallback,
  overrideEndpoint?: string,
  overrideModel?: string
): Promise<ExtractedInvoice> {
  const endpoint = (overrideEndpoint || getStoredOllamaEndpoint() || DEFAULT_OLLAMA_ENDPOINT).replace(/\/+$/, '')
  let targetModel = overrideModel || getStoredOllamaModel() || 'qwen2-vl:7b'

  onProgress?.(10, 'Preparing document for Local Qwen2-VL Vision Model…')

  // If PDF, render first page to high-res image
  let imageFile: File | Blob = file
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      onProgress?.(20, 'Rendering PDF page to image for Vision analysis…')
      imageFile = await renderPdfPageToBlob(file)
    } catch (pdfErr) {
      console.warn('Could not render PDF with canvas, sending original file:', pdfErr)
    }
  }

  const { base64 } = await fileToBase64(imageFile)

  onProgress?.(30, `Checking local Ollama connection on ${endpoint}…`)

  // Check available models in Ollama to auto-select best available vision model
  try {
    const status = await checkOllamaStatus(endpoint)
    if (!status.online) {
      throw new Error(`Cannot reach local Ollama on ${endpoint}. Please ensure Ollama is installed and running ('ollama run qwen2-vl:7b').`)
    }
    if (status.models.length > 0 && !status.models.includes(targetModel)) {
      if (status.detectedVisionModel) {
        targetModel = status.detectedVisionModel
      } else {
        targetModel = status.models[0]
      }
    }
  } catch (err: any) {
    if (err.message?.includes('Cannot reach local Ollama')) {
      throw err
    }
    // Proceed with targetModel if check threw a soft error
  }

  onProgress?.(45, `Processing invoice with ${targetModel} (100% offline & private)…`)

  const payload = {
    model: targetModel,
    messages: [
      {
        role: 'user',
        content: PHARMA_INVOICE_PROMPT,
        images: [base64]
      }
    ],
    format: 'json',
    stream: false,
    options: {
      temperature: 0.1
    }
  }

  let rawJsonText = ''

  // 1. Try direct fetch to Ollama
  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const data = await res.json()
      rawJsonText = data?.message?.content || ''
    } else {
      const errorText = await res.text()
      throw new Error(`Ollama returned status ${res.status}: ${errorText}`)
    }
  } catch (fetchErr: any) {
    // 2. Fallback: Try server proxy route if browser CORS blocked localhost
    onProgress?.(55, 'Retrying via local ERP gateway proxy…')
    try {
      const proxyRes = await fetch('/api/ocr/qwen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          payload
        })
      })

      if (proxyRes.ok) {
        const data = await proxyRes.json()
        rawJsonText = data?.content || (data?.message?.content) || ''
      } else {
        const proxyErrText = await proxyRes.text()
        throw new Error(proxyErrText || fetchErr.message)
      }
    } catch (proxyErr: any) {
      throw new Error(
        `Failed to communicate with Local Qwen2-VL on ${endpoint}. ` +
        `Please ensure Ollama is running ('ollama run ${targetModel}'). Error: ${proxyErr.message || fetchErr.message}`
      )
    }
  }

  onProgress?.(80, 'Parsing structured invoice data…')

  let parsed: any
  try {
    parsed = cleanAndParseJson(rawJsonText)
  } catch (parseErr) {
    console.error('Failed to parse Qwen JSON response:', rawJsonText)
    throw new Error('Local Qwen2-VL responded, but JSON could not be parsed: ' + String(parseErr))
  }

  // Normalize items
  const normalizedItems: ExtractedLineItem[] = (parsed.items || []).map((it: any, idx: number) => {
    const qty = Number(it.qty) || 1
    const freeQty = Number(it.freeQty) || 0
    const rate = Number(it.purchaseRate) || Number(it.rate) || 0
    const mrp = Number(it.mrp) || rate * 1.2
    const saleRate = Number(it.saleRate) || mrp * 0.9
    const gstRate = Number(it.gstRate) || 12
    const amount = Number(it.amount) || Math.round(qty * rate * 100) / 100

    return {
      id: `item-${Date.now()}-${idx}`,
      itemName: String(it.itemName || `Item ${idx + 1}`).trim(),
      packing: it.packing || '10x10',
      hsn: String(it.hsn || '30049099').trim(),
      batch: String(it.batch || 'BATCH01').trim(),
      expiry: String(it.expiry || '12/28').trim(),
      qty,
      freeQty,
      purchaseRate: rate,
      mrp,
      saleRate,
      discount: Number(it.discount) || 0,
      gstRate,
      amount,
      confidence: 0.95,
      isConfirmed: true
    }
  })

  onProgress?.(90, 'Auto-mapping medicines to Master Catalog (All Items)…')

  // Auto-enrich items using Pharma Master Catalog & NLP
  const mappedItems = mapExtractedItemsToMaster(normalizedItems, PHARMA_MASTER_CATALOG)

  const calculatedTotal = mappedItems.reduce((acc, it) => acc + (it.amount || 0), 0)
  const totalAmount = Number(parsed.totalAmount) || Math.round(calculatedTotal * 100) / 100
  const taxAmount = Number(parsed.taxAmount) || Math.round(totalAmount * 0.12 * 100) / 100

  onProgress?.(100, 'Invoice mapped successfully with Local Qwen2-VL!')

  return {
    supplierName: String(parsed.supplierName || 'Wholesale Pharma Distributor').trim(),
    supplierGstin: String(parsed.supplierGstin || '').trim(),
    invoiceNo: String(parsed.invoiceNo || 'INV-' + Math.floor(1000 + Math.random() * 9000)).trim(),
    invoiceDate: String(parsed.invoiceDate || new Date().toISOString().split('T')[0]).trim(),
    totalAmount,
    taxAmount,
    items: mappedItems,
    rawText: parsed.rawText || rawJsonText,
    confidence: 0.95,
    sourceType: 'image_ocr',
    pageCount: 1
  }
}
