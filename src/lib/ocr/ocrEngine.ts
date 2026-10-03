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

      // If image is already high resolution, preserve original pixels for Tesseract's built-in Leptonica Otsu binarizer
      if (img.width >= 1200 && img.height >= 1200) {
        resolve(URL.createObjectURL(imageFile))
        return
      }

      // Upscale if too small (e.g. low-res phone camera) to ensure character strokes are distinct
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(URL.createObjectURL(imageFile))
        return
      }

      const scale = Math.max(1, Math.min(2.5, 2000 / Math.max(img.width, img.height)))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(URL.createObjectURL(imageFile))
    img.src = url
  })
}

/**
 * Dynamically loads Tesseract.js using bundler import, window global, or CDN fallback
 */
async function loadTesseractModule(): Promise<any> {
  // 1. Try bundler dynamic import
  try {
    const mod: any = await import('tesseract.js')
    if (mod && (typeof mod.createWorker === 'function' || typeof mod.default?.createWorker === 'function')) {
      return mod
    }
  } catch (err) {
    console.warn('Direct tesseract.js import not resolved, checking browser globals/CDN...', err)
  }

  // 2. Check if window.Tesseract is already loaded
  if (typeof window !== 'undefined' && (window as any).Tesseract) {
    return (window as any).Tesseract
  }

  // 3. Fallback: dynamically load via CDN in the browser
  if (typeof window !== 'undefined') {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract-cdn]')
      if (existing) {
        if ((window as any).Tesseract) return resolve((window as any).Tesseract)
        existing.addEventListener('load', () => resolve((window as any).Tesseract))
        existing.addEventListener('error', () => reject(new Error('Failed to load Tesseract from CDN.')))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
      script.setAttribute('data-tesseract-cdn', 'true')
      script.onload = () => resolve((window as any).Tesseract)
      script.onerror = () => reject(new Error('Failed to load Tesseract OCR engine from CDN.'))
      document.head.appendChild(script)
    })
  }

  throw new Error('Tesseract OCR engine could not be initialized.')
}

/**
 * Dynamically loads PDF.js using bundler import, window global, or CDN fallback
 */
async function loadPdfJsModule(): Promise<any> {
  // 1. Try bundler dynamic import
  try {
    const mod: any = await import('pdfjs-dist')
    const lib = mod && typeof mod.getDocument === 'function' ? mod : mod?.default
    if (lib && typeof lib.getDocument === 'function') {
      if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions?.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version || '3.11.174'}/pdf.worker.min.js`
      }
      return lib
    }
  } catch (err) {
    console.warn('Direct pdfjs-dist import not resolved, checking browser globals/CDN...', err)
  }

  // 2. Check if window.pdfjsLib is already loaded
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib
  }

  // 3. Fallback: dynamically load via CDN in the browser
  if (typeof window !== 'undefined') {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-pdfjs-cdn]')
      if (existing) {
        if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib)
        existing.addEventListener('load', () => resolve((window as any).pdfjsLib))
        existing.addEventListener('error', () => reject(new Error('Failed to load PDF.js from CDN.')))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.setAttribute('data-pdfjs-cdn', 'true')
      script.onload = () => {
        const lib = (window as any).pdfjsLib
        if (lib && !lib.GlobalWorkerOptions?.workerSrc) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
        resolve(lib)
      }
      script.onerror = () => reject(new Error('Failed to load PDF engine from CDN.'))
      document.head.appendChild(script)
    })
  }

  throw new Error('PDF engine could not be initialized.')
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

  // Dynamically load Tesseract worker
  const tesseractModule = await loadTesseractModule()
  const createWorkerFn = tesseractModule.createWorker || tesseractModule.default?.createWorker
  if (typeof createWorkerFn !== 'function') {
    throw new Error('Tesseract createWorker function is unavailable.')
  }

  const worker = await createWorkerFn('eng', 1, {
    logger: (m: any) => {
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
    const pdfjsLib = await loadPdfJsModule()
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
