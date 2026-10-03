import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanInvoice } from '../src/lib/ocr/ocrEngine'
import * as qwenEngine from '../src/lib/ocr/qwenOcrEngine'

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    setParameters: vi.fn(async () => undefined),
    recognize: vi.fn(async () => ({
      data: {
        text: `ADITYA PHARMACEUTICALS\nINV-8891 02/10/2026\nPAN 40MG TAB 10 100.00 140.00\nDOLO 650 TAB 20 25.00 35.00`,
        confidence: 85,
      },
    })),
    terminate: vi.fn(async () => undefined),
  })),
}))

describe('scanInvoice Automatic Failover Cascade', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('automatically falls back to local OCR when openrouter cloud fails', async () => {
    // Mock qwen cloud engine to fail (e.g. Rate limited or network failure)
    vi.spyOn(qwenEngine, 'processInvoiceWithQwenCloud').mockRejectedValue(
      new Error('All configured cloud providers failed. Rate limited.')
    )

    const dummyFile = new File(['fake-invoice-content'], 'invoice.jpg', { type: 'image/jpeg' })

    const progressMessages: string[] = []
    const result = await scanInvoice(
      dummyFile,
      (_pct, msg) => {
        if (msg) progressMessages.push(msg)
      },
      { engine: 'openrouter' }
    )

    // Verify it succeeded despite OpenRouter error
    expect(result).toBeDefined()
    expect(result.items.length).toBeGreaterThan(0)
    expect(progressMessages.some((m) => m.includes('Falling back to Local Offline OCR'))).toBe(true)
  })
})
