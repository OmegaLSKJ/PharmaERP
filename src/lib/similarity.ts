/**
 * Auto-recommendation & fuzzy similarity engine for ERP Typeahead and Customer/Party search.
 * Computes exact, prefix, acronym, token-reordered, and fuzzy/phonetic similarity scores.
 */

export type MatchType =
  | 'exact'
  | 'prefix'
  | 'acronym'
  | 'word_start'
  | 'substring'
  | 'token_match'
  | 'similar'
  | 'sub_match'
  | 'none'

export interface ScoredOption<T> {
  item: T
  score: number
  matchType: MatchType
  isSimilarRecommendation: boolean
  matchedRanges?: [number, number][]
}

/**
 * Normalizes text for robust comparison (lowercasing, trimming, removing extraneous punctuation).
 */
export function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Efficient O(min(m, n)) space Levenshtein distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let s1 = a
  let s2 = b
  if (s1.length > s2.length) {
    s1 = b
    s2 = a
  }

  const m = s1.length
  const n = s2.length
  const v0 = new Array(m + 1)
  const v1 = new Array(m + 1)

  for (let i = 0; i <= m; i++) v0[i] = i

  for (let j = 0; j < n; j++) {
    v1[0] = j + 1
    const s2Char = s2[j]
    for (let i = 0; i < m; i++) {
      const cost = s1[i] === s2Char ? 0 : 1
      v1[i + 1] = Math.min(v1[i] + 1, v0[i + 1] + 1, v0[i] + cost)
    }
    for (let i = 0; i <= m; i++) v0[i] = v1[i]
  }

  return v1[m]
}

/**
 * Generates character bigrams for Sørensen–Dice coefficient.
 */
function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2))
  }
  return bigrams
}

/**
 * Computes Sørensen–Dice similarity coefficient (0 to 1).
 */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0

  const bgA = getBigrams(a)
  const bgB = getBigrams(b)
  let intersection = 0

  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++
  }

  return (2 * intersection) / (bgA.size + bgB.size)
}

/**
 * Finds character ranges in target where the query matches (for visual highlighting).
 */
export function findMatchRanges(query: string, target: string): [number, number][] {
  if (!query || !target) return []
  const ranges: [number, number][] = []
  const qNorm = query.toLowerCase()
  const tNorm = target.toLowerCase()

  // 1. Direct continuous substring
  const subIdx = tNorm.indexOf(qNorm)
  if (subIdx !== -1) {
    return [[subIdx, subIdx + qNorm.length]]
  }

  // 2. Token-level matches
  const tokens = qNorm.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    let searchFrom = 0
    while (searchFrom < tNorm.length) {
      const idx = tNorm.indexOf(token, searchFrom)
      if (idx === -1) break
      ranges.push([idx, idx + token.length])
      searchFrom = idx + token.length
    }
  }

  // Merge overlapping ranges
  if (ranges.length > 1) {
    ranges.sort((a, b) => a[0] - b[0])
    const merged: [number, number][] = [ranges[0]]
    for (let i = 1; i < ranges.length; i++) {
      const prev = merged[merged.length - 1]
      const curr = ranges[i]
      if (curr[0] <= prev[1]) {
        prev[1] = Math.max(prev[1], curr[1])
      } else {
        merged.push(curr)
      }
    }
    return merged
  }

  return ranges
}

/**
 * Scores an option against a search query.
 */
