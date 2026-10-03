/**
 * Pharmaceutical Natural Language Processing (NLP) Engine
 * Designed specifically for Indian Pharma ERP, invoices, order sheets, and handwritten bills.
 * 
 * Provides:
 * 1. OCR typographical & optical noise disambiguation (0<->O, 1<->I, 5<->S, 8<->B, glued words)
 * 2. Pharma Named Entity Recognition (NER): Core Brand, Modifiers, Dosage Strengths, Dosage Forms, Packings
 * 3. Pharma-specific phonetic normalization (Metaphone/Soundex optimized for trade names)
 * 4. Multi-attribute NLP semantic scoring with strict pharmaceutical mismatch penalties (e.g. PAN vs PAN-D, TELMA-40 vs TELMA-20)
 * 5. Generic salt / molecular composition detection & cross-mapping
 */

import { diceSimilarity, levenshteinDistance } from '../similarity'
import { MasterItemOption } from './medicineMapper'

export interface PharmaEntity {
  raw: string
  normalized: string
  cleanTokens: string[]
  coreBrand: string
  phoneticBrand: string
  modifiers: Set<string>
  strengths: string[]
  dosageForm?: string
  pack?: string
  saltDetected?: string
}

export interface PharmaMatchScore {
  score: number // 0 to 1
  status: 'exact' | 'high' | 'fuzzy' | 'unmapped'
  reasons: string[]
  entityScanned: PharmaEntity
  entityMaster: PharmaEntity
}

// -------------------------------------------------------------
// 1. PHARMA LEXICAL CONSTANTS & KNOWLEDGE BASE
// -------------------------------------------------------------

// Dosage forms mapped to canonical forms
export const DOSAGE_FORMS: Record<string, string> = {
  tab: 'TABLET',
  tabs: 'TABLET',
  tablet: 'TABLET',
  tablets: 'TABLET',
  cap: 'CAPSULE',
  caps: 'CAPSULE',
  capsule: 'CAPSULE',
  capsules: 'CAPSULE',
  syp: 'SYRUP',
  syrup: 'SYRUP',
  susp: 'SUSPENSION',
  suspension: 'SUSPENSION',
  inj: 'INJECTION',
  injection: 'INJECTION',
  vial: 'INJECTION',
  ampoule: 'INJECTION',
  amp: 'INJECTION',
  gel: 'GEL',
  oint: 'OINTMENT',
  ointment: 'OINTMENT',
  cream: 'CREAM',
  drops: 'DROPS',
  drop: 'DROPS',
  drp: 'DROPS',
  drps: 'DROPS',
  liq: 'LIQUID',
  liquid: 'LIQUID',
  lotion: 'LOTION',
  soap: 'SOAP',
  resp: 'RESPULES',
  respules: 'RESPULES',
  rotacap: 'RESPULES',
  rotacaps: 'RESPULES',
  inhaler: 'RESPULES',
  powder: 'POWDER',
  pwdr: 'POWDER',
  sachet: 'POWDER',
  spray: 'SPRAY',
  belt: 'SURGICAL'
}

// Chemical combination modifiers (strictly differentiate distinct molecular drugs)
export const CHEMICAL_MODIFIERS = new Set([
  'd', 'dsr', 'dm', 'l', 'lsr', 'it', 'o', 'dx', 'ls',
  'cv', 'clav',
  'h', 'ct', 'am', 'at', 'az',
  'sp', 'p', 'th', 'ap', 'mr', 'dp',
  'lc', 'm', 'fx', 'ax',
  'hd', 'mps', 'av', 'z', 'k'
])

// Brand extension & formulation modifiers (potency or release profile)
export const EXTENSION_MODIFIERS = new Set([
  'duo', 'forte', 'plus', 'max', 'advance', 'chewable',
  'sr', 'cr', 'er', 'xr', 'xl', 'pr'
])

export const ALL_MODIFIERS = new Set([
  ...Array.from(CHEMICAL_MODIFIERS),
  ...Array.from(EXTENSION_MODIFIERS)
])

// Common dosage strengths
export const COMMON_STRENGTHS = new Set([
  '1000', '650', '625', '500', '400', '375', '300', '250', '200', '150', '125',
  '100', '90', '75', '60', '50', '40', '30', '25', '20', '16', '15', '14',
  '10', '8', '2.5', '1.5', '1.25', '0.5', '0.25'
])

