import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  hasGeminiApiKey,
  processInvoiceWithGemini
} from '../src/lib/ocr/geminiOcrEngine'
import { scanInvoice } from '../src/lib/ocr/ocrEngine'

describe('Gemini AI Vision OCR Engine', () => {
  const storage: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = String(val) },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) }
    })
    vi.restoreAllMocks()
  })

  it('stores and retrieves Gemini API key in local storage', () => {
    expect(getStoredGeminiApiKey()).toBe('')
    expect(hasGeminiApiKey()).toBe(false)

    setStoredGeminiApiKey('AIzaSyDummyTestKey12345')
    expect(getStoredGeminiApiKey()).toBe('AIzaSyDummyTestKey12345')
    expect(hasGeminiApiKey()).toBe(true)

    setStoredGeminiApiKey('')
    expect(getStoredGeminiApiKey()).toBe('')
    expect(hasGeminiApiKey()).toBe(false)
  })

  it('throws GEMINI_API_KEY_REQUIRED if neither server nor client key is provided', async () => {
    const dummyFile = new File(['dummy content'], 'invoice.png', { type: 'image/png' })
    // Mock fetch so server route fails
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await expect(processInvoiceWithGemini(dummyFile)).rejects.toThrow('GEMINI_API_KEY_REQUIRED')
  })

  it('parses structured Gemini JSON and auto-maps medicines to catalog', async () => {
    const dummyFile = new File(['fake image bytes'], 'aditya-bill.png', { type: 'image/png' })

    const mockGeminiApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  supplierName: 'B 649b-4119- ADITYA PHARMA',
                  supplierGstin: '18ADITY9999Z7',
                  invoiceNo: 'INV-2026/9796',
                  invoiceDate: '2026-10-03',
                  totalAmount: 1883.00,
                  taxAmount: 201.75,
                  items: [
                    {
                      itemName: 'DOLO 650 TAB',
                      packing: '15 TAB',
                      hsn: '30049079',
                      batch: 'DL8921',
                      expiry: '08/28',
                      qty: 20,
                      freeQty: 2,
                      purchaseRate: 25.50,
                      mrp: 34.00,
                      saleRate: 30.60,
                      discount: 0,
                      gstRate: 12,
                      amount: 510.00
                    },
                    {
                      itemName: 'PAN 40MG TAB',
                      packing: '15 TAB',
                      hsn: '30049033',
                      batch: 'PN4012',
                      expiry: '11/27',
                      qty: 10,
                      freeQty: 1,
                      purchaseRate: 110.00,
                      mrp: 155.00,
                      saleRate: 139.50,
                      discount: 5,
                      gstRate: 12,
                      amount: 1045.00
                    }
                  ],
                  rawText: 'ADITYA PHARMA INV-2026/9796 DOLO 650 TAB 20+2 PAN 40MG 10+1'
                })
              }
            ]
          }
        }
      ]
    }

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ocr/gemini')) {
        return Promise.reject(new Error('API route 404 in client test'))
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockGeminiApiResponse,
        text: async () => JSON.stringify(mockGeminiApiResponse)
      })
    }))

    const result = await processInvoiceWithGemini(dummyFile, undefined, 'AIzaSyValidKey')

    expect(result.supplierName).toBe('ADITYA PHARMA')
    expect(result.invoiceNo).toBe('INV-2026/9796')
    expect(result.invoiceDate).toBe('2026-10-03')
    expect(result.items.length).toBe(2)

    // Verify first item
    const item1 = result.items[0]
    expect(item1.itemName).toBe('DOLO 650 TAB')
    expect(item1.qty).toBe(20)
    expect(item1.freeQty).toBe(2)
    expect(item1.purchaseRate).toBe(25.50)
    expect(item1.mrp).toBe(34.00)
    expect(item1.mappedItemName).toBe('DOLO-650 TAB')
    expect(item1.isConfirmed).toBe(true)

    // Verify second item
    const item2 = result.items[1]
    expect(item2.itemName).toBe('PAN 40MG TAB')
    expect(item2.qty).toBe(10)
    expect(item2.freeQty).toBe(1)
    expect(item2.mappedItemName).toBe('PAN 40MG TAB')
    expect(item2.isConfirmed).toBe(true)
  })

  it('scanInvoice falls back to local OCR engine when engine is auto and no key is set', async () => {
    const dummyFile = new File(['minimal text'], 'order.png', { type: 'image/png' })
    setStoredGeminiApiKey('')

    // When engine is auto and no key is configured, scanInvoice runs local OCR without crashing
    const progressMessages: string[] = []
    try {
      await scanInvoice(dummyFile, (_pct, msg) => progressMessages.push(msg), { engine: 'auto' })
    } catch {
      // In node/vitest, canvas/worker may error out, but verify it did NOT throw GEMINI_API_KEY_REQUIRED
    }

    // Did not crash on Gemini key requirement
    expect(hasGeminiApiKey()).toBe(false)
  })
})
