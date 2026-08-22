export type ErpRole = 'admin' | 'manager' | 'operator'
export type ErpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const masters = new Set(['parties', 'items', 'manufacturers', 'salts', 'hsn', 'warehouses', 'accounts', 'series', 'communication-blocks', 'item-mappings'])
const inventory = new Set(['stock', 'stock-movements', 'stock-transfers', 'breakages', 'reservations', 'inventory-adjustments'])
const accounting = new Set(['ledger', 'vouchers', 'day-book', 'trial-balance', 'accounting-periods', 'reconciliation'])
const compliance = new Set(['drug-licenses', 'product-recalls', 'controlled-drug-register'])
const transactions = new Set(['sales', 'purchases', 'cancellations', 'challans', 'sale-returns', 'purchase-returns', 'orders', 'replacements', 'counter-sales', 'pendings', 'price-differences'])

export function userRole(value: unknown): ErpRole {
  return value === 'admin' || value === 'manager' ? value : 'operator'
}

function actionFor(method: ErpMethod, resource: string) {
  if (resource === 'bulk-import') return 'imports.execute'
  if (resource === 'dashboard' || resource.startsWith('report-')) return 'reports.read'
  const suffix = method === 'GET' ? 'read' : method === 'DELETE' ? 'delete' : 'write'
  if (masters.has(resource)) return `masters.${suffix}`
  if (inventory.has(resource)) return method === 'GET' ? 'inventory.read' : 'inventory.adjust'
  if (accounting.has(resource)) return `accounting.${suffix}`
  if (compliance.has(resource)) return `compliance.${suffix}`
  if (transactions.has(resource)) return resource === 'cancellations' || method === 'DELETE' ? 'transactions.cancel' : `transactions.${suffix}`
  return 'unknown'
}

const manager = new Set([
  'masters.read','masters.write','transactions.read','transactions.write','transactions.cancel',
  'inventory.read','inventory.adjust','accounting.read','accounting.write','reports.read',
  'imports.execute','compliance.read','compliance.write',
])
const operator = new Set(['masters.read','transactions.read','transactions.write','inventory.read','accounting.read','reports.read','compliance.read'])

export function canAccess(role: ErpRole, method: ErpMethod, resource: string) {
  if (role === 'admin') return true
  const action = actionFor(method, resource)
  return (role === 'manager' ? manager : operator).has(action)
}
