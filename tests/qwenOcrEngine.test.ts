import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStoredOllamaEndpoint,
  setStoredOllamaEndpoint,
  getStoredOllamaModel,
  setStoredOllamaModel,
  checkOllamaStatus,
  processInvoiceWithQwen,
  DEFAULT_OLLAMA_ENDPOINT
} from '../src/lib/ocr/qwenOcrEngine'
import { scanInvoice } from '../src/lib/ocr/ocrEngine'

describe('Local Qwen2-VL Offline Vision Engine (Ollama)', () => {
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
      }
    })
    vi.restoreAllMocks()
  })

  it('stores and retrieves Ollama endpoint and model', () => {
    expect(getStoredOllamaEndpoint()).toBe(DEFAULT_OLLAMA_ENDPOINT)
    expect(getStoredOllamaModel()).toBe('qwen2-vl:7b')

    setStoredOllamaEndpoint('http://192.168.1.50:11434/')
    expect(getStoredOllamaEndpoint()).toBe('http://192.168.1.50:11434')

    setStoredOllamaModel('qwen2-vl:2b')
    expect(getStoredOllamaModel()).toBe('qwen2-vl:2b')

    setStoredOllamaEndpoint('')
    expect(getStoredOllamaEndpoint()).toBe(DEFAULT_OLLAMA_ENDPOINT)
  })

  it('detects online status and installed vision models from Ollama api/tags', async () => {
    const mockTagsResponse = {
      models: [
        { name: 'llama3:8b' },
        { name: 'qwen2-vl:7b' },
        { name: 'mistral:latest' }
      ]
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTagsResponse
    }))

    const status = await checkOllamaStatus('http://localhost:11434')
    expect(status.online).toBe(true)
    expect(status.models).toContain('qwen2-vl:7b')
    expect(status.detectedVisionModel).toBe('qwen2-vl:7b')
  })

  it('handles offline Ollama daemon gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

    const status = await checkOllamaStatus('http://localhost:11434')
    expect(status.online).toBe(false)
    expect(status.models).toHaveLength(0)
  })

  it('processes invoice image and auto-enriches items with Master Catalog', async () => {
    const dummyInvoiceJson = {
      supplierName: 'TIRUPATI PHARMACEUTICALS',
      supplierGstin: '18AGRPD1963G1Z8',
      invoiceNo: 'TP/L3990',
      invoiceDate: '2023-09-29',
      totalAmount: 4246.0,
      taxAmount: 450.0,
      items: [
        {
          itemName: 'DOLO 650 TAB',
          packing: '15S',
          hsn: '300490',
          batch: 'DL102',
          expiry: '05/28',
          qty: 10,
          freeQty: 1,
          purchaseRate: 25.5,
          mrp: 34.0,
          saleRate: 30.0,
          gstRate: 5,
          amount: 255.0
        }
      ]
    }

    // Mock fetch for Ollama api/tags and api/chat
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ models: [{ name: 'qwen2-vl:7b' }] })
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify(dummyInvoiceJson)
          }
        })
      })
    }))

    const dummyFile = new File(['fake-invoice-content'], 'test_bill.png', { type: 'image/png' })
    const result = await processInvoiceWithQwen(dummyFile)

    expect(result.supplierName).toBe('TIRUPATI PHARMACEUTICALS')
    expect(result.invoiceNo).toBe('TP/L3990')
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0].itemName).toBe('DOLO 650 TAB')
    expect(result.items[0].purchaseRate).toBe(25.5)
    // Master catalog auto-mapping
    expect(result.items[0].mappedItemId).toBeDefined()
  })

  it('scanInvoice invokes Qwen2-VL when engine is set to qwen', async () => {
    const dummyFile = new File(['fake-data'], 'bill.png', { type: 'image/png' })

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ models: [{ name: 'qwen2-vl:7b' }] })
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              supplierName: 'BORGANG DRUG DISTRIBUTORS',
              invoiceNo: 'B-101',
              items: [{ itemName: 'PAN 40MG TAB', qty: 20, purchaseRate: 85.0 }]
            })
          }
        })
      })
    }))

    const result = await scanInvoice(dummyFile, undefined, { engine: 'qwen' })
    expect(result.supplierName).toBe('BORGANG DRUG DISTRIBUTORS')
    expect(result.items[0].itemName).toBe('PAN 40MG TAB')
    expect(result.items[0].purchaseRate).toBe(85.0)
  })
})
