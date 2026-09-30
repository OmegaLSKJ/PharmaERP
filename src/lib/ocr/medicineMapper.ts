import { normalizeSearchText, diceSimilarity, levenshteinDistance } from '../similarity'
import { ExtractedLineItem } from './types'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'

export interface MasterItemOption {
  id?: string
  itemId?: string
  code?: string
  name?: string
  label?: string
  packing?: string
  hsn?: string
  mrp?: number
  rate?: number
  purchaseRate?: number
  gstRate?: number
  stock?: number
  manufacturer?: string
  salt?: string
  category?: string
  aliases?: string[]
}

export interface MedicineMatchResult {
  matchedItem: MasterItemOption | null
  score: number // 0 to 1
  matchStatus: 'exact' | 'high' | 'fuzzy' | 'unmapped'
  suggestions: MasterItemOption[]
}

const COMMON_MARKERS = new Set([
  'tab', 'tablet', 'tablets', 'cap', 'capsule', 'capsules', 'syp', 'syrup',
  'inj', 'injection', 'drops', 'gel', 'cream', 'oint', 'ointment', 'susp', 'suspension',
  'liquid', 'liq', 'soap', 'pump', 'belt', 'large', 'l',
  'mg', 'ml', 'gm', 'mcg', 'iu', 'duo', 'forte', 'plus', 'strip', 's', 'box', 'vial', 'st', 'pcs'
])

export function cleanPharmaName(str: string): string {
  return normalizeSearchText(
    (str || '')
      // Remove text inside parentheses e.g. (30TAB), (14S), (10*15), (DYNA)
      .replace(/\([^)]*\)/g, ' ')
      // Standardize dotted abbreviations like D.F.O -> DFO
      .replace(/D\.F\.O/gi, 'DFO')
      .replace(/L\s*\.?\s*S\s*\.?\s*BELT/gi, 'LS BELT')
      // Strip pharmacopeia notations
      .replace(/\b(?:IP|BP|USP)\b/gi, ' ')
      // Separate numbers and letters
      .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
      .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
      // Remove punctuation
      .replace(/[-_/\.\*\+]/g, ' ')
  )
}

function parseMedicineTokens(name: string): { brandTokens: string[]; strengths: string[] } {
  const norm = cleanPharmaName(name)
  const tokens = norm.split(/\s+/).filter(Boolean)
  const brandTokens: string[] = []
  const strengths: string[] = []

  for (const t of tokens) {
    if (COMMON_MARKERS.has(t) || /^\d+x\d+$/i.test(t)) continue
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      strengths.push(t)
    } else {
      brandTokens.push(t)
    }
  }

  return { brandTokens, strengths }
}

