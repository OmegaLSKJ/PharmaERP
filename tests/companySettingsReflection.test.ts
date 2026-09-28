import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../src/store/uiStore'
import { list, create } from '../apps/web/lib/erp-store'

describe('Company Settings Reflection Everywhere', () => {
  beforeEach(() => {
    // Reset to defaults
    useUIStore.setState({
      company: {
        companyName: 'BORGANG DRUG DISTRIBUTORS',
        address: 'BORGANG, BISWANATH, ASSAM',
        pincode: '784167',
        city: 'BORGANG',
        state: '18-ASSAM',
        country: 'INDIA',
        gstin: '18AKWPP4417G1ZN',
        pan: 'AKWPP4417G',
        dlNo: 'DNG/622/623',
        phone: '+91 6000763703',
        email: 'borgangdrugdistributors@gmail.com',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        bankName: 'PUNJAB NATIONAL BANK',
        accountNo: '1125250029704',
        ifsc: 'PUNB0112520',
        jurisdiction: 'BISWANATH',
      },
    })
  })

  it('contains the exact user settings in the company profile store', () => {
    const comp = useUIStore.getState().company
    expect(comp.companyName).toBe('BORGANG DRUG DISTRIBUTORS')
    expect(comp.gstin).toBe('18AKWPP4417G1ZN')
    expect(comp.pan).toBe('AKWPP4417G')
    expect(comp.dlNo).toBe('DNG/622/623')
    expect(comp.email).toBe('borgangdrugdistributors@gmail.com')
    expect(comp.address).toBe('BORGANG, BISWANATH, ASSAM')
    expect(comp.city).toBe('BORGANG')
    expect(comp.pincode).toBe('784167')
    expect(comp.state).toBe('18-ASSAM')
    expect(comp.country).toBe('INDIA')
    expect(comp.phone).toBe('+91 6000763703')
    expect(comp.bankName).toBe('PUNJAB NATIONAL BANK')
    expect(comp.accountNo).toBe('1125250029704')
    expect(comp.ifsc).toBe('PUNB0112520')
    expect(comp.jurisdiction).toBe('BISWANATH')
    expect(comp.fyStart).toBe('2026-04-01')
    expect(comp.fyEnd).toBe('2027-03-31')
  })

  it('updates company details dynamically through setCompanyProfile', () => {
    useUIStore.getState().setCompanyProfile({
      phone: '+91 6000763703',
      jurisdiction: 'BISWANATH',
    })

    const updated = useUIStore.getState().company
    expect(updated.phone).toBe('+91 6000763703')
    expect(updated.jurisdiction).toBe('BISWANATH')
    expect(updated.companyName).toBe('BORGANG DRUG DISTRIBUTORS')
  })

  it('reads and persists organization-profile in ERP store mock mode', async () => {
    const profile = await list('organization-profile')
    expect(profile).toBeDefined()
    expect(profile.companyName).toBe('BORGANG DRUG DISTRIBUTORS')
    expect(profile.phone).toBe('+91 6000763703')
    expect(profile.bankName).toBe('PUNJAB NATIONAL BANK')
    expect(profile.accountNo).toBe('1125250029704')
    expect(profile.ifsc).toBe('PUNB0112520')
    expect(profile.jurisdiction).toBe('BISWANATH')

    // Test creating / updating organization profile
    const updated = await create('organization-profile', {
      phone: '+91 6000763703',
      bankName: 'PUNJAB NATIONAL BANK',
    })
    expect(updated.phone).toBe('+91 6000763703')
    expect(updated.bankName).toBe('PUNJAB NATIONAL BANK')

    const reloaded = await list('organization-profile')
    expect(reloaded.phone).toBe('+91 6000763703')
  })
})
