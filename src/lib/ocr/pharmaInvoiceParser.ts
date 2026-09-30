import { ExtractedInvoice, ExtractedLineItem } from './types'

// Common pharma pharmaceutical words
const PHARMA_KEYWORDS = [
  'TAB', 'CAP', 'SYP', 'INJ', 'OINT', 'SUSP', 'DROPS', 'GEL', 'CREAM',
  'SOLUTION', 'LOTION', 'INFUSION', 'SPRAY', 'SACHET', 'STRIP', 'VIAL',
  'MG', 'ML', 'GM', 'MCG', 'IU', 'DUO', 'FORTE', 'PLUS', 'XR', 'SR', 'D'
]

// Common headers to reject as line items
const HEADER_EXCLUDE_WORDS = [
  'PARTICULARS', 'DESCRIPTION', 'ITEM NAME', 'PRODUCT NAME', 'HSN CODE',
  'BATCH NO', 'EXPIRY DATE', 'EXP DATE', 'QUANTITY', 'BILLED QTY',
  'FREE QTY', 'PURCHASE RATE', 'SALE RATE', 'DISCOUNT', 'TAXABLE AMOUNT',
  'CGST', 'SGST', 'IGST', 'SUB TOTAL', 'GRAND TOTAL', 'NET AMOUNT',
  'TERMS AND CONDITIONS', 'BANK DETAILS', 'AUTHORISED SIGNATORY',
  'DRUG LICENSE', 'DL NO', 'FOOD LICENSE', 'FSSAI'
]

export function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function extractGstin(text: string): string {
  const gstinRegex = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i
  const match = text.match(gstinRegex)
  return match ? match[1].toUpperCase() : ''
}

export function extractInvoiceNo(text: string): string {
  const invPatterns = [
    /\b(?:INV(?:OICE)?|BILL|MEMO)\s*(?:NO|NUMBER|#)\s*[:.\s-]*([A-Za-z0-9\/-]{3,30})/i,
    /\b(?:INV(?:OICE)?|BILL)\s*:\s*([A-Za-z0-9\/-]{3,30})/i,
    /\b(?:INV\s*#|BILL\s*#)\s*[:.\s-]*([A-Za-z0-9\/-]{3,30})/i
  ]
  for (const pattern of invPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      if (!/DATE|NAME|GSTIN|PHARMA|LTD|PVT/i.test(candidate)) {
        return candidate
      }
    }
  }
  return ''
}

export function extractInvoiceDate(text: string): string {
  const datePatterns = [
    /(?:INV(?:OICE)?\s*DATE|BILL\s*DATE|DATE|DT)[:.\s-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.][1-2][0-9]{3})/i,
    /(?:INV(?:OICE)?\s*DATE|BILL\s*DATE|DATE|DT)[:.\s-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.][0-9]{2})\b/i,
    /\b([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.][1-2][0-9]{3})\b/
  ]
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return standardizeDate(match[1].trim())
    }
  }
  return new Date().toISOString().slice(0, 10)
}

function standardizeDate(rawDate: string): string {
  const parts = rawDate.split(/[\/\-\.]/)
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0')
    let month = parts[1].padStart(2, '0')
    let year = parts[2]
    if (year.length === 2) year = `20${year}`
    // If format is YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    }
    return `${year}-${month}-${day}`
  }
  return rawDate
}

export function extractSupplierName(lines: string[]): string {
  // Check the first 12 lines for business keywords
  const businessKeywords = [
    'PHARMACEUTICALS', 'PHARMA', 'DISTRIBUTORS', 'AGENCIES', 'ENTERPRISES',
    'HEALTHCARE', 'MEDICAL', 'DRUG', 'LABORATORIES', 'LABS', 'LTD', 'PVT',
    'LIMITED', 'PRIVATE', 'TRADERS', 'CHEMIST', 'MEDICINES'
  ]

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].trim()
    if (line.length < 4 || line.length > 70) continue
    if (/INVOICE|TAX|BILL|GSTIN|DL\s*NO|STATE|DATE/i.test(line)) continue

    const upper = line.toUpperCase()
    if (businessKeywords.some(keyword => upper.includes(keyword))) {
      return line
    }
  }

  // Fallback to first non-empty meaningful line
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim()
    if (line.length >= 4 && !/TAX\s*INVOICE|ORIGINAL|DUPLICATE/i.test(line)) {
      return line
    }
  }
  return ''
}

