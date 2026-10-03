import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processInvoiceWithQwenCloud } from '../src/lib/ocr/qwenOcrEngine'

describe('Qwen / OpenRouter Cloud AI Vision OCR Engine', () => {
  const storage: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = String(val)
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        Object.keys(storage).forEach((k) => delete storage[k])
      },
    })
    vi.restoreAllMocks()
  })

  it('cascades past moderation "User Safety: safe" and extracts from the next valid model', async () => {
    storage['openrouter_api_key'] = 'sk-or-v1-testkey12345'

    const dummyFile = new File(['fake-invoice-content'], 'test_invoice.jpg', { type: 'image/jpeg' })

    const modelsAttempted: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, opts: any) => {
        const body = JSON.parse(opts.body)
        modelsAttempted.push(body.model)

        // First model returns moderation text
        if (modelsAttempted.length === 1) {
          return {
            ok: true,
            status: 200,
            text: async () => 'User Safety: safe',
            json: async () => ({
              choices: [{ message: { content: 'User Safety: safe' } }],
            }),
          }
        }

        // Second model returns valid structured JSON
        const sampleResponse = JSON.stringify({
          supplierName: 'MAHESH PHARMA DISTRIBUTORS',
          supplierGstin: '18AABCM1234D1Z5',
          invoiceNo: 'INV-2026-99',
          invoiceDate: '2026-10-02',
          totalAmount: 1250.0,
          taxAmount: 150.0,
          items: [
            {
              itemName: 'DOLO 650 TAB',
              packing: '15s',
              hsn: '30049099',
              batch: 'BAT-11',
              expiry: '08/28',
              qty: 10,
              freeQty: 1,
              purchaseRate: 25.5,
              mrp: 35.0,
              saleRate: 31.5,
              discount: 0,
              gstRate: 12,
              amount: 255.0,
            },
          ],
        })

        return {
          ok: true,
          status: 200,
          text: async () => sampleResponse,
          json: async () => ({
            choices: [
              {
                message: {
                  content: sampleResponse,
                },
              },
            ],
          }),
        }
      })
    )

    const result = await processInvoiceWithQwenCloud(dummyFile)

    expect(modelsAttempted.length).toBeGreaterThanOrEqual(2)
    expect(result.supplierName).toBe('MAHESH PHARMA DISTRIBUTORS')
    expect(result.items.length).toBe(1)
    expect(result.items[0].itemName).toBe('DOLO 650 TAB')
    expect(result.items[0].qty).toBe(10)
    expect(result.items[0].freeQty).toBe(1)
    expect(result.totalAmount).toBe(1250)
    expect(result.rawText).toContain('MAHESH PHARMA DISTRIBUTORS')
  })

  it('automatically repairs truncated JSON when the output ends mid-array', async () => {
    storage['openrouter_api_key'] = 'sk-or-v1-testkey12345'
    const dummyFile = new File(['fake-invoice-content'], 'test_invoice.jpg', { type: 'image/jpeg' })

    const truncatedOutput = `{
  "supplierName": "TIRUPATI PHARMACEUTICALS",
  "invoiceNo": "TP-4091",
  "items": [
    {
      "itemName": "PAN 40MG TAB",
      "qty": 20,
      "freeQty": 2,
      "purchaseRate": 85.00,
      "mrp": 120.00,
      "amount": 1700.00
    }`

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => truncatedOutput,
        json: async () => ({
          choices: [{ message: { content: truncatedOutput } }],
        }),
      })
    )

    const result = await processInvoiceWithQwenCloud(dummyFile)

    expect(result.supplierName).toBe('TIRUPATI PHARMACEUTICALS')
    expect(result.invoiceNo).toBe('TP-4091')
    expect(result.items.length).toBe(1)
    expect(result.items[0].itemName).toBe('PAN 40MG TAB')
    expect(result.items[0].qty).toBe(20)
    expect(result.items[0].freeQty).toBe(2)
  })

  it('falls back to server route /api/ocr/qwen-cloud when direct call fails', async () => {
    storage['openrouter_api_key'] = 'sk-or-v1-testkey12345'
    const dummyFile = new File(['fake-invoice-content'], 'test_invoice.jpg', { type: 'image/jpeg' })

    const serverContent = JSON.stringify({
      supplierName: 'REBA HEALTHCARE',
      invoiceNo: 'RH-101',
      items: [
        {
          itemName: 'TELMA 40MG TAB',
          qty: 50,
          freeQty: 5,
          purchaseRate: 98.0,
          mrp: 135.0,
          amount: 4900.0,
        },
      ],
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('openrouter.ai')) {
          // Direct call fails with 429 rate limit
          return {
            ok: false,
            status: 429,
            text: async () => 'Rate limit exceeded',
          }
        }
        if (url.includes('/api/ocr/qwen-cloud')) {
          // Server route responds successfully
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ content: serverContent, model: 'Groq / Llama-3.2' }),
            json: async () => ({ content: serverContent, model: 'Groq / Llama-3.2' }),
          }
        }
        throw new Error('Unknown URL: ' + url)
      })
    )

    const result = await processInvoiceWithQwenCloud(dummyFile)

    expect(result.supplierName).toBe('REBA HEALTHCARE')
    expect(result.invoiceNo).toBe('RH-101')
    expect(result.items.length).toBe(1)
    expect(result.items[0].itemName).toBe('TELMA 40MG TAB')
    expect(result.items[0].qty).toBe(50)
  })
})
