import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_GEMINI_CANDIDATE_MODELS = [
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fileBase64, mimeType, model: requestedModel } = body

    if (!fileBase64) {
      return NextResponse.json({ error: 'fileBase64 is required' }, { status: 400 })
    }

    const apiKey =
      req.headers.get('x-gemini-api-key') ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured. Please supply an API key.' },
        { status: 401 }
      )
    }

    const preferredModel = (req.headers.get('x-gemini-model') || requestedModel || '').trim()

    // Build candidate models queue
    const candidateModels: string[] = []
    if (preferredModel && preferredModel !== 'auto') {
      candidateModels.push(preferredModel)
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
                mime_type: mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf') ? mimeType : 'image/jpeg',
                data: fileBase64
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
      const apiVersions = ['v1beta', 'v1']

      for (const apiVer of apiVersions) {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${currentModel}:generateContent?key=${apiKey}`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        if (response.ok) {
          const geminiData = await response.json()
          const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
          if (!candidateText) {
            return NextResponse.json({ error: 'Gemini returned empty response' }, { status: 502 })
          }

          let parsedJson: any
          try {
            parsedJson = JSON.parse(candidateText)
          } catch {
            const cleaned = candidateText.replace(/```(?:json)?/g, '').trim()
            parsedJson = JSON.parse(cleaned)
          }

          return NextResponse.json(parsedJson)
        }

        lastStatus = response.status
        lastErrorText = await response.text()

        // If invalid key, return immediately
        if (response.status === 400 && lastErrorText.includes('API_KEY_INVALID')) {
          return NextResponse.json({ error: 'Invalid Gemini API key.' }, { status: 400 })
        }

        // If 404 / not found, continue to next model/version
        const isNotFound = response.status === 404 || lastErrorText.includes('NOT_FOUND') || lastErrorText.includes('not supported for generateContent')
        if (isNotFound) {
          continue
        }

        // Other client/server error (e.g. 429 quota or 500)
        return NextResponse.json({ error: `Gemini API returned ${response.status}: ${lastErrorText}` }, { status: response.status })
      }
    }

    // All candidate models exhausted
    return NextResponse.json({
      error: `Gemini API Error (404): Models tried (${triedModels.slice(0, 4).join(', ')}) were not found for this API key. ${lastErrorText}`
    }, { status: 404 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error processing invoice with Gemini' }, { status: 500 })
  }
}
