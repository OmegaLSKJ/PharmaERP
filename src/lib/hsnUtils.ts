import defaultHsnMaster from '../data/hsnMasterData.json'

export interface HsnMasterEntry {
  id?: string
  code: string
  description: string
  gstRate: number
  gst_rate?: number
  type?: string
}

// Authoritative map of HSN code to metadata
const hsnMap = new Map<string, HsnMasterEntry>()

// Populate map from authoritative master data
;(defaultHsnMaster as HsnMasterEntry[]).forEach((entry) => {
  const code = String(entry.code).trim().toUpperCase()
  const rate = Number(entry.gstRate ?? entry.gst_rate ?? (code.startsWith('3004') ? 5 : 12))
  hsnMap.set(code, {
    ...entry,
    code,
    gstRate: rate,
    gst_rate: rate,
    type: entry.type || (code.startsWith('99') ? 'Services' : 'Goods')
  })
})

/**
 * Dynamically register or update HSN/SAC codes from database or live API.
 * Ensures any code added/modified in Supabase is immediately mapped and available globally.
 */
export function registerHsnCodesFromDb(
  rows: Array<Partial<HsnMasterEntry> & { code?: string | number | null; gst_rate?: number; gstRate?: number }>
): void {
  if (!Array.isArray(rows)) return
  for (const row of rows) {
    if (!row || !row.code) continue
    const cleanCode = String(row.code).trim().toUpperCase()
    if (!cleanCode) continue
    const rate = Number(row.gstRate ?? row.gst_rate ?? (cleanCode.startsWith('3004') ? 5 : 12))
    const existing = hsnMap.get(cleanCode)
    hsnMap.set(cleanCode, {
      id: row.id || existing?.id,
      code: cleanCode,
      description: row.description || existing?.description || `HSN/SAC ${cleanCode}`,
      gstRate: rate,
      gst_rate: rate,
      type: row.type || existing?.type || (cleanCode.startsWith('99') ? 'Services' : 'Goods')
    })
  }
}

/**
 * Asynchronously initialize/warm the HSN cache directly from Supabase / ERP API.
 */
export async function initHsnFromDb(): Promise<HsnMasterEntry[]> {
  try {
    const { getErp } = await import('./erpApi')
    const rows = await getErp<any[]>('hsn')
    if (Array.isArray(rows) && rows.length > 0) {
      registerHsnCodesFromDb(rows)
    }
  } catch (err) {
    // Non-blocking fallback to bundled canonical Marg HSN master data
  }
  return getAllHsnCodes()
}

/**
 * Returns all authoritative HSN master entries.
 */
export function getAllHsnCodes(): HsnMasterEntry[] {
  return Array.from(hsnMap.values())
}

/**
 * Resolves the official GST rate for any given HSN code.
 * Follows HSN Master mapping, with standard pharmaceutical classification fallbacks.
 *
 * @param hsn The HSN/SAC code to look up (e.g. "30049011", "2106", "3004")
 * @param defaultRate Default fallback if no match (defaults to 5% for pharma medicaments)
 */
