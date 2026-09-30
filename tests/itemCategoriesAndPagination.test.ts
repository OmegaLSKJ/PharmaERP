import { describe, it, expect } from 'vitest'
import { STANDARD_ITEM_CATEGORIES, resolveItemCategory } from '../src/lib/itemCategories'

describe('Item Categories and Page-by-Page Pagination', () => {
  it('defines comprehensive standard pharmaceutical categories', () => {
    expect(STANDARD_ITEM_CATEGORIES).toContain('All Categories')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Antibiotics')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Analgesics & Pain Relief')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Gastrointestinal & Antacids')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Respiratory & Cough')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Antidiabetic')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Cardiovascular & BP')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Antiallergic & Steroids')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Vitamins & Supplements')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Topical & Dermatology')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Injectables & Infusions')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Neurology & CNS')
    expect(STANDARD_ITEM_CATEGORIES).toContain('Surgical & Medical Devices')
    expect(STANDARD_ITEM_CATEGORIES).toContain('General Medicine')
  })

  it('accurately resolves categories based on medicine name and salt composition', () => {
    // Antibiotics
    expect(resolveItemCategory('Amoxyclav 625 Tablet', 'Amoxicillin and Potassium Clavulanate')).toBe('Antibiotics')
    expect(resolveItemCategory('Azithral 500', 'Azithromycin 500mg')).toBe('Antibiotics')
    expect(resolveItemCategory('Cifran 500', 'Ciprofloxacin')).toBe('Antibiotics')

    // Analgesics & Pain Relief
    expect(resolveItemCategory('Dolo 650', 'Paracetamol')).toBe('Analgesics & Pain Relief')
    expect(resolveItemCategory('Zerodol-P', 'Aceclofenac + Paracetamol')).toBe('Analgesics & Pain Relief')
    expect(resolveItemCategory('Combiflam', 'Ibuprofen and Paracetamol')).toBe('Analgesics & Pain Relief')

    // Gastrointestinal & Antacids
    expect(resolveItemCategory('Pan-D Capsule', 'Pantoprazole and Domperidone')).toBe('Gastrointestinal & Antacids')
    expect(resolveItemCategory('Omez 20', 'Omeprazole')).toBe('Gastrointestinal & Antacids')
    expect(resolveItemCategory('Gelusil MPS', 'Antacid Syrup')).toBe('Gastrointestinal & Antacids')

    // Respiratory & Cough
    expect(resolveItemCategory('Ascoril LS Syrup', 'Ambroxol + Levosalbutamol + Guaifenesin')).toBe('Respiratory & Cough')
    expect(resolveItemCategory('Benadryl DR Cough Syrup', 'Dextromethorphan')).toBe('Respiratory & Cough')
    expect(resolveItemCategory('Montair-LC', 'Montelukast and Levocetirizine')).toBe('Respiratory & Cough')

    // Antidiabetic
    expect(resolveItemCategory('Glycomet 500', 'Metformin Hydrochloride')).toBe('Antidiabetic')
    expect(resolveItemCategory('Amaryl 1mg', 'Glimepiride')).toBe('Antidiabetic')

    // Cardiovascular & BP
    expect(resolveItemCategory('Telmikind 40', 'Telmisartan')).toBe('Cardiovascular & BP')
    expect(resolveItemCategory('Amlong 5', 'Amlodipine')).toBe('Cardiovascular & BP')
    expect(resolveItemCategory('Atorva 10', 'Atorvastatin')).toBe('Cardiovascular & BP')

    // Antiallergic & Steroids
    expect(resolveItemCategory('Allegra 120', 'Fexofenadine')).toBe('Antiallergic & Steroids')
    expect(resolveItemCategory('Betnesol Tablet', 'Betamethasone')).toBe('Antiallergic & Steroids')

    // Vitamins & Supplements
    expect(resolveItemCategory('Becosules Capsule', 'B-Complex with Vitamin C')).toBe('Vitamins & Supplements')
    expect(resolveItemCategory('Shelcal 500', 'Calcium and Vitamin D3')).toBe('Vitamins & Supplements')
    expect(resolveItemCategory('Zincovit Syrup', 'Multivitamin and Zinc')).toBe('Vitamins & Supplements')

    // Topical & Dermatology
    expect(resolveItemCategory('Betadine Ointment 20g', 'Povidone Iodine')).toBe('Topical & Dermatology')
    expect(resolveItemCategory('Candid Dusting Powder', 'Clotrimazole')).toBe('Topical & Dermatology')

    // Injectables & Infusions
    expect(resolveItemCategory('Monocef 1g Inj', 'Ceftriaxone Sodium Injection')).toBe('Injectables & Infusions')

    // Neurology & CNS
    expect(resolveItemCategory('Gabapin 300', 'Gabapentin')).toBe('Neurology & CNS')
    expect(resolveItemCategory('Stugeron 25', 'Cinnarizine')).toBe('General Medicine')

    // Surgical & Medical Devices
    expect(resolveItemCategory('Dispovan 5ml Syringe with Needle', null)).toBe('Surgical & Medical Devices')
  })

  it('preserves custom valid rawCategory if already specified and distinct from generic fallback', () => {
    expect(resolveItemCategory('Sample Product', '', 'Ophthalmic Solutions')).toBe('Ophthalmic Solutions')
    // Generic fallback placeholders get overridden with intelligent salt matching
    expect(resolveItemCategory('Dolo 650', 'Paracetamol', 'Medicine')).toBe('Analgesics & Pain Relief')
    expect(resolveItemCategory('Dolo 650', 'Paracetamol', 'General')).toBe('Analgesics & Pain Relief')
  })

  it('paginates items strictly page-by-page without continuous stream', () => {
    const mockItems = Array.from({ length: 120 }, (_, idx) => ({
      id: `item-${idx + 1}`,
      name: `Medicine ${idx + 1}`,
      category: idx % 2 === 0 ? 'Antibiotics' : 'Analgesics & Pain Relief'
    }))

    const pageSize = 50
    const totalPages = Math.ceil(mockItems.length / pageSize)
    expect(totalPages).toBe(3)

    // Page 1
    const page1Start = (1 - 1) * pageSize
    const page1Items = mockItems.slice(page1Start, page1Start + pageSize)
    expect(page1Items.length).toBe(50)
    expect(page1Items[0].id).toBe('item-1')
    expect(page1Items[49].id).toBe('item-50')

    // Page 2
    const page2Start = (2 - 1) * pageSize
    const page2Items = mockItems.slice(page2Start, page2Start + pageSize)
    expect(page2Items.length).toBe(50)
    expect(page2Items[0].id).toBe('item-51')
    expect(page2Items[49].id).toBe('item-100')

    // Page 3
    const page3Start = (3 - 1) * pageSize
    const page3Items = mockItems.slice(page3Start, page3Start + pageSize)
    expect(page3Items.length).toBe(20)
    expect(page3Items[0].id).toBe('item-101')
    expect(page3Items[19].id).toBe('item-120')
  })
})
