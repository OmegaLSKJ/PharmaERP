import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isTransactionEntryPath,
  openTransactionWindow,
  getTransactionLinkProps,
} from '../src/lib/windowUtils'

describe('windowUtils', () => {
  describe('isTransactionEntryPath', () => {
    it('identifies new sale invoices and edit paths', () => {
      expect(isTransactionEntryPath('/transactions/sale/new')).toBe(true)
      expect(isTransactionEntryPath('/transactions/sale/edit/INV-2026-001')).toBe(true)
      expect(isTransactionEntryPath('/transactions/sale/INV-2026-001')).toBe(true)
    })

    it('identifies delivery challan and counter sale', () => {
      expect(isTransactionEntryPath('/transactions/sale/challan')).toBe(true)
      expect(isTransactionEntryPath('/transactions/sale/counter')).toBe(true)
      expect(isTransactionEntryPath('/transactions/sale-return')).toBe(true)
    })

    it('identifies new purchases and edit paths', () => {
      expect(isTransactionEntryPath('/transactions/purchase/new')).toBe(true)
      expect(isTransactionEntryPath('/transactions/purchase/edit/PB-1002')).toBe(true)
      expect(isTransactionEntryPath('/transactions/purchase/PB-1002')).toBe(true)
      expect(isTransactionEntryPath('/transactions/purchase-return')).toBe(true)
    })

    it('identifies other transactions: orders, vouchers, breakage, replacements', () => {
      expect(isTransactionEntryPath('/transactions/orders')).toBe(true)
      expect(isTransactionEntryPath('/transactions/breakage')).toBe(true)
      expect(isTransactionEntryPath('/transactions/replacement')).toBe(true)
      expect(isTransactionEntryPath('/transactions/pricediff')).toBe(true)
      expect(isTransactionEntryPath('/transactions/claims')).toBe(true)
      expect(isTransactionEntryPath('/accounting/vouchers')).toBe(true)
      expect(isTransactionEntryPath('/accounting/vouchers?vNo=VCH-1&type=Payment')).toBe(true)
    })

    it('does NOT match non-entry registers or master pages', () => {
      expect(isTransactionEntryPath('/transactions/sale')).toBe(false)
      expect(isTransactionEntryPath('/transactions/purchase')).toBe(false)
      expect(isTransactionEntryPath('/accounting/daybook')).toBe(false)
      expect(isTransactionEntryPath('/accounting/ledger')).toBe(false)
      expect(isTransactionEntryPath('/masters/items')).toBe(false)
      expect(isTransactionEntryPath('/masters/parties')).toBe(false)
      expect(isTransactionEntryPath('/')).toBe(false)
    })
  })

  describe('getTransactionLinkProps', () => {
    it('returns target="_blank" and rel for transaction paths', () => {
      expect(getTransactionLinkProps('/transactions/sale/new')).toEqual({
        target: '_blank',
        rel: 'noopener noreferrer',
      })
      expect(getTransactionLinkProps('/transactions/sale')).toEqual({})
    })
  })

  describe('openTransactionWindow', () => {
    it('returns null when window is undefined', () => {
      expect(openTransactionWindow('/transactions/sale/new')).toBeNull()
    })

    it('opens window with full origin url in browser environment', () => {
      const focusSpy = vi.fn()
      const openSpy = vi.fn().mockReturnValue({ focus: focusSpy })
      ;(globalThis as any).window = {
        location: { origin: 'http://localhost:3000' },
        open: openSpy,
      }

      openTransactionWindow('/transactions/sale/new')
      expect(openSpy).toHaveBeenCalledWith(
        'http://localhost:3000/transactions/sale/new',
        '_blank',
        undefined
      )
      expect(focusSpy).toHaveBeenCalled()

      delete (globalThis as any).window
    })
  })
})
