/**
 * Smart Print Utilities for PharmaERP
 * 
 * Intelligently chooses between Portrait and Landscape orientation based on
 * document structure, column count, table width, and layout arrangement
 * to ensure maximum visibility, readability, and fit-to-page aesthetics.
 */

export type PrintOrientation = 'portrait' | 'landscape' | 'auto'

export interface SmartPrintOptions {
  orientation?: PrintOrientation
  target?: HTMLElement | string | null
}

const STYLE_ELEMENT_ID = 'smart-print-orientation-style'

/**
 * Determines the optimal print orientation based on content analysis:
 * - Wide tables with >= 7 columns (or 6 wide columns with narration/party) -> Landscape
 * - Registers, logs, daybooks, audit ledgers, GSTR matrices -> Landscape
 * - Invoices, bills, challans, cash vouchers, receipts, vertical summaries (<= 5 columns) -> Portrait
 */
export function detectOptimalOrientation(target?: HTMLElement | null): 'portrait' | 'landscape' {
  if (typeof document === 'undefined') return 'portrait'

  // 1. Explicit target or container evaluation
  let container: HTMLElement | null = target || null

  if (!container) {
    // Search for active print targets in DOM
    const printTargets = document.querySelectorAll<HTMLElement>(
      '[data-print-orientation], [data-print-target], .print\\:block:not(.hidden), .tax-invoice-bill, .goods-receipt-note-print, .voucher-print-bill, [data-print-header]'
    )
    for (const el of Array.from(printTargets)) {
      // Find the first target that is currently rendered or active
      if (el) {
        container = el
        break
      }
    }
  }

  if (container) {
    // Check explicit orientation attribute on target or any ancestor/descendant
    const explicitAttr = 
      container.getAttribute('data-print-orientation') ||
      container.closest('[data-print-orientation]')?.getAttribute('data-print-orientation') ||
      container.querySelector('[data-print-orientation]')?.getAttribute('data-print-orientation')

    if (explicitAttr === 'landscape' || explicitAttr === 'portrait') {
      return explicitAttr
    }

    // Check specific class indicators
    if (
      container.classList.contains('tax-invoice-bill') ||
      container.classList.contains('goods-receipt-note-print') ||
      container.classList.contains('voucher-print-bill') ||
      container.classList.contains('print-portrait') ||
      container.querySelector('.tax-invoice-bill, .goods-receipt-note-print, .voucher-print-bill, .print-portrait')
    ) {
      return 'portrait'
    }

    if (
      container.classList.contains('print-landscape') ||
      container.querySelector('.print-landscape')
    ) {
      return 'landscape'
    }
  }

  // 2. Table Column Count & Layout Heuristics
  const scope = container || document.body
  const tables = scope.querySelectorAll('table')

  let maxColumns = 0
  let hasWideContent = false

  tables.forEach((table) => {
    // Skip small UI tables or sub-tables inside invoices if any
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr')
    if (headerRow) {
      const colCount = headerRow.children.length
      if (colCount > maxColumns) {
        maxColumns = colCount
      }
    }

    // Inspect headers for wide content
    const headerTexts = Array.from(table.querySelectorAll('th, td')).map((c) =>
      (c.textContent || '').toLowerCase()
    )
    const wideKeywords = [
      'narration',
      'particulars',
      'party',
      'company',
      'customer',
      'supplier',
      'running balance',
      'closing balance',
      'sgst',
      'cgst',
      'igst',
      'description',
      'voucher no',
    ]
    const matchedKeywords = wideKeywords.filter((kw) =>
      headerTexts.some((text) => text.includes(kw))
    )
    if (matchedKeywords.length >= 3) {
      hasWideContent = true
    }
  })

  // Multi-column criteria:
  // - 7 or more columns strictly require Landscape on A4 (297mm width gives ~42mm per column vs ~28mm in portrait)
  // - 6 columns with wide narration/party/balances also require Landscape for optimal visibility
  if (maxColumns >= 7) {
    return 'landscape'
  }
  if (maxColumns === 6 && hasWideContent) {
    return 'landscape'
  }

  // 3. Document Title / Header Keywords
  const headerEl = scope.querySelector('[data-print-header], h1, .print-title')
  if (headerEl) {
    const titleText = (headerEl.textContent || '').toUpperCase()
    const landscapeKeywords = [
      'ALL TRANSACTIONS REGISTER',
      'CHRONOLOGICAL',
      'DAY BOOK',
      'TRANSACTIONS REGISTER',
      'SALES REGISTER',
      'PURCHASE REGISTER',
      'GSTR',
      'TRIAL BALANCE',
      'BALANCE SHEET',
      'PROFIT & LOSS',
      'STOCK REGISTER',
      'STOCK VIEW',
      'AUDIT LOG',
      'AGING',
    ]
    const matchesLandscapeTitle = landscapeKeywords.some((kw) => titleText.includes(kw))
    if (matchesLandscapeTitle && maxColumns >= 6) {
      return 'landscape'
    }
  }

  // 4. Default to Portrait for standard invoices, vouchers, and compact tables
  return 'portrait'
}