export function scoreOptionMatch(
  queryRaw: string,
  labelRaw: string,
  subRaw = '',
  rightRaw = ''
): { score: number; matchType: MatchType; isSimilarRecommendation: boolean } {
  const q = normalizeSearchText(queryRaw)
  const l = normalizeSearchText(labelRaw)
  const s = normalizeSearchText(subRaw)
  const r = normalizeSearchText(rightRaw)

  if (!q) {
    return { score: 100, matchType: 'exact', isSimilarRecommendation: false }
  }

  // 1. Exact match (Highest Priority)
  if (l === q) {
    return { score: 100, matchType: 'exact', isSimilarRecommendation: false }
  }

  // 2. Prefix match (Starts with typed query)
  if (l.startsWith(q)) {
    const ratio = q.length / l.length
    return { score: 90 + Math.min(8, ratio * 8), matchType: 'prefix', isSimilarRecommendation: false }
  }

  // 3. Word start match (Any word in candidate starts with query)
  const lWords = l.split(' ').filter(Boolean)
  if (lWords.some((w) => w.startsWith(q))) {
    return { score: 84, matchType: 'word_start', isSimilarRecommendation: false }
  }

  // 4. Acronym / Initials match (e.g. 'apt' -> Aditya Pharma Tezpur)
  if (q.length >= 2) {
    const initials = lWords.map((w) => w[0]).join('')
    if (initials.startsWith(q)) {
      return { score: 80, matchType: 'acronym', isSimilarRecommendation: false }
    }
  }

  // 5. Continuous Substring
  if (l.includes(q)) {
    return { score: 76, matchType: 'substring', isSimilarRecommendation: false }
  }

  // 6. Multi-word Token match (all words in query present in label/sub in any order)
  const qWords = q.split(' ').filter(Boolean)
  if (qWords.length > 1) {
    const allWordsPresent = qWords.every((qw) =>
      lWords.some((w) => w.includes(qw) || levenshteinDistance(w, qw) <= 1)
    )
    if (allWordsPresent) {
      return { score: 72, matchType: 'token_match', isSimilarRecommendation: false }
    }
  }

  // 7. Auto-Recommendation: Fuzzy Similarity (typos, transposition, phonetics, near-misses)
  let totalTokenSim = 0
  for (const qw of qWords) {
    let bestTokenSim = 0
    for (const w of lWords) {
      if (w.startsWith(qw)) {
        bestTokenSim = Math.max(bestTokenSim, 0.92)
      } else if (w.includes(qw)) {
        bestTokenSim = Math.max(bestTokenSim, 0.85)
      } else {
        const dist = levenshteinDistance(w, qw)
        const maxLen = Math.max(w.length, qw.length)
        if (qw.length <= 3 && dist <= 1) {
          bestTokenSim = Math.max(bestTokenSim, 0.78)
        } else if (qw.length > 3 && dist <= 2) {
          bestTokenSim = Math.max(bestTokenSim, 1 - dist / maxLen)
        } else {
          const ds = diceSimilarity(w, qw)
          if (ds >= 0.45) bestTokenSim = Math.max(bestTokenSim, ds)
        }
      }
    }
    totalTokenSim += bestTokenSim
  }

  const avgTokenSim = totalTokenSim / (qWords.length || 1)
  const fullDice = diceSimilarity(q, l)
  const compositeFuzzy = Math.max(avgTokenSim, fullDice)

  // Recommend if fuzzy similarity is at or above threshold
  if (compositeFuzzy >= 0.45) {
    const score = 42 + compositeFuzzy * 26
    return { score, matchType: 'similar', isSimilarRecommendation: true }
  }

  // 8. Secondary matches in location/type (sub) or phone/GSTIN (right)
  if (s && s.includes(q)) {
    return { score: 38, matchType: 'sub_match', isSimilarRecommendation: false }
  }
  if (r && r.includes(q)) {
    return { score: 36, matchType: 'sub_match', isSimilarRecommendation: false }
  }

  return { score: 0, matchType: 'none', isSimilarRecommendation: false }
}

/**
 * Filters and ranks options with auto-recommendations and similarity scoring.
 */
export function filterAndRankRecommendations<T extends { label: string; sub?: string; right?: string }>(
  query: string,
  options: T[],
  config: { maxResults?: number; minSimilarityScore?: number } = {}
): ScoredOption<T>[] {
  const trimmed = (query || '').trim()
  const maxResults = config.maxResults ?? 60
  const minScore = config.minSimilarityScore ?? 35

  if (!trimmed) {
    return options.slice(0, maxResults).map((item) => ({
      item,
      score: 100,
      matchType: 'exact',
      isSimilarRecommendation: false,
    }))
  }

  const scored: ScoredOption<T>[] = []

  for (let i = 0; i < options.length; i++) {
    const item = options[i]
    const { score, matchType, isSimilarRecommendation } = scoreOptionMatch(
      trimmed,
      item.label,
      item.sub,
      item.right
    )

    if (score >= minScore) {
      scored.push({
        item,
        score,
        matchType,
        isSimilarRecommendation,
        matchedRanges: findMatchRanges(trimmed, item.label),
      })
    }
  }

  // Sort by score descending; if score tie, shorter label first, then alphabetical
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.item.label.length !== b.item.label.length) return a.item.label.length - b.item.label.length
    return a.item.label.localeCompare(b.item.label)
  })

  return scored.slice(0, maxResults)
}
