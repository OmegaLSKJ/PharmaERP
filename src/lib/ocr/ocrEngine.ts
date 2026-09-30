import { createWorker } from 'tesseract.js'
import { ExtractedInvoice, OcrProgressCallback } from './types'
import { parsePharmaInvoice } from './pharmaInvoiceParser'

/**
 * Preprocesses an image to improve OCR accuracy on faint / carbon-copy printed bills
 */
export async function preprocessImage(imageFile: File | Blob): Promise<string> {
  if (typeof window === 'undefined') {
    // Node environment fallback
    return URL.createObjectURL(imageFile)
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(imageFile)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(url)
        return
      }

      // Upscale if too small (e.g. low-res phone camera)
      const scale = Math.max(1, Math.min(2, 2000 / Math.max(img.width, img.height)))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Apply Grayscale & High-Contrast filter
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        // Luminance
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        // Increase contrast: threshold slightly around midpoint
        const contrast = 1.2
        const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100))
        const newVal = Math.min(255, Math.max(0, factor * (v - 128) + 128))

        d[i] = newVal
        d[i + 1] = newVal
        d[i + 2] = newVal
      }
      ctx.putImageData(imgData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

/**
 * Scans an invoice image using local in-browser WebAssembly Tesseract OCR
 */
export async function scanInvoiceImage(
  imageFile: File | Blob,
  onProgress?: OcrProgressCallback
): Promise<ExtractedInvoice> {
  onProgress?.(10, 'Initializing WebAssembly OCR engine…')

  const processedImageUrl = await preprocessImage(imageFile)
  onProgress?.(25, 'Enhancing image contrast & clarity…')

  // Create Tesseract worker
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = 30 + Math.round((m.progress || 0) * 60)
        onProgress?.(pct, `Scanning bill contents (${Math.round((m.progress || 0) * 100)}%)…`)
      }
    }
  })

  try {
    const ret = await worker.recognize(processedImageUrl)
    const text = ret.data.text

    onProgress?.(95, 'Parsing medicine items, batches, and rates…')
    const extracted = parsePharmaInvoice(text, 'image_ocr')
    extracted.confidence = Math.round((ret.data.confidence || 85)) / 100

    onProgress?.(100, 'Invoice scanning complete!')
    return extracted
  } finally {
    await worker.terminate()
  }
}

/**
 * Extracts text from digital PDF (e.g. Marg ERP / Tally bills) or falls back to OCR
 */
export async function scanInvoicePdf(
  pdfFile: File,
  onProgress?: OcrProgressCallback
): Promise<ExtractedInvoice> {
  onProgress?.(10, 'Reading PDF structure…')

  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise

    const numPages = pdfDoc.numPages
    let fullText = ''

    for (let pageNum = 1; pageNum <= Math.min(numPages, 5); pageNum++) {
      onProgress?.(
        15 + Math.round((pageNum / numPages) * 60),
        `Extracting page ${pageNum} of ${numPages}…`
      )
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Sort items by Y (lines) and X (columns) to preserve invoice table layout
      const items = textContent.items as Array<any>
      if (items.length > 0) {
        // Group by approx Y coordinate
        items.sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5]
          if (Math.abs(yDiff) > 4) return yDiff
          return a.transform[4] - b.transform[4]
        })

        let lastY = null
        let pageStr = ''
        for (const it of items) {
          const currentY = Math.round(it.transform[5])
          if (lastY !== null && Math.abs(currentY - lastY) > 4) {
            pageStr += '\n'
          } else if (lastY !== null) {
            pageStr += '  '
          }
          pageStr += it.str
          lastY = currentY
        }
        fullText += pageStr + '\n'
      }
    }

    // If PDF contained digital text, parse directly
    if (fullText.trim().length > 80) {
      onProgress?.(95, 'Parsing digital invoice table…')
      const extracted = parsePharmaInvoice(fullText, 'digital_pdf')
      extracted.pageCount = numPages
      onProgress?.(100, 'Digital invoice processed successfully!')
      return extracted
    }

    // Scanned PDF (image-only) fallback: Render first page onto canvas and run OCR
    onProgress?.(40, 'Scanned PDF detected. Rendering page to high-res image…')
    const firstPage = await pdfDoc.getPage(1)
    const viewport = firstPage.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      await (firstPage.render as any)({ canvas, canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (blob) {
        return scanInvoiceImage(blob, onProgress)
      }
    }
  } catch (err) {
    console.warn('PDF.js direct extraction error, falling back to OCR:', err)
  }

  // Final fallback
  return scanInvoiceImage(pdfFile, onProgress)
}

/**
 * Universal invoice scanner supporting images (PNG, JPG, WebP) and PDFs
 */
export async function scanInvoice(
  file: File,
  onProgress?: OcrProgressCallback
): Promise<ExtractedInvoice> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    return scanInvoicePdf(file, onProgress)
  }
  return scanInvoiceImage(file, onProgress)
}
