import { describe, expect, it } from 'vitest'

type Party = {
  id: string
  name: string
  type?: 'customer' | 'supplier' | 'both'
  accountGroup?: string
}

function matchesPartySection(p: Party, typeFilter: 'all' | 'customer' | 'supplier'): boolean {
  const isCustomer =
    p?.type === 'customer' ||
    p?.type === 'both' ||
    !p?.type ||
    (p?.accountGroup || '').toLowerCase().includes('debtor') ||
    (p?.accountGroup || '').toLowerCase().includes('both')
  const isSupplier =
    p?.type === 'supplier' ||
    p?.type === 'both' ||
    !p?.type ||
    (p?.accountGroup || '').toLowerCase().includes('creditor') ||
    (p?.accountGroup || '').toLowerCase().includes('both')

  return (
    typeFilter === 'all' ||
    (typeFilter === 'customer' && isCustomer) ||
    (typeFilter === 'supplier' && isSupplier)
  )
}

describe('Party Dual Role (Customer and Supplier) visibility', () => {
  it('shows parties with type "both" in customers, suppliers, and all sections', () => {
    const dualParty: Party = {
      id: 'p-new',
      name: 'Apex Healthcare Pvt Ltd',
      type: 'both',
      accountGroup: 'BOTH'
    }

    expect(matchesPartySection(dualParty, 'all')).toBe(true)
    expect(matchesPartySection(dualParty, 'customer')).toBe(true)
    expect(matchesPartySection(dualParty, 'supplier')).toBe(true)
  })

  it('shows dual-role parties with specific account groups in both sections', () => {
    const debtorWithDualRole: Party = {
      id: 'p-debtor',
      name: 'City Medico',
      type: 'both',
      accountGroup: 'SUNDRY DEBTORS'
    }

    const creditorWithDualRole: Party = {
      id: 'p-creditor',
      name: 'Global Pharma Distributors',
      type: 'both',
      accountGroup: 'SUNDRY CREDITORS (SUPPLIERS)'
    }

    expect(matchesPartySection(debtorWithDualRole, 'customer')).toBe(true)
    expect(matchesPartySection(debtorWithDualRole, 'supplier')).toBe(true)

    expect(matchesPartySection(creditorWithDualRole, 'customer')).toBe(true)
    expect(matchesPartySection(creditorWithDualRole, 'supplier')).toBe(true)
  })

  it('correctly filters a list containing multiple parties so dual parties appear in both lists', () => {
    const parties: Party[] = [
      { id: 'p1', name: 'Apollo Pharmacy', type: 'both' },
      { id: 'p2', name: 'Cipla Logistics', type: 'both' },
      { id: 'p3', name: 'MedPlus Chemist', type: 'both' },
    ]

    const allParties = parties.filter((p) => matchesPartySection(p, 'all'))
    const customers = parties.filter((p) => matchesPartySection(p, 'customer'))
    const suppliers = parties.filter((p) => matchesPartySection(p, 'supplier'))

    expect(allParties).toHaveLength(3)
    expect(customers).toHaveLength(3)
    expect(suppliers).toHaveLength(3)
  })
})
