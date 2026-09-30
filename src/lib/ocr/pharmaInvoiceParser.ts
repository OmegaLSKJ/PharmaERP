import { ExtractedInvoice, ExtractedLineItem } from './types'
import { KNOWN_DISTRIBUTORS } from './pharmaMasterCatalog'

// Common pharma pharmaceutical words
const PHARMA_KEYWORDS = [
  'TAB', 'CAP', 'SYP', 'INJ', 'OINT', 'SUSP', 'DROPS', 'GEL', 'CREAM',
  'SOLUTION', 'LOTION', 'INFUSION', 'SPRAY', 'SACHET', 'STRIP', 'VIAL',
  'MG', 'ML', 'GM', 'MCG', 'IU', 'DUO', 'FORTE', 'PLUS', 'XR', 'SR', 'D',
  'SOAP', 'PUMP', 'BELT'
]

// Common pharmaceutical dosage strengths
const PHARMA_STRENGTHS = new Set([
  '1000', '650', '625', '500', '400', '300', '250', '200', '150',
  '100', '90', '75', '60', '50', '40', '30', '25', '20', '16', '15', '14', '10', '5', '4', '3', '2', '2.5', '1.25', '1'
])

// Month name to numeric string mapping for expiries (e.g. May-28, Feb-30)
const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
}

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
  const gstinRegex = /\b([0-9]{2}[A-Z]{4,5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/gi
  const matches = [...text.matchAll(gstinRegex)].map(m => m[1].toUpperCase())
  if (matches.length === 0) return ''
  // If first GSTIN is buyer (Borgang Drug Distributors 18AFMPP9224L1ZQ) but there is a distributor GSTIN, prefer distributor
  const buyerGstin = '18AFMPP9224L1ZQ'
  const supplierCandidate = matches.find(g => g !== buyerGstin)
  return supplierCandidate || matches[0]
}

export function extractInvoiceNo(text: string): string {
  const invPatterns = [
    /\b(?:INV(?:OICE)?|BILL|MEMO|ORDER|SLIP|CHALLAN)\s*(?:NO|NUMBER|#)\s*[:.\s-]*([A-Za-z0-9\/-]{3,30})/i,
    /\bInv\.?\s*No\.?\s*[:.\s-]*([A-Za-z0-9\/-]{3,30})/i,
    /\b(?:INVOICE|INV)\s+([A-Z0-9\/-]{3,20})\s+(?:DATE|DT)\b/i,
    /\bCREDIT\s*(?:NO|NUMBER|#)?\s*[:.\s-]*([A-Za-z0-9\/-]{3,20})/i,
    /(?<!D\.?L\.?[\s\.]*)(?<!LIC[\s\.]*)\b(?:INV(?:OICE)?|BILL|ORDER|CHALLAN)\s*:\s*([A-Za-z0-9\/-]{3,30})/i,
    /(?<!D\.?L\.?[\s\.]*)(?<!LIC[\s\.]*)\b(?:No|NO|no)\s*:\s*([A-Za-z0-9\/-]{5,20})/i,
    /\b(?:INV\s*#|BILL\s*#|ORDER\s*#)\s*[:.\s-]*([A-Za-z0-9\/-]{3,30})/i
  ]
  for (const pattern of invPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      if (!/DATE|NAME|GSTIN|PHARMA|LTD|PVT|CREDIT|CASH|BORGANG|BUYER|ORIGINAL|DUPLICATE|OF|^STR-/i.test(candidate)) {
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
  // 1. Check if any line in the header matches known distributor names
  const known = KNOWN_DISTRIBUTORS.find(d =>
    lines.slice(0, 12).some(l => l.toUpperCase().includes(d.name))
  )
  if (known) return known.name

  // 2. Check the first 12 lines for business keywords, skipping buyer markers
  const businessKeywords = [
    'PHARMACEUTICALS', 'PHARMA', 'DISTRIBUTORS', 'AGENCIES', 'ENTERPRISES',
    'HEALTHCARE', 'MEDICAL', 'DRUG', 'LABORATORIES', 'LABS', 'LTD', 'PVT',
    'LIMITED', 'PRIVATE', 'TRADERS', 'CHEMIST', 'MEDICINES', 'AGENCY'
  ]

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].trim()
    if (line.length < 4 || line.length > 70) continue
    if (/INVOICE|TAX|BILL|GSTIN|DL\s*NO|STATE|DATE/i.test(line)) continue
    // Skip buyer lines
    if (/BORGANG|BUYER|CONSIGNEE|AT HOUSE|M\/S BORGANG/i.test(line)) continue

    const upper = line.toUpperCase()
    if (businessKeywords.some(keyword => upper.includes(keyword))) {
      return line
    }
  }

  // Fallback to first non-empty meaningful line that is not the buyer
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim()
    if (line.length >= 4 && !/TAX\s*INVOICE|ORIGINAL|DUPLICATE|BORGANG/i.test(line)) {
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
  const hsnRegex = /\b(300[2-6]\d{0,5}|330[4-7]\d{0,6}|3401\d{0,4}|9018\d{0,4}|9021\d{0,4}|2106\d{0,5})\b/
  const expiryRegex = /(?<!\d[\/\-\.])\b(0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b(?!\d)/
  const batchExplicitRegex = /(?:BATCH|B\.?NO|LOT)[:.\s-]*([A-Za-z0-9\-_]{3,15})/i

  let idCounter = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    // 1. Skip standard metadata, address, contact, tax & buyer lines
    if (
      /\b(?:GSTIN|GST\s*NO|PAN\s*[:#]\s*[A-Z0-9]{10}\b|PAN\s*NO\b|DL[\s\.:\/-]*NO|D\.?L\.?[\s\.:\/-]+|DRUG\s*LIC|PHONE|MOB|TEL|EMAIL|FAX|WEBSITE)\b/i.test(line) ||
      /\b(?:STATE\s*CODE|STATE\s*:|STATE\s*ASSAM|PLACE\s*OF\s*SUPPLY|JURISDICTION|ROAD|NEAR|OPP|MARKET|C\.K\.|SONITPUR|TEZPUR|ASSAM\s*\(\d+\)|ASSAM:\d+)\b/i.test(line) ||
      /\b(?:M\/S|M\/s|BUYER(?:'S)?\s*DETAILS|CONSIGNEE|DELIVERY\s*AT|BILLED\s*TO|SHIPPED\s*TO|SALES\s*REP|CUSTOMER\s*:|SUPPLIER\s*:)\b/i.test(line) ||
      /\b(?:BORGANG|BISWANATH|BANK\s*NAME|BANK\s*DETAILS|A\/C\s*NO|IFSC|BRANCH)\b/i.test(line) ||
      /\b(?:TERMS\s*(&|AND)\s*CONDITIONS|SUBJECT\s*TO|AUTHORI[SZ]ED\s*SIGNATORY|E\.?&O\.?E)\b/i.test(line) ||
      /\b(?:RUPEES|PREVIOUS\s*BALANCE|CURRENT\s*BALANCE|ALL\s*DISPUTES|BALANCE\s*:)\b/i.test(line) ||
      /^\s*(?:DATE|DT|INV(?:OICE)?\s*DATE|BILL\s*DATE)\s*[:.\s-]*\d+/i.test(line)
    ) {
      continue
    }

    // 2. Skip Invoice / Bill / Memo metadata lines when they don't contain item details
    if (
      /^(?:CREDIT|CASH)?\s*(?:INVOICE|INV|TAX\s*INVOICE|GST\s*INVOICE|BILL|MEMO|ORDER|SLIP|CHALLAN)\s*(?:NO|NUMBER|#|TP\/|G\d+|[A-Z0-9\/-]+)?.*(?:DATE|DT)?/i.test(line) &&
      !/\b(?:300[2-6]\d{0,4}|2106|3307|3401|9018|9021)\b/.test(line) &&
      !/\b(?:TAB|CAP|SYP|SUSP|GEL|CREAM|OINT|INJ|DROPS?|SOAP)\b/i.test(line)
    ) {
      continue
    }

    // 3. Skip table column header lines
    const tableHeaderMarkers = [
      'PRODUCT', 'DESCRIPTION', 'PACK', 'HSN', 'BATCH', 'EXP', 'EXPIRY', 'QTY', 'QUANTITY', 'RATE',
      'MRP', 'GST', 'AMOUNT', 'SNO', 'SR.NO', 'SL', 'MFG', 'MFR', 'UNIT', 'DISC', 'DIS%', 'TAXABLE',
      'SGST', 'CGST', 'SCH', 'TOTAL', 'NET', 'FREE'
    ]
    const matchedMarkers = tableHeaderMarkers.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(line))
    if (matchedMarkers.length >= 3) {
      continue
    }

    if (HEADER_EXCLUDE_WORDS.some(hw => upperLine.includes(hw) && upperLine.length < 120)) {
      continue
    }

    // 4. Skip summary / footer totals and extract totalAmount
    if (
      /\b(?:SUB\s*TOTAL|GRAND\s*TOTAL|ESTIMATED(?:\s*TOTAL)?|TOTAL(?:\s*AMOUNT)?|GROSS\s*AMOUNT|ROUND\s*OFF|TAXABLE\s*(?:VALUE|AMT)|NET\s*(?:AMOUNT|AMT)|NET\s*:|TOTAL\s*ITEM\s*QTY|ITEMS\s*:|LESS\s*DISCOUNT|LESS\s*RET|ADD\s*(?:CGST|SGST|GST)|OTHER\s*ADJ|#PAGE#|CRN\b)/i.test(line)
    ) {
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
    const hasHsn = hsnRegex.test(line) || /^\s*(300[2-6]\d{0,5}|330[4-7]\d{0,6}|3401\d{0,4}|9018\d{0,4}|9021\d{0,4}|2106\d{0,5})\b/.test(line)
    const hasExpiry = expiryRegex.test(line) || /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\-\/\. ]?(20\d{2}|\d{2})\b/i.test(line)
    const hasPipe = line.includes('|')
    const hasLetters = /[a-zA-Z]{3,}/.test(line)
    const startsWithSerial = /^\s*\d{1,3}[\.\)\-\s]/.test(line)
    const hasScheme = /\b\d{1,4}(?:\.0+)?\s*\+\s*\d{1,4}(?:\.0+)?\b/.test(line)
    const hasPricePattern = /(\d+\s*X\s*\d+|\d+\.?\d{2})/i.test(line)

    if (!hasLetters) {
      continue
    }

    // Must be either pharma keyword, HSN, expiry, scheme, pipe line, or valid serial item
    const isLineCandidate =
      hasHsn ||
      hasExpiry ||
      hasScheme ||
      (hasPharmaKeyword && (hasPricePattern || startsWithSerial || hasScheme)) ||
      (hasPipe && (hasPricePattern || hasScheme)) ||
      (startsWithSerial && (hasPricePattern || /\b\d{1,4}\b/.test(line)))

    if (!isLineCandidate) {
      continue
    }

// High pharmaceutical dosage strengths that shouldn't be mistaken for order quantities
const HIGH_PHARMA_STRENGTHS = new Set([
  '1000', '650', '625', '500', '400', '300', '250', '200', '150', '125', '100'
])

    let qty = 1
    let freeQty = 0
    let purchaseRate = 0
    let mrp = 0
    let saleRate = 0
    let gstRate = 0 // 0 means unstated on bill; enriched from master catalog
    let amount = 0
    let hsn = ''
    let expiry = ''
    let batch = ''
    let packing = ''
    let itemName = ''

    // 1. Extract Leading or Inline HSN (e.g. 3004, 300490, 300420, 300450, 330720, 21069099, 3401, 9018, 9021)
    const leadingHsnMatch = line.match(/^\s*(300[2-6]\d{0,5}|330[4-7]\d{0,6}|3401\d{0,4}|9018\d{0,4}|9021\d{0,4}|2106\d{0,5})\b/)
    if (leadingHsnMatch) {
      hsn = leadingHsnMatch[1]
    } else {
      const hsnMatch = line.match(hsnRegex)
      if (hsnMatch) hsn = hsnMatch[1]
    }

    // 2. Extract Expiry (Month name format e.g. "May-28", "Feb-30" or numerical "04/28", "4/29", "11/27")
    const monthNameExpMatch = line.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\-\/\. ]?(20\d{2}|\d{2})\b/i)
    if (monthNameExpMatch) {
      const mStr = monthNameExpMatch[1].toUpperCase()
      const mNum = MONTH_MAP[mStr] || '01'
      let yr = monthNameExpMatch[2]
      if (yr.length === 4) yr = yr.slice(-2)
      expiry = `${mNum}/${yr}`
    } else {
      const expMatch = line.match(/\b(0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/)
      if (expMatch) {
        let month = expMatch[1].padStart(2, '0')
        let yr = expMatch[2]
        if (yr.length === 4) yr = yr.slice(-2)
        expiry = `${month}/${yr}`
      }
    }

    // 3. Extract Batch Number (Alphanumeric or Pure Numeric 6-10 digits, stripping trailing asterisks)
    const batchMatch = line.match(batchExplicitRegex)
    if (batchMatch) {
      batch = batchMatch[1].trim().replace(/\*+$/, '')
    } else {
      const tokens = line.split(/\s+/)
      for (const t of tokens) {
        const cleanT = t.replace(/[\*\,]+$/, '').trim()
        if (/^\d+(?:MG|ML|GM|MCG|IU|S|TAB|CAP)$/i.test(cleanT) || /^\d+X\d+[A-Z]*$/i.test(cleanT)) continue
        if (/^\d+\.\d+$/.test(cleanT)) continue
        if (cleanT === hsn || cleanT === '3004' || cleanT === '3401' || cleanT === '9018' || cleanT === '9021' || cleanT === '3307' || cleanT === '2106') continue

        // Skip tokens that are brand names with dosage strengths (e.g. DOLO-650, KEPPRA-500, TAZLOC-40, STAMLO-2.5, VERTIN-16)
        const brandStrengthMatch = cleanT.match(/^([A-Za-z]{2,})[\-_](\d+(?:\.\d+)?)(?:MG|ML|GM|TAB|CAP)?$/i)
        if (brandStrengthMatch && (PHARMA_STRENGTHS.has(brandStrengthMatch[2]) || HIGH_PHARMA_STRENGTHS.has(brandStrengthMatch[2]))) continue
        if (/\b(?:DOLO|PAN|TELMA|TELMIKIND|AZITHRAL|AUGMENTIN|CLAVAM|TAXIM|CEFTUM|CALPOL|MONTEK|AMLO|STAMLO|TAZLOC|VERTIN|CONCOR|KEPPRA|ECOSPRIN|ZERODOL|METROGYL|RABLET|GEMINOR)[\-_]?\d+/i.test(cleanT)) continue

        // Alphanumeric batch with both letters and numbers, or hyphen (e.g. DDNXP058, DOBS4418, FND0526009AS, DLSL443, DOLN177, ZVSZ6081, KKG26006, YA80010, E2601146, XSRS26040, TM826067, PSM26014, D6234, EV260080, EV6232003, T-26215, NKS26007, SENF007F, RBK25036S, RA6090, UC01279, VEB26028, 63525T03, M22AK26009, 18261596A)
        if (/^[A-Z0-9\-_]{4,15}$/i.test(cleanT) && /\d/.test(cleanT) && /[A-Z]/i.test(cleanT)) {
          batch = cleanT.toUpperCase()
          break
        }

        // Pure numeric batch of 6 to 10 digits (e.g. 2604063, 106250595, 28025995, 48021547, 165028, 26460798, 26490632, 26441164, 26540155, 26540494)
        if (/^\d{6,10}$/.test(cleanT) && !cleanT.startsWith('784') && !cleanT.startsWith('18') && cleanT !== hsn) {
          batch = cleanT
          break
        }
      }
    }

    // 4. Extract Packing
    const packMatch = line.match(/\b(\d+\s*x\s*\d+[a-z]*|\d+x\d+[a-z]*|\d+'s|\b(?:1|2|4|6|10|14|15|20|28|30|50|60|100)\s*(?:tab|cap|s)\b|\d+\s*ml|\d+ml|\d+\s*gm|\d+gm|1\s*vial|1\s*st|1\s*pcs)\b/i)
    if (packMatch) {
      const candidatePack = packMatch[1].trim()
      const packNum = candidatePack.match(/^\d+/)?.[0]
      if (!packNum || !PHARMA_STRENGTHS.has(packNum) || candidatePack.includes("'") || candidatePack.toLowerCase().includes('ml') || candidatePack.toLowerCase().includes('gm') || candidatePack.toLowerCase().includes('x')) {
        packing = candidatePack
      }
    }

    // 5. Extract GST% (support split notation like 2.5+2.5 => 5%, 9+9 => 18%, 9.00 9.00 => 18%, 2.50 2.50 => 5%)
    const splitGstMatch = line.match(/\b(2\.5|6|9|14)(?:\.0+)?\s*[\+\s]\s*(2\.5|6|9|14)(?:\.0+)?\b/)
    if (splitGstMatch) {
      gstRate = parseFloat(splitGstMatch[1]) + parseFloat(splitGstMatch[2])
    } else {
      const gstMatch = line.match(/\b(5|12|18|28)\s*%/i)
      if (gstMatch) {
        gstRate = parseFloat(gstMatch[1])
      } else {
        const dualTaxMatch = line.match(/(?:SGST|CGST)[:.\s]*([0-9]+(?:\.[0-9]+)?)/i)
        if (dualTaxMatch) {
          const singleTax = parseFloat(dualTaxMatch[1])
          if (singleTax === 2.5) gstRate = 5
          else if (singleTax === 6) gstRate = 12
          else if (singleTax === 9) gstRate = 18
          else if (singleTax === 14) gstRate = 28
        } else {
          const standaloneGst = line.match(/\b(?:GST\s*[:.\s-]*)?(18|28|12|5)\.00\b/i)
          if (standaloneGst) {
            gstRate = parseFloat(standaloneGst[1])
          }
        }
      }
    }

    // 6. Explicit labels
    const rateMatch = line.match(/(?:RATE|PUR\.?\s*RATE|PRICE|P\.?RATE)[:.\s-]*([0-9]+(?:\.[0-9]{1,2})?)/i)
    if (rateMatch) purchaseRate = parseFloat(rateMatch[1])

    const mrpMatch = line.match(/(?:(?:NEW\s*)?MRP|M\.?R\.?P\.?)[:.\s-]*([0-9]+(?:\.[0-9]{1,2})?)/i)
    if (mrpMatch) mrp = parseFloat(mrpMatch[1])

    const qtyMatch = line.match(/(?:QTY|QUANTITY|BILLED)[:.\s-]*([0-9]+)/i)
    if (qtyMatch) qty = parseInt(qtyMatch[1], 10)

    const freeMatch = line.match(/(?:FREE|SCHEME|BONUS)[:.\s-]*([0-9]+)/i)
    if (freeMatch) freeQty = parseInt(freeMatch[1], 10)

    // Free quantity pattern like "25+5", "50+10", "20+2", "10+1", "27+3", "25+25", "11+1", "30.0+3.0"
    const freeQtyPattern = line.match(/\b(\d{1,4}(?:\.0+)?)\s*\+\s*(\d{1,4}(?:\.0+)?)\b/)
    if (freeQtyPattern) {
      qty = Math.round(parseFloat(freeQtyPattern[1]))
      freeQty = Math.round(parseFloat(freeQtyPattern[2]))
    }

    // Strip HSN, Batch, and Expiry for numeric parsing
    let stripped = line
      .replace(hsnRegex, '')
      .replace(expiryRegex, '')
      .replace(batchExplicitRegex, '')
    if (monthNameExpMatch) stripped = stripped.replace(monthNameExpMatch[0], '')
    if (leadingHsnMatch) stripped = stripped.replace(leadingHsnMatch[0], '')
    if (splitGstMatch) stripped = stripped.replace(splitGstMatch[0], '')
    if (batch) stripped = stripped.replace(new RegExp(`\\b${batch}\\b`, 'gi'), '')
    // Strip split taxes like "2.5 2.5"
    stripped = stripped.replace(/\b(2\.5|6|9|14)\s+(2\.5|6|9|14)\b/g, '')

    // 7. Check for decimal rates (Rates & MRPs)
    const decimals = stripped.match(/\b\d+\.\d{2}\b/g)?.map(d => parseFloat(d)).filter(d => d > 0) || []
    if (purchaseRate === 0 || mrp === 0) {
      if (decimals.length >= 2) {
        const unique = Array.from(new Set(decimals)).sort((a, b) => a - b)
        if (purchaseRate === 0 && unique.length > 0) purchaseRate = unique[0]
        if (mrp === 0 && unique.length > 0) mrp = unique.length > 2 ? unique[1] : unique[unique.length - 1]
      } else if (decimals.length === 1 && purchaseRate === 0) {
        purchaseRate = decimals[0]
        if (mrp === 0) mrp = Math.round(purchaseRate * 1.35 * 100) / 100
      }
    }

    // 8. Extract Quantities
    // Case A: Pipe-delimited table line
    if (hasPipe) {
      const rawCols = line.split('|').map(c => c.trim())
      const cols = rawCols.filter((c, idx) => !(idx === 0 && c === '') && !(idx === rawCols.length - 1 && c === ''))
      
      const nameColIdx = cols.findIndex(c => /[a-zA-Z]{3,}/.test(c) && !/BATCH|EXP|RATE|MRP|GST/i.test(c))
      if (nameColIdx !== -1) {
        itemName = cols[nameColIdx]
      }

      // If qty wasn't found by explicit label or scheme, check numeric columns
      if (qty === 1 && !freeQtyPattern && !qtyMatch) {
        const trailingCols = cols.slice(nameColIdx + 1).filter(Boolean)
        const intCols = trailingCols
          .filter(c => !c.includes('%'))
          .map(c => c.replace(/[^0-9]/g, ''))
          .filter(c => c.length > 0 && c.length <= 4)
          .map(c => parseInt(c, 10))
          .filter(n => n >= 0 && n < 5000)

        if (intCols.length > 0) {
          qty = intCols[0]
          if (intCols.length > 1 && freeQty === 0) {
            freeQty = intCols[1]
          }
        }
      }
    }

    // Case B: Space-delimited line or minimal sheet
    if (!itemName) {
      let lineForName = stripped
        .replace(/^\s*(?:SL\.?\s*)?\d{1,3}[\.\)\-\s]+/, '')
        .trim()

      // If NO decimals on line (Minimal sheet: e.g. "PAN 40MG TAB 50 5", "MOXIKIND CV 625 30", "TELMA 40 40 4")
      if (decimals.length === 0 && !rateMatch && !mrpMatch) {
        const threeTrailingInts = lineForName.match(/^(.*?)\s+(\d{1,4})\s+(\d{1,4})\s+(\d{1,4})$/)
        const twoTrailingInts = lineForName.match(/^(.*?)\s+(\d{1,4})\s+(\d{1,4})$/)
        const oneTrailingInt = lineForName.match(/^(.*?)\s+(\d{1,4})$/)

        if (threeTrailingInts && /[a-zA-Z]/.test(threeTrailingInts[1])) {
          // e.g. "DOLO 650 100 10" or "TELMA 40 40 4"
          itemName = `${threeTrailingInts[1].trim()} ${threeTrailingInts[2]}`
          if (!qtyMatch && !freeQtyPattern) {
            qty = parseInt(threeTrailingInts[3], 10)
            freeQty = parseInt(threeTrailingInts[4], 10)
          }
        } else if (twoTrailingInts && /[a-zA-Z]/.test(twoTrailingInts[1])) {
          const int1 = twoTrailingInts[2]
          const int2 = twoTrailingInts[3]
          const isInt1Strength = PHARMA_STRENGTHS.has(int1) && !/(?:MG|ML|GM|TAB|CAP)/i.test(twoTrailingInts[1])

          if (isInt1Strength) {
            // First int is strength (e.g. "MOXIKIND CV 625 30")
            itemName = `${twoTrailingInts[1].trim()} ${int1}`
            if (!qtyMatch && !freeQtyPattern) {
              qty = parseInt(int2, 10)
              freeQty = 0
            }
          } else {
            // Standard Name Qty Free (e.g. "PAN 40MG TAB 50 5")
            itemName = twoTrailingInts[1].trim()
            if (!qtyMatch && !freeQtyPattern) {
              qty = parseInt(int1, 10)
              freeQty = parseInt(int2, 10)
            }
          }
        } else if (oneTrailingInt && /[a-zA-Z]/.test(oneTrailingInt[1])) {
          itemName = oneTrailingInt[1].trim()
          if (!qtyMatch && !freeQtyPattern) {
            qty = parseInt(oneTrailingInt[2], 10)
          }
        }
      }

      // If decimals ARE on line (Standard bill)
      if (qty === 1 && !freeQtyPattern && !qtyMatch) {
        const lineWithoutName = stripped
          .replace(/^[0-9]{1,3}\s+/, '')
          .replace(/\b\d+\s*['xX][a-zA-Z0-9]*\b/g, '')
        const intMatches = lineWithoutName.match(/\b\d{1,4}\b/g)
        if (intMatches && intMatches.length > 0) {
          const candidates = intMatches
            .map(n => parseInt(n, 10))
            .filter(n => n !== gstRate && n > 0 && n < 5000 && !line.includes(`${n}MG`) && !line.includes(`${n}ML`) && !HIGH_PHARMA_STRENGTHS.has(String(n)))
          if (candidates.length > 0) {
            qty = candidates[0]
            if (candidates.length > 1 && freeQty === 0) {
              freeQty = candidates[1]
            }
          }
        }
      }

      if (!itemName) {
        // Strip common manufacturer abbreviations from line before constructing itemName
        const KNOWN_MFG_TOKENS = [
          'OZONE LT', 'OZONE', 'JUPITER', 'DR. MORP', 'DR MORP', 'ALLEN PH', 'HIMALAYA',
          'NAXPAR', 'MICRO', 'IPCA', 'STERLI', 'APEX', 'JBCPL', 'USV / CR', 'USV/CR',
          'USV (C', 'USV (M', 'USV', 'DRL/ZE', 'DRL', 'REE', 'ALEM', 'REXWEL', 'ALKEM', 'ALKE',
          'DYNA', 'LUPI', 'ABBO', 'SHIN', 'MERC', 'INDC', 'MACL', 'SYMBI', 'CONCEP', 'GENX P',
          'RSH', 'INDICO', 'WARREN', 'DWD', 'ALBE', 'NOVI', 'GALP', 'WARN', 'STRA', 'FOURRT',
          'SIKKIM', 'ALEMBI', 'CAPSUL', 'TABLET'
        ]

        let cleanedLine = lineForName
          .replace(/\b\d+[\.,]\d{2}\b/g, '')
          .replace(/\b(5|12|18|28)\s*%/g, '')
          .replace(/\b(2\.5|6|9|14)\s*[\+\s]\s*(2\.5|6|9|14)\b/g, '')
          .replace(/\b\d{1,4}(?:\.0+)?\s*\+\s*\d{1,4}(?:\.0+)?\b/g, '')
          .replace(/\b\d+\s*S\b/gi, '')
          .replace(/[\|\+\=\:\#\*]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // Strip manufacturer abbreviations
        for (const mfg of KNOWN_MFG_TOKENS) {
          cleanedLine = cleanedLine.replace(new RegExp(`\\b${mfg.replace(/[\(\)]/g, '\\$&')}\\b`, 'gi'), ' ')
        }

        // Strip packing if already detected and not a strength
        if (packing && !PHARMA_STRENGTHS.has(packing.replace(/[^0-9]/g, ''))) {
          cleanedLine = cleanedLine.replace(new RegExp(`\\b${packing.replace(/[\(\)']/g, '\\$&')}\\b`, 'gi'), ' ')
        }

        itemName = cleanedLine.replace(/\s+/g, ' ').trim()

        if (freeQty > 0 && !freeQtyPattern) {
          itemName = itemName.replace(new RegExp(`\\b${freeQty}\\b\\s*$`), '').trim()
        }
        if (qty > 1 && !qtyMatch) {
          itemName = itemName.replace(new RegExp(`\\b${qty}\\b\\s*$`), '').trim()
        }
      }
    }

    // Clean up serial numbers and edge tokens from itemName
    itemName = itemName.replace(/^(?:SL\.?\s*)?(\d{1,3}[\.\-\s]+)/i, '').trim()

    if (itemName.length < 3 || /^\d+$/.test(itemName)) {
      continue
    }
    if (itemName.length > 60) {
      itemName = itemName.substring(0, 60).trim()
    }

    // If multiple decimals were present, use rate * qty = total check to accurately separate purchaseRate, mrp, and amount
    if (decimals.length >= 2) {
      const lastDec = decimals[decimals.length - 1]
      let rateCandidate = qty > 0 ? decimals.slice(0, -1).find(d => Math.abs(d * qty - lastDec) < 0.15) : undefined

      // If existing qty doesn't match rate * qty = amount and no explicit scheme was present, check if any decimal divides amount into an exact integer qty
      if (!rateCandidate && !freeQtyPattern) {
        for (const d of decimals.slice(0, -1)) {
          if (d > 0) {
            const possibleQty = Math.round(lastDec / d)
            if (possibleQty > 0 && possibleQty < 1000 && Math.abs(possibleQty * d - lastDec) < 0.15) {
              rateCandidate = d
              qty = possibleQty
              break
            }
          }
        }
      }

      if (rateCandidate) {
        purchaseRate = rateCandidate
        amount = lastDec
        const candidateMrps = decimals.filter(d => d > purchaseRate && d < lastDec)
        if (candidateMrps.length > 0) {
          mrp = candidateMrps[0]
        }
      }
    }

    if (purchaseRate > 0 && mrp === 0) {
      mrp = Math.round(purchaseRate * 1.35 * 100) / 100
    }
    if (purchaseRate > 0 && qty > 0 && amount === 0) {
      amount = Math.round(purchaseRate * qty * 100) / 100
    }

    items.push({
      id: `ocr-${idCounter++}`,
      itemName,
      packing: packing || '',
      hsn: hsn || '',
      batch: batch || `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
      expiry: expiry || '12/28',
      qty: qty > 0 ? qty : 10,
      freeQty,
      purchaseRate: purchaseRate > 0 ? purchaseRate : 0,
      mrp: mrp > 0 ? mrp : 0,
      saleRate: mrp > 0 ? Math.round(mrp * 0.9 * 100) / 100 : 0,
      discount: 0,
      gstRate: gstRate > 0 ? gstRate : 12,
      amount: amount > 0 ? amount : 0,
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
