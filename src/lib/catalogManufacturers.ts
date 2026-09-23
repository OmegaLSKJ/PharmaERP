import catalogData from './catalogManufacturers.json'

interface CatalogPayload {
  names: Record<string, string>
  codes: Record<string, string>
}

const typedCatalog = catalogData as CatalogPayload
const namesMap = new Map<string, string>()
const codesMap = new Map<string, string>()

for (const [k, v] of Object.entries(typedCatalog.names || {})) {
  namesMap.set(k.toUpperCase().trim(), v)
}

for (const [k, v] of Object.entries(typedCatalog.codes || {})) {
  codesMap.set(k.toUpperCase().trim(), v)
}

/**
 * Looks up the manufacturer name for an item from the authoritative Marg catalog.
 */
export function lookupCatalogManufacturer(name?: string | null, code?: string | null): string {
  if (name) {
    const found = namesMap.get(name.toUpperCase().trim())
    if (found) return found
  }
  if (code) {
    const found = codesMap.get(code.toUpperCase().trim())
    if (found) return found
  }
  return ''
}
