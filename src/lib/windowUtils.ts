/**
 * Utility for opening transaction documents (new invoices, delivery challans,
 * purchases, returns, orders, vouchers) in a dedicated new window/tab.
 */

const TRANSACTION_ENTRY_PREFIXES = [
  '/transactions/sale/new',
  '/transactions/sale/edit/',
  '/transactions/sale/challan',
  '/transactions/sale/counter',
  '/transactions/sale-return',
  '/transactions/purchase/new',
  '/transactions/purchase/edit/',
  '/transactions/purchase-return',
  '/transactions/orders',
  '/transactions/breakage',
  '/transactions/replacement',
  '/transactions/pricediff',
  '/transactions/claims',
  '/accounting/vouchers',
]

/**
 * Checks whether a given route or path corresponds to a transaction entry / edit document.
 */
export function isTransactionEntryPath(path: string): boolean {
  if (!path) return false
  const cleanPath = path.split('?')[0].split('#')[0]

  // Direct matches or prefix matches for transaction entry routes
  for (const prefix of TRANSACTION_ENTRY_PREFIXES) {
    if (cleanPath === prefix || cleanPath.startsWith(prefix)) {
      return true
    }
  }

  // Handle parameterized routes like /transactions/sale/:id or /transactions/purchase/:id (excluding registers)
  if (cleanPath.startsWith('/transactions/sale/') && cleanPath !== '/transactions/sale') {
    return true
  }
  if (cleanPath.startsWith('/transactions/purchase/') && cleanPath !== '/transactions/purchase') {
    return true
  }

  return false
}

export interface OpenWindowOptions {
  target?: string
  features?: string
}

/**
 * Opens a transaction route or URL in a new window/tab.
 * Preserves authentication and application state across browser windows.
 */
export function openTransactionWindow(
  pathOrUrl: string,
  options?: OpenWindowOptions
): Window | null {
  if (typeof window === 'undefined') return null

  const target = options?.target || '_blank'
  let url = pathOrUrl

  if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
    const origin = window.location.origin
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
    url = `${origin}${cleanPath}`
  }

  const newWindow = window.open(url, target, options?.features)
  if (newWindow) {
    try {
      newWindow.focus()
    } catch {}
  }
  return newWindow
}

/**
 * Returns link props for HTML anchors or React Router links that should open in a new window.
 */
export function getTransactionLinkProps(path: string): { target?: string; rel?: string } {
  if (isTransactionEntryPath(path)) {
    return {
      target: '_blank',
      rel: 'noopener noreferrer',
    }
  }
  return {}
}
