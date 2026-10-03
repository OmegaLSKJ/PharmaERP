import { ExtractedInvoice, OcrProgressCallback } from './types'
import { parsePharmaInvoice } from './pharmaInvoiceParser'
import { processInvoiceWithGemini, hasGeminiApiKey, getStoredGeminiApiKey } from './geminiOcrEngine'

export type OcrEngineChoice = 'gemini' | 'tesseract' | 'auto'

export interface ScanInvoiceOptions {
  engine?: OcrEngineChoice
  apiKey?: string
  model?: string
}

/**
 * Sauvola / Bradley-Roth Adaptive Binarization with Contrast Normalization
 * Specifically tuned for Indian pharmacy purchase bills:
 * - Eliminates uneven lighting and smartphone camera shadows
 * - Whitens colored / carbon-copy paper backgrounds (yellow/pink/gray)
 * - Bridges faint dot-matrix printer pin gaps for high character continuity
 */
function applyAdaptiveBinarization(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height)
  const d = imgData.data
  const n = width * height
  const gray = new Uint8ClampedArray(n)

  // 1. Calculate luminance grayscale
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
  }

  // 2. Compute Integral Image for O(1) local mean computation
  const integral = new Uint32Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let sum = 0
    const rowOffset = (y + 1) * (width + 1)
    const prevRowOffset = y * (width + 1)
    const grayRowOffset = y * width
    for (let x = 0; x < width; x++) {
      sum += gray[grayRowOffset + x]
      integral[rowOffset + (x + 1)] = integral[prevRowOffset + (x + 1)] + sum
    }
  }

  // 3. Local adaptive thresholding using moving window (~3.5% of image width)
  const s = Math.max(16, Math.floor(width / 28))
  const s2 = Math.floor(s / 2)
  const t = 0.13 // Ink sensitivity factor

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - s2)
    const y2 = Math.min(height - 1, y + s2)
    const rowOffset = y * width

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - s2)
      const x2 = Math.min(width - 1, x + s2)
      const count = (x2 - x1 + 1) * (y2 - y1 + 1)

      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1]

      const pixelIdx = rowOffset + x
      const pixelVal = gray[pixelIdx]
      const localMean = sum / count

      const isInk = pixelVal < localMean * (1 - t)
      const outVal = isInk ? 0 : 255

      const dIdx = pixelIdx * 4
      d[dIdx] = outVal
      d[dIdx + 1] = outVal
      d[dIdx + 2] = outVal
      d[dIdx + 3] = 255
    }
  }

  // 4. Dot-matrix horizontal pin-bridge dilation:
  // Fills 1-2px gaps between adjacent dot-matrix pins to create continuous character glyphs
  const outD = new Uint8ClampedArray(d)
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width * 4
    for (let x = 2; x < width - 2; x++) {
      const idx = rowOffset + x * 4
      if (d[idx] === 255) {
        const leftInk = d[idx - 4] === 0 || d[idx - 8] === 0
        const rightInk = d[idx + 4] === 0 || d[idx + 8] === 0
        if (leftInk && rightInk) {
          outD[idx] = 0
          outD[idx + 1] = 0
          outD[idx + 2] = 0
        }
      }
    }
  }

  ctx.putImageData(new ImageData(outD, width, height), 0, 0)
}

/**
 * Preprocesses an invoice image with adaptive thresholding & stroke normalization for high OCR accuracy
 */
export async function preprocessImage(imageFile: File | Blob): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Node environment fallback
    return URL.createObjectURL(imageFile)
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(imageFile)
    img.onload = () => {
      URL.revokeObjectURL(url)

      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(URL.createObjectURL(imageFile))
          return
        }

        // Scale to optimal OCR DPI target (~1800-2400px on longest dimension)
        const maxDim = Math.max(img.width, img.height)
        const targetDim = Math.min(2600, Math.max(1800, maxDim))
        const scale = targetDim / maxDim

        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Apply adaptive binarization and dot-matrix stroke bridging
        applyAdaptiveBinarization(ctx, canvas.width, canvas.height)

        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(URL.createObjectURL(imageFile))
      }
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
 * Configured with full-precision unquantized tessdata_best weights,
 * column layout preservation, and dual-pass adaptive parsing.
 */
export async function scanInvoiceImage(
  imageFile: File | Blob,
  onProgress?: OcrProgressCallback
): Promise<ExtractedInvoice> {
  onProgress?.(10, 'Initializing high-precision WebAssembly OCR engine…')

  const processedImageUrl = await preprocessImage(imageFile)
  onProgress?.(25, 'Enhancing image contrast & bridging dot-matrix strokes…')

  // Dynamically load Tesseract worker
  const tesseractModule = await loadTesseractModule()
  const createWorkerFn = tesseractModule.createWorker || tesseractModule.default?.createWorker
  if (typeof createWorkerFn !== 'function') {
    throw new Error('Tesseract createWorker function is unavailable.')
  }

  // 1. Resolve local offline model or fallback to tessdata_best CDN
  const localOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
  const langPath = localOrigin ? `${localOrigin}/tessdata` : 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_best@main'

  const worker = await createWorkerFn('eng', 1, {
    langPath,
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        const pct = 30 + Math.round((m.progress || 0) * 60)
        onProgress?.(pct, `Scanning bill contents (${Math.round((m.progress || 0) * 100)}%)…`)
      }
    }
  })

  try {
    // Configure table-aware columnar parameters
    if (typeof worker.setParameters === 'function') {
      try {
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: '4', // PSM 4: Assume a single column of text of variable sizes (table structure)
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/-+%*&:;()[]# \n\r\t'
        })
      } catch {
        // Fallback gracefully if some parameter is unsupported by worker version
      }
    }

    const ret = await worker.recognize(processedImageUrl)
    let text = ret.data.text || ''

    // Dual-pass fallback: if PSM 4 yielded sparse lines on an unusual bill format, re-run with PSM 6 (single block)
    if (!text || text.split('\n').filter((l: string) => l.trim().length > 3).length < 2) {
      if (typeof worker.setParameters === 'function') {
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: '6' // PSM 6: Assume a single uniform block of text
          })
          const retryRet = await worker.recognize(processedImageUrl)
          if (retryRet.data.text && retryRet.data.text.length > text.length) {
            text = retryRet.data.text
          }
        } catch {
          // Keep initial result
        }
      }
    }

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
 * Supports high-accuracy Gemini 1.5 Flash Vision with automatic local Tesseract fallback
 */
export async function scanInvoice(
  file: File,
  onProgress?: OcrProgressCallback,
  options?: ScanInvoiceOptions
): Promise<ExtractedInvoice> {
  const chosenEngine = options?.engine || 'auto'
  const explicitKey = options?.apiKey || getStoredGeminiApiKey()
  const explicitModel = options?.model
  const canUseGemini = chosenEngine === 'gemini' || (chosenEngine === 'auto' && (hasGeminiApiKey() || Boolean(explicitKey)))

  if (canUseGemini) {
    try {
      return await processInvoiceWithGemini(file, onProgress, explicitKey, explicitModel)
    } catch (err: any) {
      // If user explicitly selected Gemini, rethrow error so user knows what went wrong (e.g. invalid key)
      if (chosenEngine === 'gemini') {
        throw err
      }
      console.warn('Gemini OCR unavailable, falling back to local Tesseract OCR engine:', err)
      onProgress?.(20, 'Switching to local offline OCR engine…')
    }
  }

  // Local fallback (Tesseract / PDF.js)
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    return scanInvoicePdf(file, onProgress)
  }
  return scanInvoiceImage(file, onProgress)
}
