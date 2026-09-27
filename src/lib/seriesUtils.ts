export interface DocumentSeries {
  id: string
  doc: string
  prefix: string
  suffix: string
  nextNo: number
  padding: number
  fyReset: boolean
  active: boolean
}

/**
 * Normalizes document type aliases to the standard Series Master doc names.
 */
export function mapDocTypeToSeriesName(rawType?: string): string {
  if (!rawType) return 'Sale Invoice'
  const t = rawType.trim().toLowerCase()
  if (t === 'sales' || t === 'sale' || t === 'sale invoice' || t === 'tax invoice') return 'Sale Invoice'
  if (t === 'purchases' || t === 'purchase' || t === 'purchase bill' || t === 'purchase invoice') return 'Purchase Bill'
  if (t === 'challans' || t === 'challan' || t === 'delivery challan') return 'Challan'
  if (t === 'credit-notes' || t === 'credit note' || t === 'credit_note') return 'Credit Note'
  if (t === 'debit-notes' || t === 'debit note' || t === 'debit_note') return 'Debit Note'
  if (t === 'sales order' || t === 'sales_order' || t === 'sale order') return 'Sales Order'
  if (t === 'purchase order' || t === 'purchase_order') return 'Purchase Order'
  if (t === 'sale-returns' || t === 'sale return' || t === 'sale_return' || t === 'sales return') return 'Sale Return'
  if (t === 'purchase-returns' || t === 'purchase return' || t === 'purchase_return') return 'Purchase Return'
  return rawType
}

/**
 * Extracts the core sequence number and identifier from an existing document number.
 * Gracefully strips known or pattern-based prefixes and suffixes.
 */
export function extractDocSequence(
  docNumber: string,
  knownPrefix?: string,
  knownSuffix?: string
): { sequence: number; rawCore: string } {
  let str = (docNumber || '').trim()
  if (!str) return { sequence: 1, rawCore: '1' }

  // 1. Strip known suffix if provided
  if (knownSuffix && knownSuffix.trim() && str.endsWith(knownSuffix.trim())) {
    str = str.slice(0, str.length - knownSuffix.trim().length)
  } else {
    // Strip trailing suffix pattern like /26-27, /2026-27, -26-27, /2026, -FY26, /A, etc.
    const suffixMatch = str.match(/([/-](?:FY\d{2,4}|\d{2,4}[/-]\d{2,4}|\d{2,4}|[A-Za-z][A-Za-z0-9_-]*))$/i)
    if (suffixMatch && suffixMatch.index && suffixMatch.index > 0) {
      const before = str.slice(0, suffixMatch.index)
      if (/\d/.test(before)) {
        str = before
      }
    }
  }

  // 2. Strip known prefix if provided
  if (knownPrefix && knownPrefix.trim() && str.startsWith(knownPrefix.trim())) {
    str = str.slice(knownPrefix.trim().length)
  } else {
    // Strip leading alphanumeric prefix like "SI-", "PB-", "CH-", "G-", "INV-", etc.
    const prefixMatch = str.match(/^([A-Za-z]+[-_]?)/)
    if (prefixMatch && str.length > prefixMatch[1].length) {
      str = str.slice(prefixMatch[1].length)
    }
  }

  // 3. Extract the last numeric block (e.g. from "2026-0001" -> 1, or "0001" -> 1, or "427428" -> 427428)
  const numMatch = str.match(/(\d+)$/)
  if (numMatch) {
    const seq = parseInt(numMatch[1], 10)
    return { sequence: isNaN(seq) ? 1 : seq, rawCore: numMatch[1] }
  }

  return { sequence: 1, rawCore: str || '1' }
}

/**
 * Formats a document sequence number into a complete formatted document number.
 */
export function formatDocNumber(
  sequence: number | string,
  prefix: string = '',
  suffix: string = '',
  padding: number = 4
): string {
  const num = typeof sequence === 'number' ? sequence : (parseInt(sequence, 10) || 1)
  const padded = String(num).padStart(Math.max(1, padding), '0')
  return `${prefix || ''}${padded}${suffix || ''}`
}

/**
 * Re-formats an existing bill number according to updated series configuration.
 * Retains the invoice's original sequential number while attaching the new prefix, padding, and suffix.
 */
export function applySeriesToDocNumber(
  currentNumber: string,
  series: { prefix?: string; suffix?: string; padding?: number },
  oldSeries?: { prefix?: string; suffix?: string }
): string {
  const { sequence } = extractDocSequence(currentNumber, oldSeries?.prefix, oldSeries?.suffix)
  return formatDocNumber(sequence, series.prefix ?? '', series.suffix ?? '', series.padding ?? 4)
}

/**
 * Dynamically resolves and ensures the bill number contains the active series prefix and suffix
 * for viewing and printing components.
 */
export function formatBillWithActiveSeries(
  docNumber: string,
  docType: string,
  seriesList?: DocumentSeries[]
): string {
  if (!docNumber || !seriesList || !seriesList.length) return docNumber
  const targetDocName = mapDocTypeToSeriesName(docType)
  const matchingSeries = seriesList.find((s) => s.doc?.toLowerCase() === targetDocName.toLowerCase() && s.active !== false)
  if (!matchingSeries) return docNumber

  // If the docNumber already matches the series prefix and suffix, return as is
  const prefix = matchingSeries.prefix || ''
  const suffix = matchingSeries.suffix || ''
  if (prefix && !docNumber.startsWith(prefix)) {
    return applySeriesToDocNumber(docNumber, matchingSeries)
  }
  if (suffix && !docNumber.endsWith(suffix)) {
    return applySeriesToDocNumber(docNumber, matchingSeries)
  }
  return docNumber
}