// Single digits that are strengths ONLY when accompanied by explicit unit (MG/ML/GM)
export const UNIT_REQUIRING_STRENGTHS = new Set(['1', '2', '3', '4', '5', '6', '7'])

// Generic salts dictionary for cross-matching brand <-> salt
export const COMMON_SALTS: Record<string, string[]> = {
  PARACETAMOL: ['dolo', 'calpol', 'crocin', 'pacimol', 'pyragesic'],
  PANTOPRAZOLE: ['pan', 'pantocid', 'pantosec', 'pantodac', 'pantocar'],
  'AMOXICILLIN AND CLAVULANATE': ['augmentin', 'clavam', 'moxikind-cv', 'moxclav', 'admentin', 'sensiclav'],
  TELMISARTAN: ['telma', 'telmikind', 'tazloc', 'telpres', 'telvas', 'arbitel'],
  AMLODIPINE: ['amlong', 'amlo', 'stamlo', 'amcard', 'amlopres'],
  AZITHROMYCIN: ['azithral', 'aziwok', 'zady', 'azax', 'azimax'],
  CEFIXIME: ['taxim-o', 'ceftas', 'zifi', 'omnicef', 'mahacef'],
  CEFUROXIME: ['ceftum', 'cetil', 'altacef', 'pulmocef', 'furoxil'],
  DICLOFENAC: ['voveran', 'dfo', 'volini', 'dicloran', 'nac'],
  ACECLOFENAC: ['zerodol', 'hifenac', 'aceclo', 'dolowin'],
  RABEPRAZOLE: ['rablet', 'razo', 'happi', 'rabicip', 'parit'],
  MONTELUKAST: ['montek', 'montair', 'romilast', 'levolin'],
  METFORMIN: ['glycomet', 'glyciphage', 'gluconorm', 'obimet'],
  ROSUVASTATIN: ['rosuvas', 'rozavel', 'rosave', 'razel'],
  ATORVASTATIN: ['atorva', 'atorlip', 'tg-tor', 'lipitor'],
  ONDANSETRON: ['emeset', 'vomikind', 'zofer', 'periset'],
  ITRACONAZOLE: ['itrasys', 'canditral', 'itrole', 'sb-itra']
}

// -------------------------------------------------------------
// 2. OCR TYPO DISAMBIGUATION & TEXT REPAIR
// -------------------------------------------------------------

/**
 * Repairs optical character recognition noise inside alphabetic words.
 * For example: 'D0L0' -> 'DOLO', 'AUGMENT1N' -> 'AUGMENTIN', 'CLAV1ND' -> 'CLAVIND'
 */
export function repairOcrCharacters(str: string): string {
  if (!str) return ''

  return str
    .split(/\s+/)
    .map(token => {
      // If token is purely numeric or decimal (like a quantity or rate e.g. "650", "120.50"), leave it intact
      if (/^\d+(?:\.\d+)?$/.test(token)) return token

      // If token is a pack quantity like 1PCS, 1ST, 1VIAL, 10TAB, 15CAP, leave it intact
      if (/^\d+(?:PCS?|ST|VIALS?|TAB|CAP|S|T|ML|GM|MG)$/i.test(token)) return token

      // If token is a combination of letters and digits like 'D0L0' or 'AUGMENT1N' or 'METR0GYL'
      // Disambiguate '0' as 'O' when surrounded by letters
      let fixed = token.replace(/([A-Za-z])0([A-Za-z])/g, '$1O$2')
      fixed = fixed.replace(/^0([A-Za-z]{2,})/g, 'O$1')
      fixed = fixed.replace(/([A-Za-z]{2,})0$/g, '$1O')

      // Disambiguate '1' or '|' as 'I' when surrounded by letters
      fixed = fixed.replace(/([A-Za-z])[1\|]([A-Za-z])/g, '$1I$2')
      fixed = fixed.replace(/^[1\|]([A-Za-z]{2,})/g, 'I$1')
      fixed = fixed.replace(/([A-Za-z]{2,})[1\|]$/g, '$1I')

      // Disambiguate '5' as 'S' in letter contexts
      fixed = fixed.replace(/([A-Za-z])5([A-Za-z])/g, '$1S$2')
      fixed = fixed.replace(/^5([A-Za-z]{2,})/g, 'S$1')

      // Disambiguate '8' as 'B' in letter contexts
      fixed = fixed.replace(/([A-Za-z])8([A-Za-z])/g, '$1B$2')
      fixed = fixed.replace(/^8([A-Za-z]{2,})/g, 'B$1')

      // Disambiguate 'rn' as 'm' in letter contexts (common Tesseract ligature error)
      fixed = fixed.replace(/rn/g, 'm')

      return fixed
    })
    .join(' ')
}

