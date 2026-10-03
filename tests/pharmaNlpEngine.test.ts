import { describe, it, expect } from 'vitest'
import {
  repairOcrCharacters,
  cleanPharmaNlp,
  pharmaPhoneticKey,
  extractPharmaEntity,
  scorePharmaMatch
} from '../src/lib/ocr/pharmaNlpEngine'
import { MasterItemOption } from '../src/lib/ocr/medicineMapper'

describe('pharmaNlpEngine', () => {
  describe('repairOcrCharacters', () => {
    it('repairs optical zero to O in letter context', () => {
      expect(repairOcrCharacters('D0L0 650')).toBe('DOLO 650')
      expect(repairOcrCharacters('METR0GYL 400')).toBe('METROGYL 400')
      expect(repairOcrCharacters('C0NC0R 5')).toBe('CONCOR 5')
    })

    it('repairs optical 1 or | to I in word context', () => {
      expect(repairOcrCharacters('AUGMENT1N 625')).toBe('AUGMENTIN 625')
      expect(repairOcrCharacters('AZ1THRAL 500')).toBe('AZITHRAL 500')
      expect(repairOcrCharacters('CLAV1ND')).toBe('CLAVIND')
    })

    it('repairs optical 5 to S and 8 to B in letter context', () => {
      expect(repairOcrCharacters('5HELCAL 500')).toBe('SHELCAL 500')
      expect(repairOcrCharacters('8URNOL CREAM')).toBe('BURNOL CREAM')
      expect(repairOcrCharacters('COM8IFLAM')).toBe('COMBIFLAM')
    })

    it('repairs rn to m ligature error', () => {
      expect(repairOcrCharacters('rnOXIKIND CV')).toBe('mOXIKIND CV')
    })

    it('preserves numeric dosage strengths and quantities', () => {
      expect(repairOcrCharacters('DOLO 650 10 25.50')).toBe('DOLO 650 10 25.50')
    })
  })

  describe('cleanPharmaNlp', () => {
    it('separates conjoined numbers and letters', () => {
      expect(cleanPharmaNlp('PAN40MG TAB')).toBe('PAN 40 MG TAB')
      expect(cleanPharmaNlp('TELMA40MG')).toBe('TELMA 40 MG')
      expect(cleanPharmaNlp('AUGMENTIN625')).toBe('AUGMENTIN 625')
    })

    it('strips parentheses pack sizes and serial numbers', () => {
      expect(cleanPharmaNlp('1. DOLO 650 (15 TAB)')).toBe('DOLO 650')
      expect(cleanPharmaNlp('02 - AUGMENTIN 625 (10S)')).toBe('AUGMENTIN 625')
    })

    it('standardizes hyphenated combinations and medical abbreviations', () => {
      expect(cleanPharmaNlp('PAN-D CAP')).toBe('PAN D CAP')
      expect(cleanPharmaNlp('D.F.O GEL')).toBe('DFO GEL')
      expect(cleanPharmaNlp('TELMA-H 40/12.5')).toBe('TELMA H 40/12.5')
    })
  })

  describe('pharmaPhoneticKey', () => {
    it('produces identical phonetic key for PH vs F', () => {
      expect(pharmaPhoneticKey('CEPHALEXIN')).toBe(pharmaPhoneticKey('CEFALEXIN'))
    })

    it('produces identical phonetic key for C vs K', () => {
      expect(pharmaPhoneticKey('CLAVAM')).toBe(pharmaPhoneticKey('KLAVAM'))
      expect(pharmaPhoneticKey('CALPOL')).toBe(pharmaPhoneticKey('KALPOL'))
    })

    it('produces identical phonetic key for TH vs T', () => {
      expect(pharmaPhoneticKey('AZITHRAL')).toBe(pharmaPhoneticKey('AZITRAL'))
    })

    it('produces identical phonetic key for Z vs S', () => {
      expect(pharmaPhoneticKey('ZERODOL')).toBe(pharmaPhoneticKey('SERODOL'))
    })
  })

  describe('extractPharmaEntity', () => {
    it('decomposes brand, strength, modifier, and form', () => {
      const entity = extractPharmaEntity('AUGMENTIN 625 DUO TABLET')
      expect(entity.coreBrand).toBe('AUGMENTIN')
      expect(entity.strengths).toEqual(['625'])
      expect(entity.modifiers.has('DUO')).toBe(true)
      expect(entity.dosageForm).toBe('TABLET')
    })

    it('extracts combination modifier D and capsule form for PAN-D', () => {
      const entity = extractPharmaEntity('PAN-D CAP 15S')
      expect(entity.coreBrand).toBe('PAN')
      expect(entity.modifiers.has('D')).toBe(true)
      expect(entity.dosageForm).toBe('CAPSULE')
    })

    it('extracts dual strength for blood pressure combination', () => {
      const entity = extractPharmaEntity('TELMA-H 40/12.5 TAB')
      expect(entity.coreBrand).toBe('TELMA')
      expect(entity.modifiers.has('H')).toBe(true)
      expect(entity.strengths).toContain('40/12.5')
    })
  })

  describe('scorePharmaMatch - Pharmaceutical alignment rules', () => {
    const catalog: Record<string, MasterItemOption> = {
      pan40: { id: '1', name: 'PAN 40MG TABLET', packing: '15 Tablets', rate: 120 },
      panD: { id: '2', name: 'PAN-D CAPSULE', packing: '15 Capsules', rate: 160 },
      telma40: { id: '3', name: 'TELMA 40MG TABLET', packing: '10x10', rate: 145 },
      telma20: { id: '4', name: 'TELMA 20MG TABLET', packing: '10x10', rate: 85 },
      telmaH: { id: '5', name: 'TELMA-H TABLET', packing: '10x10', rate: 195 },
      telmaAm: { id: '6', name: 'TELMA-AM TABLET', packing: '10x10', rate: 210 },
      clavam625: { id: '7', name: 'CLAVAM 625 TABLET', packing: '10 Tablets', rate: 175 },
      augmentin625: { id: '8', name: 'AUGMENTIN 625 DUO TABLET', packing: '10 Tablets', rate: 185 },
      dolo650: { id: '9', name: 'DOLO 650 TABLET', packing: '15 Tablets', rate: 25 },
      dolo500: { id: '10', name: 'DOLO 500 TABLET', packing: '15 Tablets', rate: 18 }
    }

    it('accurately distinguishes PAN 40 from PAN-D', () => {
      const matchPan40 = scorePharmaMatch('PAN 40MG TAB', catalog.pan40)
      const matchPanDToPan40 = scorePharmaMatch('PAN-D CAP', catalog.pan40)

      expect(matchPan40.score).toBeGreaterThanOrEqual(0.85)
      expect(matchPan40.status).toBe('exact')

      // PAN-D must NOT match PAN 40
      expect(matchPanDToPan40.score).toBeLessThan(0.40)
      expect(matchPanDToPan40.status).toBe('unmapped')

      // PAN-D must match PAN-D CAPSULE
      const matchPanD = scorePharmaMatch('PAN-D CAP', catalog.panD)
      expect(matchPanD.score).toBeGreaterThanOrEqual(0.85)
      expect(matchPanD.status).toBe('exact')
    })

    it('accurately distinguishes dosage strength (TELMA 40 vs TELMA 20)', () => {
      const match40To40 = scorePharmaMatch('TELMA 40', catalog.telma40)
      const match20To40 = scorePharmaMatch('TELMA 20', catalog.telma40)
      const match20To20 = scorePharmaMatch('TELMA 20', catalog.telma20)

      expect(match40To40.score).toBeGreaterThanOrEqual(0.85)
      expect(match20To40.score).toBeLessThan(0.40)
      expect(match20To20.score).toBeGreaterThanOrEqual(0.85)
    })

    it('accurately distinguishes conflicting chemical combinations (TELMA-H vs TELMA-AM)', () => {
      const matchHToH = scorePharmaMatch('TELMA-H TAB', catalog.telmaH)
      const matchHToAm = scorePharmaMatch('TELMA-H TAB', catalog.telmaAm)

      expect(matchHToH.score).toBeGreaterThanOrEqual(0.85)
      expect(matchHToAm.score).toBeLessThan(0.40)
    })

    it('matches OCR corrupted text via OCR repair and phonetics', () => {
      // Optical zero: D0L0 650 -> DOLO 650
      const doloMatch = scorePharmaMatch('D0L0 650', catalog.dolo650)
      expect(doloMatch.score).toBeGreaterThanOrEqual(0.85)

      // Optical 1: AUGMENT1N 625 -> AUGMENTIN 625 DUO
      const augMatch = scorePharmaMatch('AUGMENT1N 625', catalog.augmentin625)
      expect(augMatch.score).toBeGreaterThanOrEqual(0.80)

      // Phonetic typo: KLAVAM 625 -> CLAVAM 625
      const clavamMatch = scorePharmaMatch('KLAVAM 625', catalog.clavam625)
      expect(clavamMatch.score).toBeGreaterThanOrEqual(0.80)
    })
  })
})
