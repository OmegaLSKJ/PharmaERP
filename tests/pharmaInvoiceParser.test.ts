import { describe, it, expect } from 'vitest'
import {
  cleanText,
  extractGstin,
  extractInvoiceNo,
  extractInvoiceDate,
  extractSupplierName,
  parsePharmaInvoice
} from '../src/lib/ocr/pharmaInvoiceParser'

describe('pharmaInvoiceParser', () => {
  it('extracts Indian GSTIN correctly', () => {
    const text = 'TAX INVOICE\nAPOLLO PHARMACY DISTRIBUTORS\nGSTIN: 27AABCU9603R1ZM\nDate: 15/09/2026'
    expect(extractGstin(text)).toBe('27AABCU9603R1ZM')
  })

  it('extracts Invoice Number from various formats', () => {
    expect(extractInvoiceNo('INVOICE NO: INV-2026/9021\nDate: 12/08/2026')).toBe('INV-2026/9021')
    expect(extractInvoiceNo('Bill No: BL-4401\nGSTIN: 07AAAAA0000A1Z5')).toBe('BL-4401')
  })

  it('extracts and standardizes Invoice Date', () => {
    expect(extractInvoiceDate('Inv Date: 25/08/2026')).toBe('2026-08-25')
    expect(extractInvoiceDate('Date: 05-11-2026')).toBe('2026-11-05')
  })

  it('extracts supplier business name', () => {
    const lines = [
      'ORIGINAL FOR RECIPIENT',
      'SUN PHARMA DISTRIBUTORS PVT LTD',
      'Plot 45, MIDC Industrial Area, Mumbai',
      'GSTIN: 27AABCU9603R1ZM'
    ]
    expect(extractSupplierName(lines)).toBe('SUN PHARMA DISTRIBUTORS PVT LTD')
  })

  it('parses multi-item pharma invoice text into structured line items', () => {
    const sampleInvoice = `
    TAX INVOICE
    MANKIND PHARMACEUTICALS LTD
    GSTIN: 07AABCM2314E1Z8
    Invoice No: MK/2026/8841
    Date: 14/09/2026

    ITEM DESCRIPTION | HSN | BATCH | EXP | QTY | FREE | RATE | MRP | GST% | AMOUNT
    MOXIKIND CV 625 TAB | 30049099 | B.NO: MK8912 | EXP: 08/27 | 20 | 2 | 145.50 | 220.00 | 12% | 2910.00
    TELMIKIND 40MG TAB | 30049099 | B.NO: TM4401 | EXP: 11/26 | 50 | 5 | 42.00 | 75.00 | 12% | 2100.00
    PAN 40MG TAB 15S | 30049099 | B.NO: PN7710 | EXP: 04/28 | 30 | 0 | 88.00 | 140.00 | 12% | 2640.00

    GRAND TOTAL: 7650.00
    `

    const parsed = parsePharmaInvoice(sampleInvoice, 'digital_pdf')

    expect(parsed.supplierName).toContain('MANKIND PHARMACEUTICALS LTD')
    expect(parsed.supplierGstin).toBe('07AABCM2314E1Z8')
    expect(parsed.invoiceNo).toBe('MK/2026/8841')
    expect(parsed.invoiceDate).toBe('2026-09-14')
    expect(parsed.items.length).toBeGreaterThanOrEqual(3)

    const firstItem = parsed.items[0]
    expect(firstItem.itemName).toContain('MOXIKIND CV 625')
    expect(firstItem.batch).toBe('MK8912')
    expect(firstItem.expiry).toBe('08/27')
    expect(firstItem.hsn).toBe('30049099')
    expect(firstItem.purchaseRate).toBe(145.5)
    expect(firstItem.mrp).toBe(220)
    expect(firstItem.gstRate).toBe(12)
  })

  it('parses Marg ERP columnar bills with batch and free schemes', () => {
    const margBill = `
    INVOICE / BILL OF SUPPLY
    CIPLA HEALTHCARE DISTRIBUTORS
    GSTIN: 27AAACC4175D1ZG
    Bill No: CI-9921
    Date: 28/09/2026

    SNo  Product Description    Pack    HSN       Batch   Exp    Qty   Rate    MRP    GST%  Net Amount
    1    CIPLOX 500MG TAB       10x10   30049099  CP109   12/28  15    38.40   55.00  12%   576.00
    2    ASTHALIN RESPULES 2ML  20x2ml  30049099  AS882   05/27  10    112.00  160.00 12%   1120.00

    Total: 1696.00
    `

    const parsed = parsePharmaInvoice(margBill, 'digital_pdf')
    expect(parsed.supplierName).toContain('CIPLA HEALTHCARE DISTRIBUTORS')
    expect(parsed.invoiceNo).toBe('CI-9921')
    expect(parsed.items.length).toBe(2)
    expect(parsed.items[0].itemName).toContain('CIPLOX 500MG')
    expect(parsed.items[0].batch).toBe('CP109')
    expect(parsed.items[0].purchaseRate).toBe(38.4)
    expect(parsed.items[0].mrp).toBe(55)
    expect(parsed.items[1].itemName).toContain('ASTHALIN RESPULES')
    expect(parsed.items[1].batch).toBe('AS882')
  })
})