/**
 * Normalizes pharma strings:
 * - Strips packaging notations like 10'S, 15S, 10X10, 10TAB
 * - Preserves compound strengths like 40/12.5
 * - Separates numbers and units (e.g. 500MG -> 500 MG)
 * - Normalizes hyphens & slashes
 */
export function cleanPharmaNlp(str: string): string {
  if (!str) return ''

  let text = str.toUpperCase()

  // 1. Strip packaging inside parentheses e.g. (10'S), (15 TAB), (10*10)
  text = text.replace(/\(\s*\d+[^)]*\)/g, ' ')

  // 2. Strip leading serial numbers (e.g. "1. ", "02 - ", "3) ")
  text = text.replace(/^\s*(?:SL\.?\s*)?\d{1,3}[\.\)\-\s]+/, ' ')

  // 3. Standardize common abbreviations
  text = text
    .replace(/D\.F\.O/g, 'DFO')
    .replace(/L\s*\.?\s*S\s*\.?\s*BELT/g, 'LS BELT')
    .replace(/\b(?:IP|BP|USP)\b/g, ' ')
    .replace(/\b(?:SCHEDULE\s*H|SCH\s*H|NRX|RX)\b/g, ' ')

  // 4. OCR character repair
  text = repairOcrCharacters(text)

  // 5. Strip pack sizes: 10'S, 15S, 10T, 10TAB, 15CAP, 10X10, 1ST, 1PCS
  text = text.replace(/\b(?<!\.)\d+\s*['xX*]\s*\d+\b/g, ' ')
  text = text.replace(/\b(?<!\.)\d+\s*[']?[SsTt]\b/g, ' ')
  text = text.replace(/\b1\s*(?:ST|PCS?)\b/gi, ' ')
  text = text.replace(/\b(?<!\.)\d+\s*(?:CAPS?|TABS?|STRIPS?|BOX|VIALS?|BOTTLES?)\b/gi, ' ')
  text = text.replace(/\b(?:0|5)\.00\b/g, ' ')

  // 6. Preserve compound strengths (e.g. 40/12.5, 50/500, 40/5)
  text = text.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, '$1_$2')

  // 7. Separate letters and numbers (e.g. "PAN40" -> "PAN 40", "TELMA40MG" -> "TELMA 40 MG")
  text = text.replace(/([A-Z]+)(\d+(?:\.\d+)?)/g, '$1 $2')
  text = text.replace(/(\d+(?:\.\d+)?)([A-Z]+)/g, '$1 $2')

  // 8. Replace punctuation, preserving decimal numbers (periods between digits)
  text = text.replace(/[-,\/#!$%\^&\*;:{}=`~+]/g, ' ')
  text = text.replace(/(?<!\d)\.|\.(?!\d)/g, ' ') // remove periods not part of decimals
  text = text.replace(/[\(\)]/g, ' ')

  // 9. Restore compound strengths
  text = text.replace(/(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)/g, '$1/$2')

  // 10. Strip trailing single-digit discount remnant (e.g. "DOLO 650 5" -> "DOLO 650")
  text = text.replace(/\s+[05]\s*$/, '')

  return text.replace(/\s+/g, ' ').trim()
}

// -------------------------------------------------------------
// 3. PHARMA PHONETIC KEY GENERATOR
// -------------------------------------------------------------

/**
 * Computes a pharma-optimized phonetic key for trade brand names.
 */
export function pharmaPhoneticKey(brand: string): string {
  if (!brand) return ''
  let s = brand.toUpperCase().trim()

  // Remove non-alpha
  s = s.replace(/[^A-Z]/g, '')
  if (!s) return ''

  // Phonetic substitutions
  s = s.replace(/PH/g, 'F')
  s = s.replace(/C(?=[EIY])/g, 'S')
  s = s.replace(/C/g, 'K')
  s = s.replace(/Q/g, 'K')
  s = s.replace(/X/g, 'KS')
  s = s.replace(/TH/g, 'T')
  s = s.replace(/Y/g, 'I')
  s = s.replace(/Z/g, 'S')
  s = s.replace(/W/g, 'V')

  // Collapse double letters
  s = s.replace(/([A-Z])\1+/g, '$1')

  // Remove silent ending E if length > 3
  if (s.length > 3 && s.endsWith('E')) {
    s = s.slice(0, -1)
  }

  return s
}

// -------------------------------------------------------------
// 4. PHARMA NAMED ENTITY RECOGNITION (NER)
// -------------------------------------------------------------

const PACK_TOKENS = new Set([
  's', 't', 'cap', 'caps', 'tab', 'tabs', 'strip', 'strips', 'box', 'vial', 'pcs', 'bottle', 'gm', 'g', 'ml'
])

/**
 * Decomposes any medicine string into rich structured pharma entities.
 */
export function extractPharmaEntity(rawText: string): PharmaEntity {
  const normalized = cleanPharmaNlp(rawText)
  const tokens = normalized.split(/\s+/).filter(Boolean)

  let dosageForm: string | undefined
  const modifiers = new Set<string>()
  const strengths: string[] = []
  const brandTokens: string[] = []
  let pack: string | undefined

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase()
    const rawT = tokens[i]

    // 1. Check if dosage form
    if (DOSAGE_FORMS[t]) {
      dosageForm = DOSAGE_FORMS[t]
      continue
    }

    // 2. Check if unit of strength (skip e.g. "MG", "ML", "GM", "MCG", "IU")
    if (['mg', 'ml', 'gm', 'g', 'mcg', 'iu', 'kg'].includes(t)) {
      continue
    }

    // 3. Skip standalone pack marker tokens (e.g. 'S', 'T', 'PCS')
    if (PACK_TOKENS.has(t) && !ALL_MODIFIERS.has(t)) {
      pack = rawT
      continue
    }

    // 4. Check if strength pattern (e.g. "650", "625", "40", "40/12.5", "2.5")
    if (/^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/.test(rawT)) {
      if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(rawT)) {
        strengths.push(rawT)
        continue
      }
      if (COMMON_STRENGTHS.has(rawT)) {
        strengths.push(rawT)
        continue
      }
      // Single digit 1-7 is strength only if next token is unit (e.g. 5 MG)
      if (UNIT_REQUIRING_STRENGTHS.has(rawT)) {
        const nextT = (tokens[i + 1] || '').toLowerCase()
        if (['mg', 'ml', 'gm', 'mcg', 'iu'].includes(nextT)) {
          strengths.push(rawT)
          continue
        }
      }
    }

    // 5. Check if modifier (e.g. "D", "CV", "H", "AM", "SP", "DUO", "FORTE", "PLUS", "LC")
    if (ALL_MODIFIERS.has(t)) {
      modifiers.add(rawT.toUpperCase())
      continue
    }

    // 6. Otherwise, candidate brand token
    brandTokens.push(rawT.toUpperCase())
  }

  if (brandTokens.length === 0 && tokens.length > 0) {
    const nonFormToken = tokens.find(t => !DOSAGE_FORMS[t.toLowerCase()]) || tokens[0]
    brandTokens.push(nonFormToken.toUpperCase())
    modifiers.delete(nonFormToken.toUpperCase())
  }

  const coreBrand = brandTokens.join(' ')
  const phoneticBrand = pharmaPhoneticKey(coreBrand)

  // Detect generic salt from raw string if present
  let saltDetected: string | undefined
  const upperRaw = rawText.toUpperCase()
  for (const [saltName, brandAliases] of Object.entries(COMMON_SALTS)) {
    if (upperRaw.includes(saltName)) {
      saltDetected = saltName
      break
    }
    if (brandAliases.some(b => upperRaw.includes(b.toUpperCase()))) {
      saltDetected = saltName
      break
    }
  }

  return {
    raw: rawText,
    normalized,
    cleanTokens: tokens,
    coreBrand,
    phoneticBrand,
    modifiers,
    strengths,
    dosageForm,
    pack,
    saltDetected
  }
}

// -------------------------------------------------------------
// 5. NLP MULTI-ATTRIBUTE ALIGNMENT SCORER
// -------------------------------------------------------------

/**
 * Computes deep NLP affinity score between Scanned text and Master Catalog item.
 */
export function scorePharmaMatch(
  scannedText: string,
  masterItem: MasterItemOption
): PharmaMatchScore {
  const masterName = masterItem.name || masterItem.label || ''
  const entityScanned = extractPharmaEntity(scannedText)
  const entityMaster = extractPharmaEntity(masterName)

  const reasons: string[] = []

  // -------------------------------------------------------------
  // Check 1: Exact Normalized Equality
  // -------------------------------------------------------------
  if (entityScanned.normalized === entityMaster.normalized) {
    return {
      score: 1.0,
      status: 'exact',
      reasons: ['Exact normalized match'],
      entityScanned,
      entityMaster
    }
  }

  // -------------------------------------------------------------
  // Check 2: Explicit Aliases Match
  // -------------------------------------------------------------
  const aliases = masterItem.aliases || (masterItem as any).aliases || []
  if (aliases.length > 0) {
    const scNorm = entityScanned.normalized
    for (const al of aliases) {
      if (cleanPharmaNlp(al) === scNorm) {
        return {
          score: 1.0,
          status: 'exact',
          reasons: [`Matched explicit alias: ${al}`],
          entityScanned,
          entityMaster
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Attribute 1: Core Brand Similarity (Weight: 45%)
  // -------------------------------------------------------------
  let brandScore = 0
  const sb = entityScanned.coreBrand
  const mb = entityMaster.coreBrand

  if (sb === mb && sb.length > 0) {
    brandScore = 1.0
    reasons.push('Identical brand root')
  } else if (entityScanned.phoneticBrand === entityMaster.phoneticBrand && entityScanned.phoneticBrand.length > 2) {
    brandScore = 0.94
    reasons.push('Phonetic brand match')
  } else if (sb && mb) {
    if (sb.startsWith(mb) || mb.startsWith(sb)) {
      const minLen = Math.min(sb.length, mb.length)
      const maxLen = Math.max(sb.length, mb.length)
      brandScore = 0.85 * (minLen / maxLen)
    } else {
      const dist = levenshteinDistance(sb, mb)
      const maxLen = Math.max(sb.length, mb.length)
      if (maxLen > 4 && dist <= 1) {
        brandScore = 0.88
        reasons.push('Brand near-match (1 edit)')
      } else if (maxLen > 6 && dist <= 2) {
        brandScore = 0.74
        reasons.push('Brand near-match (2 edits)')
      } else {
        const dice = diceSimilarity(sb, mb)
        brandScore = dice * 0.75
      }
    }
  }

  // -------------------------------------------------------------
  // Attribute 2: Combination & Extension Modifiers (Weight: 25%)
  // -------------------------------------------------------------
  let modifierScore = 1.0
  const sMods = entityScanned.modifiers
  const mMods = entityMaster.modifiers

  const sChemical = new Set(Array.from(sMods).filter(m => CHEMICAL_MODIFIERS.has(m.toLowerCase())))
  const mChemical = new Set(Array.from(mMods).filter(m => CHEMICAL_MODIFIERS.has(m.toLowerCase())))
  const sExtension = new Set(Array.from(sMods).filter(m => EXTENSION_MODIFIERS.has(m.toLowerCase())))
  const mExtension = new Set(Array.from(mMods).filter(m => EXTENSION_MODIFIERS.has(m.toLowerCase())))

  let chemicalConflict = false
  if (sChemical.size === 0 && mChemical.size === 0) {
    chemicalConflict = false
  } else if (sChemical.size > 0 && mChemical.size > 0) {
    let sharedChem = 0
    for (const sc of sChemical) {
      if (mChemical.has(sc)) sharedChem++
    }
    if (sharedChem === Math.max(sChemical.size, mChemical.size)) {
      modifierScore = 1.0
      reasons.push('Exact chemical combination matched')
    } else {
      chemicalConflict = true
      modifierScore = -0.6
      reasons.push('Conflicting chemical combinations (e.g. H vs AM or SP vs P)')
    }
  } else {
    chemicalConflict = true
    modifierScore = -0.5
    reasons.push('Plain formulation vs Chemical combination mismatch')
  }

  if (!chemicalConflict) {
    if (sExtension.size > 0 || mExtension.size > 0) {
      let sharedExt = 0
      for (const se of sExtension) {
        if (mExtension.has(se)) sharedExt++
      }
      if (sharedExt > 0 || (sExtension.size === 0 && mExtension.size > 0) || (sExtension.size > 0 && mExtension.size === 0)) {
        modifierScore = sharedExt > 0 ? 1.0 : 0.88
        reasons.push('Compatible brand extension')
      }
    }
  }

  // -------------------------------------------------------------
  // Attribute 3: Dosage Strength Alignment (Weight: 20%)
  // -------------------------------------------------------------
  let strengthScore = 1.0
  let strengthConflict = false
  const sStrengths = entityScanned.strengths
  const mStrengths = entityMaster.strengths

  if (sStrengths.length > 0 && mStrengths.length > 0) {
    const hasShared = sStrengths.some(s => mStrengths.includes(s))
    if (hasShared) {
      strengthScore = 1.0
      reasons.push('Strength matched')
    } else {
      strengthConflict = true
      strengthScore = -0.6
      reasons.push('Conflicting dosage strength')
    }
  } else if (sStrengths.length === 0 && mStrengths.length === 0) {
    strengthScore = 1.0
  } else {
    // One mentions strength, the other does not
    strengthScore = 0.50
  }

  // -------------------------------------------------------------
  // Attribute 4: Dosage Form Alignment (Weight: 10%)
  // Incompatible forms: TABLET vs DROPS, TABLET vs GEL, TABLET vs SUSPENSION
  // -------------------------------------------------------------
  let formScore = 0.85
  let formConflict = false
  if (entityScanned.dosageForm && entityMaster.dosageForm) {
    if (entityScanned.dosageForm === entityMaster.dosageForm) {
      formScore = 1.0
      reasons.push('Dosage form matched')
    } else {
      formConflict = true
      formScore = -0.5
      reasons.push(`Dosage form conflict (${entityScanned.dosageForm} vs ${entityMaster.dosageForm})`)
    }
  }

  // -------------------------------------------------------------
  // Attribute 5: Generic Salt Recognition Bonus (Only when scanned is generic or matches salt)
  // -------------------------------------------------------------
  let saltBonus = 0
  const masterSalt = (masterItem.salt || '').toUpperCase()
  if (masterSalt && entityScanned.saltDetected && brandScore < 0.90) {
    if (masterSalt.includes(entityScanned.saltDetected)) {
      saltBonus = 0.20
      reasons.push('Active salt/molecule matched')
    }
  }

  // Whole string dice baseline
  const overallDice = diceSimilarity(entityScanned.normalized, entityMaster.normalized)

  // -------------------------------------------------------------
  // Composite Score Calculation
  // -------------------------------------------------------------
  let totalScore =
    brandScore * 0.45 +
    modifierScore * 0.25 +
    strengthScore * 0.20 +
    formScore * 0.10 +
    saltBonus

  totalScore = Math.max(0, Math.min(1.0, totalScore))

  // Boost exact/near brand matches only when NO critical conflicts exist
  if (brandScore >= 0.85 && !chemicalConflict && !strengthConflict && !formConflict) {
    totalScore = Math.max(totalScore, overallDice, 0.85)
  }

  // Severe conflicts strictly cap score below high match threshold
  if (chemicalConflict || strengthConflict || formConflict) {
    totalScore = Math.min(totalScore, 0.35)
  }

  totalScore = Math.round(totalScore * 100) / 100

  let status: 'exact' | 'high' | 'fuzzy' | 'unmapped' = 'unmapped'
  if (totalScore >= 0.82) status = 'exact'
  else if (totalScore >= 0.58) status = 'high'
  else if (totalScore >= 0.38) status = 'fuzzy'

  return {
    score: totalScore,
    status,
    reasons,
    entityScanned,
    entityMaster
  }
}