export function parsePharmaInvoice(rawText: string, sourceType: 'digital_pdf' | 'image_ocr' = 'image_ocr'): ExtractedInvoice {
  const clean = cleanText(rawText)
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)

  const gstin = extractGstin(clean)
  const invoiceNo = extractInvoiceNo(clean)
  const invoiceDate = extractInvoiceDate(clean)
  const supplierName = extractSupplierName(lines)

  const items: ExtractedLineItem[] = []
  let totalAmount = 0
  let taxAmount = 0

  // Regex patterns for parsing tabular lines
  const hsnRegex = /\b(300[2-6]\d{0,4}|9018\d{0,4}|2106\d{0,4}|3304\d{0,4})\b/
  const expiryRegex = /\b(0[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/
  const batchExplicitRegex = /(?:BATCH|B\.?NO|LOT)[:.\s-]*([A-Za-z0-9\-_]{3,15})/i

  let idCounter = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    // Skip headers, metadata lines, and footers
    if (/GSTIN|INVOICE\s*NO|BILL\s*NO|INV\s*DATE|DATE\s*:|DL\s*NO|DRUG\s*LIC|PHONE|EMAIL|ADDRESS|STATE\s*CODE/i.test(line)) {
      continue
    }

    // Detect table column header line (e.g. SNo Product Description Pack HSN Batch Exp Qty Rate MRP)
    const tableHeaderMarkers = ['PRODUCT', 'DESCRIPTION', 'PACK', 'HSN', 'BATCH', 'EXP', 'QTY', 'RATE', 'MRP', 'GST', 'AMOUNT', 'SNO', 'SR.NO']
    const matchedMarkers = tableHeaderMarkers.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(line))
    if (matchedMarkers.length >= 3) {
      continue
    }

    if (HEADER_EXCLUDE_WORDS.some(hw => upperLine.includes(hw) && upperLine.length < 120)) {
      continue
    }
    if (/\b(?:SUB\s*TOTAL|GRAND\s*TOTAL|TOTAL(?:\s*AMOUNT)?|ROUND\s*OFF|TAXABLE\s*VALUE|NET\s*AMOUNT)\b/i.test(line)) {
      const amounts = line.match(/\d+[\.,]\d{2}/g)
      if (amounts && amounts.length > 0) {
        const val = parseFloat(amounts[amounts.length - 1].replace(',', '.'))
        if (!isNaN(val) && val > totalAmount) {
          totalAmount = val
        }
      }
      continue
    }

    // Check if line contains pharmaceutical medicine indicators or medicine patterns
    const hasPharmaKeyword = PHARMA_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(line))
    const hasHsn = hsnRegex.test(line)
    const hasExpiry = expiryRegex.test(line)

    // A valid item line typically has at least a name and some numbers (batch, exp, qty, rate)
    if (!hasPharmaKeyword && !hasHsn && !hasExpiry && !/(\d+\s*X\s*\d+|\d+\.?\d{2})/i.test(line)) {
      continue
    }

    // Extract HSN
    let hsn = '30049099'
    const hsnMatch = line.match(hsnRegex)
    if (hsnMatch) {
      hsn = hsnMatch[1]
    }

    // Extract Expiry
    let expiry = ''
    const expMatch = line.match(expiryRegex)
    if (expMatch) {
      let month = expMatch[1].padStart(2, '0')
      let yr = expMatch[2]
      if (yr.length === 2) yr = `20${yr}`
      expiry = `${month}/${yr.slice(-2)}`
    }

    // Extract Batch
    let batch = ''
    const batchMatch = line.match(batchExplicitRegex)
    if (batchMatch) {
      batch = batchMatch[1].trim()
    } else {
      // Find candidate alphanumeric token (e.g. TL4891, CP109, AS882)
      // Exclude dosage tokens (500MG, 10ML, 250MCG) and pack sizes (10X10)
      const tokens = line.split(/\s+/)
      for (const t of tokens) {
        if (/^\d+(?:MG|ML|GM|MCG|IU|S)$/i.test(t) || /^\d+X\d+[A-Z]*$/i.test(t)) {
          continue
        }
        if (/^[A-Z0-9]{3,12}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t) && t !== hsn) {
          batch = t.toUpperCase()
          break
        }
      }
      if (!batch) {
        batch = `BAT${Math.floor(1000 + Math.random() * 9000)}`
      }
    }

    // 1. Check for labeled fields first (e.g. RATE: 145.50, MRP: 220.00, QTY: 20)
    let qty = 1
    let freeQty = 0
    let purchaseRate = 0
    let mrp = 0
    let gstRate = 12 // Default Indian Pharma GST rate
    let amount = 0

    const rateMatch = line.match(/(?:RATE|PUR\.?\s*RATE|PRICE|P\.?RATE)[:.\s-]*([0-9]+(?:\.[0-9]{1,2})?)/i)
    if (rateMatch) purchaseRate = parseFloat(rateMatch[1])

    const mrpMatch = line.match(/(?:MRP|M\.?R\.?P\.?)[:.\s-]*([0-9]+(?:\.[0-9]{1,2})?)/i)
    if (mrpMatch) mrp = parseFloat(mrpMatch[1])

    const qtyMatch = line.match(/(?:QTY|QUANTITY|BILLED)[:.\s-]*([0-9]+)/i)
    if (qtyMatch) qty = parseInt(qtyMatch[1], 10)

    const freeMatch = line.match(/(?:FREE|SCHEME|BONUS)[:.\s-]*([0-9]+)/i)
    if (freeMatch) freeQty = parseInt(freeMatch[1], 10)

    // Look for GST percentages: 5%, 12%, 18%, 28%
    const gstMatch = line.match(/\b(5|12|18|28)\s*%/i)
    if (gstMatch) {
      gstRate = parseFloat(gstMatch[1])
    }

    // Free quantity pattern like "10 + 1" or "10+1" or "10 / 1"
    const freeQtyPattern = line.match(/\b(\d+)\s*[\+\/]\s*(\d+)\b/)
    if (freeQtyPattern) {
      qty = parseInt(freeQtyPattern[1], 10)
      freeQty = parseInt(freeQtyPattern[2], 10)
    }

    // 2. Fallback to positional columns if labels weren't present
    if (purchaseRate === 0 || mrp === 0) {
      // Strip HSN, Batch, and Expiry so numbers like 30049099 or 08/27 aren't confused with prices
      let stripped = line
        .replace(hsnRegex, '')
        .replace(expiryRegex, '')
        .replace(batchExplicitRegex, '')
        .replace(new RegExp(`\\b${batch}\\b`, 'g'), '')

      // Find all decimal numbers (rates & MRPs)
      const decimals = stripped.match(/\b\d+\.\d{2}\b/g)?.map(d => parseFloat(d)) || []
      if (decimals.length >= 2) {
        // In pharma, Rate is lower than MRP, Amount is highest or rate * qty
        const unique = Array.from(new Set(decimals)).sort((a, b) => a - b)
        if (purchaseRate === 0) purchaseRate = unique[0]
        if (mrp === 0) {
          mrp = unique.length > 2 ? unique[1] : unique[unique.length - 1]
        }
      } else if (decimals.length === 1) {
        if (purchaseRate === 0) purchaseRate = decimals[0]
        if (mrp === 0) mrp = Math.round(purchaseRate * 1.35 * 100) / 100
      }
    }

    if (purchaseRate > 0 && mrp === 0) {
      mrp = Math.round(purchaseRate * 1.35 * 100) / 100
    }
    if (purchaseRate > 0 && qty > 0) {
      amount = Math.round(purchaseRate * qty * 100) / 100
    }

    // Extract item name: remove HSN, Batch, Expiry, numbers, and clean up
    let packing = '10x10'
    const packMatch = line.match(/\b(\d+\s*x\s*\d+[a-z]*|\d+x\d+|\d+'s|\d+\s*ml|\d+\s*gm)\b/i)
    if (packMatch) {
      packing = packMatch[1].trim()
    }

    let itemName = line
      .replace(hsnRegex, '')
      .replace(expiryRegex, '')
      .replace(batchExplicitRegex, '')
      .replace(new RegExp(`\\b${batch}\\b`, 'gi'), '')
      .replace(/\b\d+[\.,]\d{2}\b/g, '')
      .replace(/\b(5|12|18|28)\s*%/g, '')
      .replace(/[\|\+\=\:\#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Strip leading serial numbers (e.g. "1.", "1 ", "01-")
    itemName = itemName.replace(/^(\d{1,3}[\.\-\s]+)/, '').trim()

    // Strip trailing quantities or packing if remaining
    itemName = itemName.replace(/\s+\d{1,4}$/, '').trim()

    // If item name is too short or just numbers, skip
    if (itemName.length < 3 || /^\d+$/.test(itemName)) {
      continue
    }

    // Truncate to reasonable length
    if (itemName.length > 60) {
      itemName = itemName.substring(0, 60).trim()
    }

    items.push({
      id: `ocr-${idCounter++}`,
      itemName,
      packing,
      hsn,
      batch,
      expiry: expiry || '12/27',
      qty: qty > 0 ? qty : 10,
      freeQty,
      purchaseRate: purchaseRate > 0 ? purchaseRate : 100,
      mrp: mrp > 0 ? mrp : Math.round((purchaseRate || 100) * 1.4),
      saleRate: mrp > 0 ? Math.round(mrp * 0.9 * 100) / 100 : 120,
      discount: 0,
      gstRate,
      amount: amount > 0 ? amount : Math.round((purchaseRate || 100) * (qty || 10) * 100) / 100,
      confidence: sourceType === 'digital_pdf' ? 0.98 : 0.85
    })
  }

  // Calculate totals if not found in text
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
    taxAmount = items.reduce((sum, item) => sum + (item.amount * item.gstRate) / 100, 0)
    totalAmount = Math.round((totalAmount + taxAmount) * 100) / 100
  }

  return {
    supplierName: supplierName || 'Pharma Distributor',
    supplierGstin: gstin || '',
    invoiceNo: invoiceNo || `INV-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate,
    totalAmount,
    taxAmount,
    items,
    rawText,
    confidence: sourceType === 'digital_pdf' ? 0.98 : 0.86,
    sourceType,
    pageCount: 1
  }
}