export function getGstRateForHsn(hsn?: string | number | null, defaultRate = 5): number {
  if (!hsn) return defaultRate

  const cleaned = String(hsn).trim().toUpperCase()
  if (!cleaned) return defaultRate

  // Check exact match
  const exact = hsnMap.get(cleaned)
  if (exact !== undefined) {
    return exact.gstRate
  }

  // Handle common truncated / variant codes
  if (cleaned === '*NOT' || cleaned.startsWith('*NOT')) {
    const notAppli = hsnMap.get('*NOT APPLI')
    if (notAppli) return notAppli.gstRate
    return 12
  }

  // Check prefix match against 8-digit, 6-digit, 4-digit codes in map
  for (let len = cleaned.length; len >= 2; len--) {
    const prefix = cleaned.substring(0, len)
    const match = hsnMap.get(prefix)
    if (match !== undefined) {
      return match.gstRate
    }
  }

  // Standard Indian Pharma GST statutory fallbacks:
  // Chapter 3004 (All medicaments / formulations): 5% GST
  if (cleaned.startsWith('3004')) return 5

  // Chapter 3002 (Vaccines, human/animal blood preparations): 5% GST
  if (cleaned.startsWith('3002')) return 5

  // Chapter 2309 (Preparations for animal feeding / veterinary): 0% GST
  if (cleaned.startsWith('2309')) return 0

  // Chapter 2106 (Food preparations / Nutraceutical supplements): 18% GST
  if (cleaned.startsWith('2106')) return 18

  // Chapter 3003 (Medicaments unmixed/bulk): 12% GST
  if (cleaned.startsWith('3003')) return 12

  // Chapter 3005 / 3006 (Dressings, bandages, pharmaceutical appliances): 12% GST
  if (cleaned.startsWith('3005') || cleaned.startsWith('3006')) return 12

  // Chapter 9018 / 9021 (Medical appliances & devices): 12% GST
  if (cleaned.startsWith('9018') || cleaned.startsWith('9021')) return 12

  return defaultRate
}

/**
 * Returns full HSN details if available in master data.
 */
export function getHsnDetails(hsn?: string | number | null): HsnMasterEntry | undefined {
  if (!hsn) return undefined
  const cleaned = String(hsn).trim().toUpperCase()
  if (!cleaned) return undefined

  if (cleaned === '*NOT' || cleaned.startsWith('*NOT')) {
    return hsnMap.get('*NOT APPLI')
  }

  const exact = hsnMap.get(cleaned)
  if (exact) return exact

  for (let len = cleaned.length; len >= 2; len--) {
    const match = hsnMap.get(cleaned.substring(0, len))
    if (match) return match
  }

  return undefined
}

/**
 * Automatically infers an HSN code and statutory GST rate for any medicine/item
 * based on Indian pharmaceutical classification rules.
 */
export function inferHsnForItem(itemName?: string, category?: string): { code: string; gstRate: number } {
  const name = String(itemName || '').toLowerCase()
  if (name.includes('soap') || name.includes('wash') || name.includes('cleans') || name.includes('bath bar')) {
    return { code: '3401', gstRate: 18 }
  }
  if (
    name.includes('protein') ||
    name.includes('whey') ||
    name.includes('powder') ||
    name.includes('supplement') ||
    name.includes('energy') ||
    name.includes('glucose') ||
    name.includes('nutra') ||
    name.includes('malt')
  ) {
    return { code: '2106', gstRate: 18 }
  }
  if (
    name.includes('vaccine') ||
    name.includes('serum') ||
    name.includes('toxoid') ||
    name.includes('tetanus') ||
    name.includes('rabies') ||
    name.includes('anti-venom')
  ) {
    return { code: '3002', gstRate: 5 }
  }
  if (
    name.includes('syringe') ||
    name.includes('needle') ||
    name.includes('cannula') ||
    name.includes('scalpel') ||
    name.includes('surgical') ||
    name.includes('infusion') ||
    name.includes('catheter')
  ) {
    return { code: '9018', gstRate: 12 }
  }
  if (
    name.includes('bandage') ||
    name.includes('gauze') ||
    name.includes('cotton') ||
    name.includes('dressing') ||
    name.includes('plaster') ||
    name.includes('crepe')
  ) {
    return { code: '3005', gstRate: 5 }
  }
  if (name.includes('glove') || name.includes('condom') || name.includes('rubber')) {
    return { code: '4014', gstRate: 12 }
  }
  if (
    name.includes('cream') ||
    name.includes('lotion') ||
    name.includes('sunscreen') ||
    name.includes('gel') ||
    name.includes('moisturiz')
  ) {
    return { code: '3304', gstRate: 18 }
  }
  if (
    name.includes('vet') ||
    name.includes('bolus') ||
    name.includes('cattle') ||
    name.includes('poultry') ||
    name.includes('feed')
  ) {
    return { code: '2309', gstRate: 12 }
  }
  // Default medicaments formulation
  return { code: '3004', gstRate: 5 }
}