function runMatchOnCatalog(
  scannedText: string,
  catalog: MasterItemOption[]
): MedicineMatchResult {
  const cleanScanned = cleanPharmaName(scannedText)
  const scannedParsed = parseMedicineTokens(scannedText)

  const scoredList: Array<{ item: MasterItemOption; score: number }> = []

  for (const item of catalog) {
    const itemName = item.name || item.label || ''
    if (!itemName) continue

    const cleanMaster = cleanPharmaName(itemName)

    // 1. Direct Clean Match
    if (cleanScanned === cleanMaster) {
      return {
        matchedItem: item,
        score: 1.0,
        matchStatus: 'exact',
        suggestions: [item]
      }
    }

    // 2. Direct Alias Match
    const aliases = (item.aliases || (item as any).aliases) as string[] | undefined
    if (aliases && aliases.length > 0) {
      for (const al of aliases) {
        const cleanAl = cleanPharmaName(al)
        if (cleanScanned === cleanAl || cleanScanned === cleanPharmaName(al)) {
          return {
            matchedItem: item,
            score: 1.0,
            matchStatus: 'exact',
            suggestions: [item]
          }
        }
      }
    }

    const masterParsed = parseMedicineTokens(itemName)

    // 3. Brand token overlap
    let brandScore = 0
    if (scannedParsed.brandTokens.length > 0 && masterParsed.brandTokens.length > 0) {
      let matchedCount = 0
      for (const st of scannedParsed.brandTokens) {
        if (masterParsed.brandTokens.some(mt => mt === st || (mt.length > 3 && (mt.includes(st) || st.includes(mt))))) {
          matchedCount++
        }
      }
      brandScore = matchedCount / Math.max(scannedParsed.brandTokens.length, masterParsed.brandTokens.length)
    }

    // 4. Strength match (e.g. 40, 625, 500, 2.5, 1.25)
    let strengthScore = 1.0
    if (scannedParsed.strengths.length > 0 && masterParsed.strengths.length > 0) {
      const hasSharedStrength = scannedParsed.strengths.some(s => masterParsed.strengths.includes(s))
      strengthScore = hasSharedStrength ? 1.0 : 0.4
    }

    // 5. Dice similarity on whole cleaned names
    const dice = diceSimilarity(cleanScanned, cleanMaster)

    // Substring bonus
    const hasSubstring = cleanMaster.includes(cleanScanned) || cleanScanned.includes(cleanMaster)
    const subBonus = hasSubstring ? 0.2 : 0

    // Compute composite match score
    const compositeScore = Math.min(1.0, Math.max(
      dice,
      (brandScore * 0.7 + (hasSubstring ? 0.25 : 0)) * strengthScore,
      (brandScore * 0.6 + dice * 0.4 + subBonus) * strengthScore
    ))

    if (compositeScore >= 0.35) {
      scoredList.push({ item, score: Math.round(compositeScore * 100) / 100 })
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score)

  if (scoredList.length === 0) {
    return { matchedItem: null, score: 0, matchStatus: 'unmapped', suggestions: [] }
  }

  const best = scoredList[0]
  const suggestions = scoredList.slice(0, 5).map(s => s.item)

  let matchStatus: 'exact' | 'high' | 'fuzzy' | 'unmapped' = 'unmapped'
  if (best.score >= 0.85) matchStatus = 'exact'
  else if (best.score >= 0.60) matchStatus = 'high'
  else if (best.score >= 0.40) matchStatus = 'fuzzy'

  return {
    matchedItem: matchStatus !== 'unmapped' ? best.item : null,
    score: best.score,
    matchStatus,
    suggestions
  }
}

/**
 * Finds the best matching medicine from master catalog for an OCR-scanned medicine text
 */
export function matchMedicineToMaster(
  scannedText: string,
  masterItems: MasterItemOption[]
): MedicineMatchResult {
  if (!scannedText) {
    return { matchedItem: null, score: 0, matchStatus: 'unmapped', suggestions: [] }
  }

  // 1. Prioritize user's provided master items
  if (masterItems && masterItems.length > 0) {
    const userResult = runMatchOnCatalog(scannedText, masterItems)
    if (userResult.matchStatus === 'exact' || userResult.matchStatus === 'high') {
      return userResult
    }
  }

  // 2. Search trained PHARMA_MASTER_CATALOG for instant mapping
  const catalogResult = runMatchOnCatalog(scannedText, PHARMA_MASTER_CATALOG)
  if (catalogResult.matchStatus === 'exact' || catalogResult.matchStatus === 'high') {
    return catalogResult
  }

  // 3. Fallback to caller's best candidate if any
  if (masterItems && masterItems.length > 0) {
    const userResult = runMatchOnCatalog(scannedText, masterItems)
    return userResult.score >= catalogResult.score ? userResult : catalogResult
  }

  return catalogResult
}

/**
 * Maps a list of OCR line items against the master catalog
 */
export function mapExtractedItemsToMaster(
  items: ExtractedLineItem[],
  masterItems: MasterItemOption[]
): ExtractedLineItem[] {
  return items.map((item) => {
    const match = matchMedicineToMaster(item.itemName, masterItems)
    const matched = match.matchedItem

    const masterRate = Number(matched?.rate || 0)
    const masterPurchaseRate = Number(matched?.purchaseRate || 0)
    const masterMrp = Number(matched?.mrp || (masterRate > 0 ? Math.round(masterRate * 1.35 * 100) / 100 : 0))
    const masterGst = Number(matched?.gstRate ?? 12)
    const masterHsn = matched?.hsn || '30049099'
    const masterPack = matched?.packing || '10x10'
    const masterStock = matched?.stock ?? 0

    const packing = (item.packing && item.packing.trim()) ? item.packing : masterPack
    const hsn = (item.hsn && item.hsn.trim()) ? item.hsn : masterHsn
    const gstRate = (item.gstRate && item.gstRate > 0) ? item.gstRate : masterGst
    const saleRate = (item.saleRate && item.saleRate > 0) ? item.saleRate : (masterRate || (masterMrp ? Math.round(masterMrp * 0.85 * 100) / 100 : 100))
    const purchaseRate = (item.purchaseRate && item.purchaseRate > 0) ? item.purchaseRate : (masterPurchaseRate || (masterRate ? Math.round(masterRate * 0.8 * 100) / 100 : 80))
    const mrp = (item.mrp && item.mrp > 0) ? item.mrp : (masterMrp || Math.round(saleRate * 1.3 * 100) / 100)
    
    const effRate = saleRate > 0 ? saleRate : (purchaseRate > 0 ? purchaseRate : mrp)
    const amount = (item.amount && item.amount > 0) ? item.amount : Math.round(effRate * (item.qty || 1) * 100) / 100

    return {
      ...item,
      mappedItemId: matched?.id || matched?.itemId,
      mappedItemName: matched?.name || matched?.label,
      matchScore: match.score,
      matchStatus: match.matchStatus,
      isConfirmed: match.matchStatus === 'exact' || match.matchStatus === 'high',
      packing,
      hsn,
      gstRate,
      mrp,
      saleRate,
      purchaseRate,
      amount,
      stock: masterStock
    }
  })
}
