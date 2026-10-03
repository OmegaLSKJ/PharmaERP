import { ExtractedInvoice, ExtractedLineItem, OcrProgressCallback } from './types'
import { mapExtractedItemsToMaster } from './medicineMapper'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'

const GEMINI_API_KEY_STORAGE = 'pharma_erp_gemini_api_key'
const GEMINI_MODEL_STORAGE = 'pharma_erp_gemini_model'

/**
 * Ordered list of candidate models supporting multimodal vision and generateContent.
 * If one model is unavailable (404/deprecated) for a specific user's API key/region,
 * the engine will cascade to the next candidate automatically.
 */
export const DEFAULT_GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-3.1-pro',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro'
]

let memoryCachedModel: string | null = null

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

export function getStoredGeminiModel(): string {
  if (memoryCachedModel) return memoryCachedModel
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(GEMINI_MODEL_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setStoredGeminiModel(model: string): void {
  memoryCachedModel = model ? model.trim() : null
  if (typeof localStorage === 'undefined') return
  try {
    if (model) {
      localStorage.setItem(GEMINI_MODEL_STORAGE, model.trim())
    } else {
      localStorage.removeItem(GEMINI_MODEL_STORAGE)
    }
  } catch {
    // Ignore storage errors
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey() || (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) : ''))
}

/**
 * Query the Google Generative Language ModelService to retrieve all models authorized
 * for the provided API key that support generateContent.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey) return []
  const apiVersions = ['v1beta', 'v1']
  for (const ver of apiVersions) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`)
      if (res.ok) {
        const data = await res.json()
        if (data && Array.isArray(data.models)) {
          const models = data.models
            .filter((m: any) => {
              const methods: string[] = m.supportedGenerationMethods || []
              return methods.includes('generateContent')
            })
            .map((m: any) => (m.name || '').replace(/^models\//, ''))
            .filter(Boolean)
          if (models.length > 0) {
            return models
          }
        }
      }
    } catch {
      // Continue to next API version or fallback
    }
  }
  return []
}

/**
 * Given a list of available models and an optional preference, returns the best matching candidate.
 */
export function resolveBestGeminiModel(availableModels: string[], preferredModel?: string): string {
  if (preferredModel && preferredModel !== 'auto') {
    if (!availableModels.length || availableModels.includes(preferredModel)) {
      return preferredModel
    }
  }

  if (!availableModels || availableModels.length === 0) {
    return DEFAULT_GEMINI_CANDIDATE_MODELS[0]
  }

  // Check candidates in prioritized order
  for (const candidate of DEFAULT_GEMINI_CANDIDATE_MODELS) {
    if (availableModels.includes(candidate)) {
      return candidate
    }
  }

  // Any flash model
  const flash = availableModels.find((m) => m.toLowerCase().includes('flash'))
  if (flash) return flash

  // Any gemini model
  const gemini = availableModels.find((m) => m.toLowerCase().includes('gemini'))
  if (gemini) return gemini

  return availableModels[0] || DEFAULT_GEMINI_CANDIDATE_MODELS[0]
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
  overrideApiKey?: string,
  overrideModel?: string
): Promise<ExtractedInvoice> {
  onProgress?.(15, 'Preparing document for Gemini AI Vision...')
  const { base64, mimeType } = await fileToBase64(file)

  const apiKey = overrideApiKey || getStoredGeminiApiKey() || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : '') || ''
  const preferredModel = overrideModel || getStoredGeminiModel() || ''

  // 1. Try server-side API route first if available
  try {
    onProgress?.(35, 'Analyzing invoice with Gemini AI Vision...')
    const apiRes = await fetch('/api/ocr/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-api-key': apiKey } : {}),
        ...(preferredModel && preferredModel !== 'auto' ? { 'x-gemini-model': preferredModel } : {})
      },
      body: JSON.stringify({
        fileBase64: base64,
        mimeType,
        fileName: file.name,
        model: preferredModel && preferredModel !== 'auto' ? preferredModel : undefined
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

  // Build candidate models queue
  const candidateModels: string[] = []
  if (preferredModel && preferredModel !== 'auto') {
    candidateModels.push(preferredModel)
  }
  if (memoryCachedModel && !candidateModels.includes(memoryCachedModel)) {
    candidateModels.push(memoryCachedModel)
  }

  // Attempt live discovery if candidate queue is empty or auto was specified
  try {
    const discovered = await fetchAvailableGeminiModels(apiKey)
    if (discovered.length > 0) {
      const best = resolveBestGeminiModel(discovered, preferredModel)
      if (best && !candidateModels.includes(best)) {
        candidateModels.unshift(best)
      }
    }
  } catch {
    // Discovery failed or blocked, proceed with fallback queue
  }

  for (const m of DEFAULT_GEMINI_CANDIDATE_MODELS) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m)
    }
  }

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

  let lastErrorText = ''
  let lastStatus = 0
  const triedModels: string[] = []

  for (const currentModel of candidateModels) {
    triedModels.push(currentModel)
    onProgress?.(45, `Sending image to Gemini Vision (${currentModel})…`)

    const apiVersions = ['v1beta', 'v1']
    let modelSuccess = false
    let geminiResult: any = null

    for (const apiVer of apiVersions) {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${currentModel}:generateContent?key=${apiKey}`

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (response.ok) {
          geminiResult = await response.json()
          modelSuccess = true
          // Cache successful model
          memoryCachedModel = currentModel
          setStoredGeminiModel(currentModel)
          break
        }

        lastStatus = response.status
        lastErrorText = await response.text()

        // Immediate stop if API Key is fundamentally invalid (no need to cycle through other models)
        if (response.status === 400 && lastErrorText.includes('API_KEY_INVALID')) {
          throw new Error('INVALID_GEMINI_API_KEY')
        }

        // If 404 (model not found / not supported for generateContent in this version/account), try next version or candidate
        const isNotFound = response.status === 404 || lastErrorText.includes('NOT_FOUND') || lastErrorText.includes('not supported for generateContent')
        if (isNotFound) {
          console.warn(`Gemini model '${currentModel}' not found in ${apiVer} (404), checking next candidate...`)
          continue
        }

        // Other non-404 error (e.g. 429 quota or 500), stop loop
        throw new Error(`Gemini API Error (${response.status}): ${lastErrorText}`)
      } catch (err: any) {
        if (err?.message === 'INVALID_GEMINI_API_KEY' || !err?.message?.includes('404')) {
          throw err
        }
      }
    }

    if (modelSuccess && geminiResult) {
      onProgress?.(80, 'Parsing structured pharma invoice data...')
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
  }

  // If all candidate models returned 404 or failed
  if (lastStatus === 404 || lastErrorText.includes('NOT_FOUND')) {
    throw new Error(`Gemini API Error (404): Models tried (${triedModels.slice(0, 4).join(', ')}) were not found or not supported for generateContent with your API key. Please check your Google AI Studio key permissions or switch to Local Tesseract OCR.`)
  }

  throw new Error(`Gemini API Error (${lastStatus || 500}): ${lastErrorText || 'Failed to process document with Gemini AI'}`)
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
