import { describe, it, expect } from 'vitest'
import {
  scoreOptionMatch,
  filterAndRankRecommendations,
  levenshteinDistance,
  diceSimilarity,
  findMatchRanges
} from '../src/lib/similarity'

describe('Recommendation & Similarity Engine', () => {
  const sampleParties = [
    { label: 'ADITYA PHARMA TEZPUR', sub: 'Tezpur • SUPPLIER', right: '9876543210' },
    { label: 'ALIVE PHARMACEUTICALS', sub: 'SUPPLIER', right: '' },
    { label: 'AMAR DRUG DISTRIBUTOTRS TEZPUR', sub: 'Tezpur • SUPPLIER', right: '' },
    { label: 'ANAND AGENCY', sub: 'Biswanath • SUPPLIER', right: '' },
    { label: 'ANAND PHARMACEUTICALS.D TEZPUR', sub: 'Tezpur • SUPPLIER', right: '' },
    { label: 'ARATI DRUG DISTRIBUTORS.D BORGANG', sub: 'Borgang • SUPPLIER', right: '' },
    { label: 'APOLLO PHARMACY', sub: 'Tezpur • CUSTOMER', right: '9876543211' },
    { label: 'BORGANG MEDICAL HALL', sub: 'Borgang • CUSTOMER', right: '03712-260111' },
    { label: 'MEDPLUS CHEMIST', sub: 'CUSTOMER', right: '' }
  ]

  it('calculates string edit distance and dice similarity accurately', () => {
    expect(levenshteinDistance('anand', 'anant')).toBe(1)
    expect(levenshteinDistance('aditya', 'adtya')).toBe(1)
    expect(diceSimilarity('pharma', 'pharma')).toBe(1)
    expect(diceSimilarity('apollo', 'apolo')).toBeGreaterThan(0.6)
  })

  it('prioritizes exact matches and prefix matches', () => {
    const results = filterAndRankRecommendations('anand', sampleParties)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results[0].item.label.startsWith('ANAND')).toBe(true)
    expect(results[0].matchType).toBe('prefix')
  })

  it('recommends similar names when typing with typos (e.g. "anant" -> "ANAND")', () => {
    const results = filterAndRankRecommendations('anant', sampleParties)
    expect(results.length).toBeGreaterThanOrEqual(2)
    const labels = results.map((r) => r.item.label)
    expect(labels).toContain('ANAND AGENCY')
    expect(labels).toContain('ANAND PHARMACEUTICALS.D TEZPUR')
    expect(results[0].isSimilarRecommendation).toBe(true)
  })

  it('recommends similar names for dropped letters (e.g. "adtya" -> "ADITYA PHARMA TEZPUR")', () => {
    const results = filterAndRankRecommendations('adtya', sampleParties)
    expect(results[0].item.label).toBe('ADITYA PHARMA TEZPUR')
    expect(results[0].isSimilarRecommendation).toBe(true)
  })

  it('handles word transposition / out-of-order search (e.g. "tezpur aditya")', () => {
    const results = filterAndRankRecommendations('tezpur aditya', sampleParties)
    expect(results[0].item.label).toBe('ADITYA PHARMA TEZPUR')
    expect(['token_match', 'similar']).toContain(results[0].matchType)
  })

  it('matches database typo with user standard spelling (e.g. "amar drug distributor")', () => {
    const results = filterAndRankRecommendations('amar drug distributor', sampleParties)
    expect(results[0].item.label).toBe('AMAR DRUG DISTRIBUTOTRS TEZPUR')
  })

  it('matches acronyms / initials (e.g. "apt" -> "ADITYA PHARMA TEZPUR")', () => {
    const results = filterAndRankRecommendations('apt', sampleParties)
    expect(results[0].item.label).toBe('ADITYA PHARMA TEZPUR')
  })

  it('finds highlight character ranges for typed query', () => {
    const ranges = findMatchRanges('pharma', 'ADITYA PHARMA TEZPUR')
    expect(ranges.length).toBe(1)
    expect(ranges[0]).toEqual([7, 13])
  })
})
