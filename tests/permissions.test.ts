import { describe, expect, it } from 'vitest'
import { canAccess, userRole } from '../apps/web/lib/permissions'

describe('ERP permissions', () => {
  it('defaults unknown roles to operator', () => expect(userRole(undefined)).toBe('operator'))
  it('prevents operators from importing, adjusting and deleting', () => {
    expect(canAccess('operator','POST','bulk-import')).toBe(false)
    expect(canAccess('operator','POST','inventory-adjustments')).toBe(false)
    expect(canAccess('operator','DELETE','sales')).toBe(false)
  })
  it('allows managers operational control but not master deletion', () => {
    expect(canAccess('manager','POST','bulk-import')).toBe(true)
    expect(canAccess('manager','POST','inventory-adjustments')).toBe(true)
    expect(canAccess('manager','DELETE','parties')).toBe(false)
  })
})
