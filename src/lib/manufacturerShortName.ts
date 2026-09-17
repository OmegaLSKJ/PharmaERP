/**
 * Produces the compact manufacturer label used in the narrow MFR column on
 * statutory print documents. The full manufacturer name remains in the item
 * master; this is only a legible print abbreviation.
 */
export function manufacturerShortName(value?: string | null): string {
  const name = String(value ?? '').trim()
  if (!name) return '—'

  const normalized = name
    .replace(/[.'&,/()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = normalized.split(' ')
  const ignored = new Set([
    'and', 'co', 'company', 'corporation', 'corp', 'healthcare', 'inc',
    'industries', 'limited', 'ltd', 'life', 'laboratories', 'laboratory',
    'labs', 'pharma', 'pharmaceutical', 'pharmaceuticals', 'private', 'pvt',
    'sciences', 'the',
  ])
  const meaningful = words.filter((word) => !ignored.has(word.toLowerCase()))

  // "Dr. Reddy's Laboratories" is conventionally printed as DRL.
  if (words[0]?.toLowerCase() === 'dr' && words.length > 1) return 'DRL'

  const primary = meaningful[0] || words[0]
  return primary.toUpperCase().slice(0, 8)
}