/**
 * Applies dynamic CSS @page rules to the document head to guarantee
 * the browser's native print preview dialog opens with the exact desired orientation.
 */
export function applyPrintOrientation(orientation: 'portrait' | 'landscape'): void {
  if (typeof document === 'undefined') return

  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ELEMENT_ID
    document.head.appendChild(styleEl)
  }

  styleEl.textContent = `
    @page {
      size: A4 ${orientation} !important;
      margin: 6mm 6mm 8mm 6mm !important;
    }
  `

  document.documentElement.setAttribute('data-print-orientation', orientation)
  if (document.body) {
    document.body.classList.remove('print-orientation-portrait', 'print-orientation-landscape')
    document.body.classList.add(`print-orientation-${orientation}`)
  }
}

/**
 * Resets or clears dynamically applied print orientation styles.
 */
export function clearPrintOrientation(): void {
  if (typeof document === 'undefined') return

  const styleEl = document.getElementById(STYLE_ELEMENT_ID)
  if (styleEl) {
    // Reset to default portrait
    styleEl.textContent = `
      @page {
        size: A4 portrait !important;
        margin: 6mm 6mm 8mm 6mm !important;
      }
    `
  }

  document.documentElement.removeAttribute('data-print-orientation')
  if (document.body) {
    document.body.classList.remove('print-orientation-portrait', 'print-orientation-landscape')
  }
}

/**
 * Native window.print reference saved before any monkey-patching.
 */
let nativePrint: (() => void) | null = null

/**
 * Executes a smart print with automatic or specified orientation.
 */
export function smartPrint(options?: SmartPrintOptions | PrintOrientation): void {
  if (typeof window === 'undefined') return

  const opts: SmartPrintOptions =
    typeof options === 'string' ? { orientation: options } : options || {}

  let targetEl: HTMLElement | null = null
  if (typeof opts.target === 'string') {
    targetEl = document.querySelector<HTMLElement>(opts.target)
  } else if (
    opts.target &&
    typeof opts.target === 'object' &&
    'getAttribute' in (opts.target as any)
  ) {
    targetEl = opts.target as HTMLElement
  }

  let finalOrientation: 'portrait' | 'landscape'

  if (opts.orientation && opts.orientation !== 'auto') {
    finalOrientation = opts.orientation
  } else {
    finalOrientation = detectOptimalOrientation(targetEl)
  }

  // Apply the @page orientation stylesheet before invoking browser print dialog
  applyPrintOrientation(finalOrientation)

  // One-time cleanup after print dialog is closed
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup)
    // Small timeout to allow print buffer to complete
    setTimeout(() => {
      clearPrintOrientation()
    }, 500)
  }
  window.addEventListener('afterprint', cleanup)

  // Invoke native print
  const printFn = nativePrint || window.print.bind(window)
  printFn()
}

/**
 * Initializes global smart printing by intercepting standard window.print calls.
 * Ensures all existing print buttons throughout the ERP automatically choose
 * between portrait and landscape based on content arrangement and visibility.
 */
export function setupSmartPrint(): void {
  if (typeof window === 'undefined') return

  // Prevent multiple patches
  if ((window as any).__smartPrintInitialized) return
  (window as any).__smartPrintInitialized = true

  nativePrint = window.print.bind(window)

  window.print = function (overrideOrientation?: any) {
    const orientation =
      typeof overrideOrientation === 'string' &&
      (overrideOrientation === 'portrait' || overrideOrientation === 'landscape' || overrideOrientation === 'auto')
        ? (overrideOrientation as PrintOrientation)
        : 'auto'

    smartPrint({ orientation })
  } as any
}
