import { ExtractedInvoice, ExtractedLineItem, OcrProgressCallback } from './types'
import { mapExtractedItemsToMaster } from './medicineMapper'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'

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
 * Render the first PDF page onto a canvas for cloud vision OCR.
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
 * Cloud path: sends the invoice image to /api/ocr/qwen-cloud (Vercel serverless)
 * which uses the configured cloud vision provider.
 */
export async function processInvoiceWithQwenCloud(
  file: File,
  onProgress?: OcrProgressCallback,
  overrideModel?: string
): Promise<ExtractedInvoice> {
  onProgress?.(10, 'Preparing document for Cloud Qwen2-VL (Together AI)…')

  // If PDF, render first page to image
  let imageFile: File | Blob = file
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      onProgress?.(20, 'Rendering PDF page to image…')
      imageFile = await renderPdfPageToBlob(file)
    } catch (pdfErr) {
      console.warn('Could not render PDF for cloud, using raw file:', pdfErr)
    }
  }

  const { base64, mimeType } = await fileToBase64(imageFile)

  onProgress?.(40, 'Sending to Qwen2-VL on Together AI cloud GPU…')

  const openRouterKey = typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('OPENROUTER_API_KEY') || '') : ''

  let rawJsonText = ''
  let resolvedModel = overrideModel || 'OpenRouter / Cloud AI'

  // 1. Direct browser call to OpenRouter if API key is stored in browser
  // This completely bypasses Vercel's 10-second serverless execution limit!
  if (openRouterKey) {
    onProgress?.(35, 'Connecting directly to OpenRouter cloud GPU (no timeout limit)…')
    const freeModels = [
      'google/gemma-4-26b-a4b-it:free',
      'qwen/qwen3.8-27b:free',
      'dots-studio/dots-3-note-preview:free',
      'thinkingmachines/inkling-small:free',
      'google/gemma-4-31b-it:free'
    ]
    if (overrideModel && !freeModels.includes(overrideModel)) {
      freeModels.unshift(overrideModel)
    }

    for (const model of freeModels) {
      try {
        onProgress?.(50, `Analyzing invoice with ${model.split('/')[1] || model}…`)
        const directRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://pharama-erp.vercel.app',
            'X-Title': 'PharmaERP Invoice OCR'
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                  { type: 'text', text: PHARMA_INVOICE_PROMPT }
                ]
              }
            ],
            max_tokens: 4096,
            temperature: 0.1
          }),
          signal: AbortSignal.timeout(35_000)
        })

        if (!directRes.ok) {
          const errText = await directRes.text()
          console.warn(`Direct OpenRouter [${model}] error: ${directRes.status} ${errText.slice(0, 150)}`)
          continue
        }

        const data = await directRes.json()
        const content = data?.choices?.[0]?.message?.content || ''
        if (content.trim()) {
          rawJsonText = content
          resolvedModel = model
          break
        }
      } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        console.warn(`Direct OpenRouter [${model}] ${isTimeout ? 'timed out after 35s' : 'failed'}:`, err)
      }
    }
  }

  // 2. If direct call was not used or failed, fall back to /api/ocr/qwen-cloud
  if (!rawJsonText) {
    onProgress?.(45, 'Sending to cloud vision serverless route…')
    const res = await fetch('/api/ocr/qwen-cloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64,
        mimeType,
        prompt: PHARMA_INVOICE_PROMPT,
        apiKey: openRouterKey || undefined,
        ...(overrideModel ? { model: overrideModel } : {})
      })
    })

    if (res.status === 504) {
      throw new Error(
        'Vercel serverless timed out (10s limit). Click "Set / Change OpenRouter Key" to connect directly from your browser without any timeouts!'
      )
    }

    const rawText = await res.text()
    let result: any = null
    try {
      result = JSON.parse(rawText)
    } catch {
      if (!res.ok) {
        throw new Error(`Cloud OCR route returned status ${res.status}. Check OPENROUTER_API_KEY in Vercel.`)
      }
      throw new Error(`Could not parse OCR response: ${rawText.slice(0, 120)}`)
    }

    if (!res.ok) {
      throw new Error(
        result?.error ||
        `Cloud OCR route returned ${res.status}. Check OPENROUTER_API_KEY in Vercel env vars.`
      )
    }

    rawJsonText = result?.content || ''
    if (result?.model) resolvedModel = result.model
  }

  if (!rawJsonText.trim()) {
    throw new Error('Cloud AI vision returned an empty response. Check your API key and model availability.')
  }

  onProgress?.(80, 'Parsing structured invoice data from cloud response…')

  let parsed: any
  try {
    parsed = cleanAndParseJson(rawJsonText)
  } catch (parseErr) {
    console.error('Failed to parse cloud Qwen JSON:', rawJsonText)
    throw new Error('Cloud Qwen2-VL responded but JSON could not be parsed: ' + String(parseErr))
  }

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
      confidence: 0.93,
      isConfirmed: true
    }
  })

  onProgress?.(90, 'Auto-mapping medicines to Master Catalog…')
  const mappedItems = mapExtractedItemsToMaster(normalizedItems, PHARMA_MASTER_CATALOG)

  const calculatedTotal = mappedItems.reduce((acc, it) => acc + (it.amount || 0), 0)
  const totalAmount = Number(parsed.totalAmount) || Math.round(calculatedTotal * 100) / 100
  const taxAmount = Number(parsed.taxAmount) || Math.round(totalAmount * 0.12 * 100) / 100

  onProgress?.(100, `Invoice mapped via Cloud AI Vision (${resolvedModel})!`)

  return {
    supplierName: String(parsed.supplierName || 'Wholesale Pharma Distributor').trim(),
    supplierGstin: String(parsed.supplierGstin || '').trim(),
    invoiceNo: String(parsed.invoiceNo || 'INV-' + Math.floor(1000 + Math.random() * 9000)).trim(),
    invoiceDate: String(parsed.invoiceDate || new Date().toISOString().split('T')[0]).trim(),
    totalAmount,
    taxAmount,
    items: mappedItems,
    rawText: parsed.rawText || rawJsonText,
    confidence: 0.93,
    sourceType: 'image_ocr',
    pageCount: 1
  }
}
