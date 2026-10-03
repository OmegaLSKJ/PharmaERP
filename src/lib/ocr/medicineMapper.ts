import { ExtractedLineItem } from './types'
import { PHARMA_MASTER_CATALOG } from './pharmaMasterCatalog'
import { scorePharmaMatch, cleanPharmaNlp } from './pharmaNlpEngine'

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
  reasons?: string[]
}

export function cleanPharmaName(str: string): string {
  return cleanPharmaNlp(str)
}

function runMatchOnCatalog(
  scannedText: string,
  catalog: MasterItemOption[]
): MedicineMatchResult {
  if (!scannedText || !catalog || catalog.length === 0) {
    return { matchedItem: null, score: 0, matchStatus: 'unmapped', suggestions: [] }
  }

  const scoredList: Array<{
    item: MasterItemOption
    score: number
    matchStatus: 'exact' | 'high' | 'fuzzy' | 'unmapped'
    reasons: string[]
  }> = []

  for (const item of catalog) {
    const itemName = item.name || item.label || ''
    if (!itemName) continue

    const nlpRes = scorePharmaMatch(scannedText, item)
    if (nlpRes.score >= 0.35) {
      scoredList.push({
        item,
        score: nlpRes.score,
        matchStatus: nlpRes.status,
        reasons: nlpRes.reasons
      })
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score)

  if (scoredList.length === 0) {
    return { matchedItem: null, score: 0, matchStatus: 'unmapped', suggestions: [] }
  }

  const best = scoredList[0]
  const suggestions = scoredList.slice(0, 5).map(s => s.item)

  return {
    matchedItem: best.matchStatus !== 'unmapped' ? best.item : null,
    score: best.score,
    matchStatus: best.matchStatus,
    suggestions,
    reasons: best.reasons
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

  // 1. If caller supplied master items (e.g. ERP items or custom test catalog)
  if (masterItems && masterItems.length > 0) {
    return runMatchOnCatalog(scannedText, masterItems)
  }

  // 2. Otherwise search trained PHARMA_MASTER_CATALOG
  return runMatchOnCatalog(scannedText, PHARMA_MASTER_CATALOG)
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
      stock: masterStock,
      suggestions: match.suggestions,
      matchReasons: match.reasons
    }
  })
}

