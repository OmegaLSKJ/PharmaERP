import { describe, expect, it } from 'vitest'
import { canAccess } from '../apps/web/lib/permissions'

describe('Chart of accounts zero-value transactions handling', () => {
  it('permits operators, managers, and admins to access ledgers and purge-zero-transactions', () => {
    expect(canAccess('admin', 'POST', 'purge-zero-transactions')).toBe(true)
    expect(canAccess('manager', 'POST', 'purge-zero-transactions')).toBe(true)
    expect(canAccess('operator', 'POST', 'purge-zero-transactions')).toBe(true)
    expect(canAccess('manager', 'GET', 'ledgers')).toBe(true)
    expect(canAccess('operator', 'GET', 'ledgers')).toBe(true)
  })

  it('filters out transactions with no monetary value (debit <= 0 and credit <= 0)', () => {
    const rawTransactions = [
      { id: 't1', party: 'Party A', debit: 500, credit: 0, vNo: 'SI-1' },
      { id: 't2', party: 'Party A', debit: 0, credit: 0, vNo: 'CH-1' },
      { id: 't3', party: 'Party B', debit: 0, credit: 1200, vNo: 'PB-1' },
      { id: 't4', party: 'Party B', debit: 0, credit: 0, vNo: 'VCH-0' },
      { id: 't5', party: 'Party C', debit: -10, credit: 0, vNo: 'INV-NEG' },
    ]

    const validRows = rawTransactions.filter((r) => {
      const dr = Number(r.debit || 0)
      const cr = Number(r.credit || 0)
      if (dr <= 0 && cr <= 0) return false
      if (isNaN(dr) && isNaN(cr)) return false
      return true
    })

    expect(validRows).toHaveLength(2)
    expect(validRows.map((t) => t.id)).toEqual(['t1', 't3'])
  })
})
