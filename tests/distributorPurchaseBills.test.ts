import { describe, it, expect } from 'vitest'
import { parsePharmaInvoice } from '../src/lib/ocr/pharmaInvoiceParser'
import { matchMedicineToMaster, mapExtractedItemsToMaster } from '../src/lib/ocr/medicineMapper'
import { PHARMA_MASTER_CATALOG, KNOWN_DISTRIBUTORS } from '../src/lib/ocr/pharmaMasterCatalog'

describe('Assam Distributors Real Purchase Bills OCR & Mapping Training', () => {

  it('correctly identifies all 5 distributor profiles and buyer separation', () => {
    expect(KNOWN_DISTRIBUTORS.length).toBe(5)
    expect(KNOWN_DISTRIBUTORS.map(d => d.name)).toEqual([
      'REBA PHARMACEUTICALS',
      'TIRUPATI PHARMACEUTICALS',
      'AMAR DRUG DISTRIBUTORS',
      'MEDICO AGENCY',
      'DRUGS LINE AGENCY'
    ])
  })

  // -------------------------------------------------------------
  // BILL 1: REBA PHARMACEUTICALS
  // -------------------------------------------------------------
  it('parses and maps Reba Pharmaceuticals invoice ST017159', () => {
    const rawRebaBill = `
    TAX INVOICE
    REBA PHARMACEUTICALS
    C.K.DAS ROAD,NEAR ICICI BANK,
    TEZPUR-784001 EMAIL : gbjoy2016@gmail.com
    PHONE NO. : 03712355481,MOB-9854727929
    GSTIN : 18ANFPG7725A1ZA
    STATE : ASSAM CODE : 18
    DL NO. : D/OL/STR/5608 D/OL/STR/5609
    CREDIT
    M/S BORGANG DRUG DISTRIBUTORS
    at house BORGANG biswanath
    GSTIN : 18AFMPP9224L1ZQ
    Inv. No. : ST017159
    Date : 14/09/2026

    HSN | Product Name | Comp | Pack | Qty. | Free | Batch No. | Exp. | O.MRP | N.MRP | Rate | Dis.% | GST | Amount
    300490 D.F.O GEL 30GM OZONE LT 30GM 18 2 G2F012082 04/28 148.20 148.20 112.93 5.00 5% 2032.74
    300490 CARMINOZYME LIQ JUPITER 250ML 11 1 CMZ1722 03/29 159.38 159.38 121.44 5.00 5% 1335.84
    300290 BIFILAC CAP TABLET 10'S 10 0 ALA25N03 05/28 149.00 149.00 113.52 5.00 5% 1135.20
    300490 BURNOL CREAM DR. MORP 10GM 9 1 2604063 03/28 85.00 85.00 67.83 5.00 5% 610.47
    330720 LIVOSIN SYP 200 M ALLEN PH 200ML 14 0 A1504/0425 03/28 175.00 164.06 130.55 5.00 5% 1827.70
    330720 CYSTONE TAB HIMALAYA 60'S 10 0 106250595 04/28 260.00 243.75 185.72 5.00 5% 1857.20

    SUB TOTAL 8799.15
    LESS DISCOUNT 439.96
    GRAND TOTAL 8777.00
    `

    const parsed = parsePharmaInvoice(rawRebaBill, 'image_ocr')

    expect(parsed.supplierName).toBe('REBA PHARMACEUTICALS')
    expect(parsed.supplierGstin).toBe('18ANFPG7725A1ZA')
    expect(parsed.invoiceNo).toBe('ST017159')
    expect(parsed.invoiceDate).toBe('2026-09-14')
    expect(parsed.items.length).toBe(6)

    // Verify first item
    const dfo = parsed.items[0]
    expect(dfo.itemName).toContain('D.F.O GEL')
    expect(dfo.qty).toBe(18)
    expect(dfo.freeQty).toBe(2)
    expect(dfo.batch).toBe('G2F012082')
    expect(dfo.expiry).toBe('04/28')
    expect(dfo.purchaseRate).toBe(112.93)
    expect(dfo.mrp).toBe(148.20)

    // Verify item with numeric batch (Burnol: 2604063)
    const burnol = parsed.items[3]
    expect(burnol.itemName).toContain('BURNOL CREAM')
    expect(burnol.batch).toBe('2604063')
    expect(burnol.qty).toBe(9)
    expect(burnol.freeQty).toBe(1)

    // Map all items against master catalog
    const mapped = mapExtractedItemsToMaster(parsed.items, PHARMA_MASTER_CATALOG)
    mapped.forEach(item => {
      expect(['exact', 'high']).toContain(item.matchStatus)
      expect(item.mappedItemName).toBeDefined()
      expect(item.isConfirmed).toBe(true)
    })
  })

  // -------------------------------------------------------------
  // BILL 2: TIRUPATI PHARMACEUTICALS
  // -------------------------------------------------------------
  it('parses and maps Tirupati Pharmaceuticals invoice TP/L3990 with Qty+Fr scheme and month names', () => {
    const rawTirupatiBill = `
    GST INVOICE
    TIRUPATI PHARMACEUTICALS
    PHARMACEUTICAL DISTRIBUTOR
    N. C. ROAD , TEZPUR, SONITPUR, ASSAM
    GST NO-18AGRPD1963G1Z8
    PAN :AGRPD1963G
    BORGANG DRUG DISTRIBUTORS,BORGANG , Assam (18)
    DL:STR-4137/38 GSTIN : 18AFMPP9224L1ZQ
    DL:STR/4189/90
    CREDIT INVOICE TP/L3990 DATE 29/09/2026

    SL | QTY+FR | PACK | PRODUCT NAME | HSN | BATCH | EXPIRY | MFG | OLD MRP | NEW MRP | RATE | DIS% | GST% | TOTAL
    1 25+5 15ML DOLO DROP 300490 DDNXP058 May-28 NAXPAR 0.00 30.90 23.54 5 2.5+2.5 353.10
    2 25+5 15S DOLO-650 TAB 300490 DOBS4418 Feb-30 MICRO 0.00 32.12 24.47 5 2.5+2.5 611.75
    3 10 10s ZERODOL SP TAB 300490 FND0526009AS Nov-28 IPCA 0.00 139.69 106.42 5 2.5+2.5 1064.20
    4 20+2 60ML DOLO-120 SUSP 300490 DLSL443 Nov-28 STERLI 0.00 39.06 29.76 5 2.5+2.5 595.20
    5 50+10 60ml DOLO-250 SUSP 300490 DOLN177 Nov-28 NAXPAR 0.00 42.84 32.64 5 2.5+2.5 1632.00

    NET: 4246.00
    `

    const parsed = parsePharmaInvoice(rawTirupatiBill, 'image_ocr')

    expect(parsed.supplierName).toBe('TIRUPATI PHARMACEUTICALS')
    expect(parsed.supplierGstin).toBe('18AGRPD1963G1Z8')
    expect(parsed.invoiceNo).toBe('TP/L3990')
    expect(parsed.invoiceDate).toBe('2026-09-29')
    expect(parsed.items.length).toBe(5)

    // Item 1: DOLO DROP 25+5
    const item1 = parsed.items[0]
    expect(item1.itemName).toContain('DOLO DROP')
    expect(item1.qty).toBe(25)
    expect(item1.freeQty).toBe(5)
    expect(item1.batch).toBe('DDNXP058')
    expect(item1.expiry).toBe('05/28')
    expect(item1.gstRate).toBe(5) // 2.5 + 2.5 = 5%
    expect(item1.purchaseRate).toBe(23.54)
    expect(item1.mrp).toBe(30.90)

    // Item 2: DOLO-650 TAB 25+5
    const item2 = parsed.items[1]
    expect(item2.itemName).toContain('DOLO-650')
    expect(item2.qty).toBe(25)
    expect(item2.freeQty).toBe(5)
    expect(item2.expiry).toBe('02/30')

    // Item 5: DOLO-250 SUSP 50+10
    const item5 = parsed.items[4]
    expect(item5.itemName).toContain('DOLO-250 SUSP')
    expect(item5.qty).toBe(50)
    expect(item5.freeQty).toBe(10)

    // Test product mapping
    const mapped = mapExtractedItemsToMaster(parsed.items, PHARMA_MASTER_CATALOG)
    expect(mapped[0].mappedItemName).toBe('DOLO DROP')
    expect(mapped[1].mappedItemName).toBe('DOLO-650 TAB')
    expect(mapped[2].mappedItemName).toBe('ZERODOL SP TAB')
    expect(mapped[3].mappedItemName).toBe('DOLO-120 SUSP')
    expect(mapped[4].mappedItemName).toBe('DOLO-250 SUSP')
  })

  // -------------------------------------------------------------
  // BILL 3: AMAR DRUG DISTRIBUTORS
  // -------------------------------------------------------------
  it('parses and maps Amar Drug Distributors invoice A007578', () => {
    const rawAmarBill = `
    GST INVOICE
    AMAR DRUG DISTRIBUTORS
    N.C.ROAD, DL. MARKET, TEZPUR
    SONITPUR, ASSAM(STATE CODE-18)
    Phone : 9854010094,03712-314879
    D.L.No. : STR-4337/4338
    GSTIN : 18AFWPG3479G1ZV
    Buyer's Details:
    BORGANG DRUG DISTRIBUTORS(BORGANG)
    BORGANG
    GST : 18AFMPP9224L1ZQ
    Invoice No. : A007578
    Inv. Date : 16-09-2026

    Qty+D.Qty | Pack | Product Description | Mfr. | HSN | Batch | Exp. | M.R.P | RATE | Sch. | Disc | SGST | CGST | AMOUNT
    25 200ML ZINCOVIT SYP APEX 21069099 ZVSZ6081 11/27 160.17 122.03 0.00 5.00 2.50 2.50 3050.75
    10 30'S NICARDIA RTD20(30TAB) JBCPL 30049062 KKG26006 4/29 159.64 121.63 0.00 5.00 2.50 2.50 1216.30
    20 15CAP ECOSPRIN AV75/20 USV/CR 30049062 28025995 11/27 66.80 53.44 0.00 4.50 2.50 2.50 1068.80
    6 14TAB KEPPRA-500(14S) DRL/ZE 30049082 YA80010 2/28 194.01 147.82 0.00 5.00 2.50 2.50 886.92
    10+1 30S STAMLO 2.5MG 30TAB DRL/ZE 30049072 E2601146 4/29 57.64 43.92 0.00 5.00 2.50 2.50 439.20
    10+1 100ML RANTAC SYRUP JBCPL 30049033 XSRS26040 10/27 183.23 139.61 0.00 4.50 2.50 2.50 1396.10
    70 20 TAB METROGYL IP 400 JBCPL 30049022 TM826067 4/30 32.76 26.90 0.00 4.50 2.50 2.50 1883.00
    10 100ML METROGYL SYP JBCPL 30049022 PSM26014 4/29 55.43 45.52 0.00 4.50 2.50 2.50 455.20
    27+3 30GM DEROBIN OINT USV (C 30049099 D6234 5/28 130.78 99.64 0.00 5.00 2.50 2.50 2690.28
    20 15TAB TAZLOC-40(10*15) USV (M 30049089 48021547 5/28 97.25 74.10 0.00 5.00 2.50 2.50 1482.00

    GRAND TOTAL 17272.00
    `

    const parsed = parsePharmaInvoice(rawAmarBill, 'image_ocr')

    expect(parsed.supplierName).toBe('AMAR DRUG DISTRIBUTORS')
    expect(parsed.supplierGstin).toBe('18AFWPG3479G1ZV')
    expect(parsed.invoiceNo).toBe('A007578')
    expect(parsed.invoiceDate).toBe('2026-09-16')
    expect(parsed.items.length).toBe(10)

    // STAMLO with 10+1 scheme
    const stamlo = parsed.items[4]
    expect(stamlo.itemName).toContain('STAMLO 2.5MG')
    expect(stamlo.qty).toBe(10)
    expect(stamlo.freeQty).toBe(1)
    expect(stamlo.expiry).toBe('04/29')

    // DEROBIN with 27+3 scheme
    const derobin = parsed.items[8]
    expect(derobin.itemName).toContain('DEROBIN OINT')
    expect(derobin.qty).toBe(27)
    expect(derobin.freeQty).toBe(3)

    // Map items
    const mapped = mapExtractedItemsToMaster(parsed.items, PHARMA_MASTER_CATALOG)
    mapped.forEach(item => {
      expect(['exact', 'high']).toContain(item.matchStatus)
      expect(item.isConfirmed).toBe(true)
    })
  })

  // -------------------------------------------------------------
  // BILL 4: MEDICO AGENCY
  // -------------------------------------------------------------
  it('parses and maps Medico Agency invoice G1389', () => {
    const rawMedicoBill = `
    GST INVOICE
    MEDICO AGENCY
    C.K DAS ROAD TEZPUR,ASSAM
    GSTIN:18AULPG4107F1ZU
    DL.NO:STR-4935/4936
    BORGANG DRUG DISTRIBUTORS,BORGANG,Assam (18)
    DL:STR-4137/4138 GSTIN:18AFMPP9224L1ZQ
    CREDIT INVOICE G1389 DATE 15/09/2026

    SL | QTY+FR | PACK | PRODUCT NAME | HSN | MFG | BATCH | EXPIRY | OLD MRP | NEW MRP | RATE | DIS% | GST% | TOTAL
    1 25 10's PENTAB 40 TAB 3004 REE EV260080 Mar-28 0.00 168.09 38.50 0 2.5+2.5 962.50
    2 20 10'S PENTAB-DSR CAP 3004 ALEM EV6232003 Feb-28 0.00 145.21 38.50 0 2.5+2.5 770.00
    3 100 1ST PEKTIN TAB 3401 REXWEL T-26215 Jun-28 0.00 25.00 2.00 0 9+9 200.00
    4 12 75GM KETOKEM SOAP 3004 ALKEM NKS26007 Apr-29 0.00 160.00 44.80 0 2.5+2.5 537.60
    5 20 10'S SENGVITAL CAP 3004 ALKEM SENF007F Nov-27 0.00 134.05 19.78 0 2.5+2.5 395.60
    6 20 10'S RABALKEM DSR CAP 3004 ALKEM RBK25036S Jun-27 0.00 145.30 17.00 0 2.5+2.5 340.00
    7 10 10'S MICROPOD 200MG TAB 3004 micro RA6090 Apr-28 0.00 259.30 66.50 0 2.5+2.5 665.00
    8 6 1pcs BREAST PUMP 9018 lupin Jul-28 125.00 91.87 50.00 0 2.5+2.5 300.00
    9 1 1PCS L S BELT L (DYNA) 9021 DYNA 165028 Apr-31 1050.00 1050.00 546.00 0 2.5+2.5 546.00

    NET: 5022.00
    `

    const parsed = parsePharmaInvoice(rawMedicoBill, 'image_ocr')

    expect(parsed.supplierName).toBe('MEDICO AGENCY')
    expect(parsed.supplierGstin).toBe('18AULPG4107F1ZU')
    expect(parsed.invoiceNo).toBe('G1389')
    expect(parsed.invoiceDate).toBe('2026-09-15')
    expect(parsed.items.length).toBe(9)

    // Pektin Tab (18% GST: 9+9)
    const pektin = parsed.items[2]
    expect(pektin.itemName).toContain('PEKTIN TAB')
    expect(pektin.hsn).toBe('3401')
    expect(pektin.batch).toBe('T-26215')
    expect(pektin.gstRate).toBe(18)

    // L S Belt L (Dyna)
    const belt = parsed.items[8]
    expect(belt.itemName).toContain('L S BELT')
    expect(belt.hsn).toBe('9021')
    expect(belt.mrp).toBe(1050.00)

    // Map items
    const mapped = mapExtractedItemsToMaster(parsed.items, PHARMA_MASTER_CATALOG)
    mapped.forEach(item => {
      expect(['exact', 'high']).toContain(item.matchStatus)
      expect(item.isConfirmed).toBe(true)
    })
  })

  // -------------------------------------------------------------
  // BILL 5: DRUGS LINE AGENCY
  // -------------------------------------------------------------
  it('parses and maps Drugs Line Agency invoice 1CC031316', () => {
    const rawDrugsLineBill = `
    TAX INVOICE
    DRUGS LINE AGENCY
    C K DAS ROAD, OPP ICICI BANK
    TEZPUR-784001 Assam:18
    GSTIN : 18AHAPB9671M1ZZ
    D.L.No:STR-4163/64
    M/s BORGANG DRUG DISTRIBUTORS
    BORGANG BORGANG
    BORGANG-784167
    GSTIN:-18AFMPP9224L1ZQ
    CREDIT No: 1CC031316 Date : 14/09/2026

    Description | Mfg. | HSN | Unit | Batch | Exp | Qty | Old MRP | MRP | Rate | Total | Disc | Taxable | SGST | CGST
    RABLET D CAP. LUPI 300490 10 S UC01279* 09/27 11+1 0.00 312.00 237.71 2614.81 5.00 2484.07 2.5 2.5
    VERTIN 16 TAB ABBO 300490 15 S VEB26028 06/29 10 0.00 405.94 309.29 3092.90 5.00 2938.26 2.5 2.5
    S VOCTA 10TAB SHIN 300490 10TAB 63525T03 10/27 10 0.00 141.28 107.65 1076.50 5.00 1022.68 2.5 2.5
    CONCOR COR 1.25 MERC 300490 10s M22AK26009 02/28 10 0.00 79.53 60.60 606.00 5.00 575.70 2.5 2.5
    XONE XP 1.125GM ALKE 300420 1 VIAL 26460798 04/28 25+25 0.00 261.90 199.54 4988.50 5.00 4739.08 2.5 2.5
    T-HEAL CAP ALKE 210690 10 S 26490632 09/27 2 0.00 480.55 366.14 732.28 5.00 695.67 2.5 2.5
    PAN 40MG TAB ALKE 300490 15 S 26441164 09/28 20 0.00 192.80 146.90 2938.00 5.00 2791.10 2.5 2.5
    ZECAL GOLD TAB INDC 300450 1x30ca 26540155 01/28 3 0.00 445.31 339.29 1017.87 5.00 966.98 2.5 2.5
    GEMINOR M1 MACL 300490 15S 18261596A* 03/28 20 0.00 167.05 127.28 2545.60 5.00 2418.32 2.5 2.5
    GEMINOR M2 MACL 300490 15S 18261708A 03/28 20 0.00 231.81 176.62 3532.40 5.00 3355.78 2.5 2.5
    GEMINOR M4 FORTE MACL 300490 15S 18262336A* 04/29 10 0.00 262.97 200.37 2003.70 5.00 1903.52 2.5 2.5
    ZECAL ACTIVE INDC 300450 30S 26540494 04/28 1 0.00 536.00 408.38 408.38 5.00 387.96 2.5 2.5

    NET AMT 25493.00
    `

    const parsed = parsePharmaInvoice(rawDrugsLineBill, 'image_ocr')

    expect(parsed.supplierName).toBe('DRUGS LINE AGENCY')
    expect(parsed.supplierGstin).toBe('18AHAPB9671M1ZZ')
    expect(parsed.invoiceNo).toBe('1CC031316')
    expect(parsed.invoiceDate).toBe('2026-09-14')
    expect(parsed.items.length).toBe(12)

    // Rablet D with 11+1 scheme
    const rablet = parsed.items[0]
    expect(rablet.itemName).toContain('RABLET D')
    expect(rablet.qty).toBe(11)
    expect(rablet.freeQty).toBe(1)
    expect(rablet.batch).toBe('UC01279')

    // Xone XP with 25+25 scheme and numeric batch
    const xone = parsed.items[4]
    expect(xone.itemName).toContain('XONE XP')
    expect(xone.qty).toBe(25)
    expect(xone.freeQty).toBe(25)
    expect(xone.batch).toBe('26460798')

    // Map items
    const mapped = mapExtractedItemsToMaster(parsed.items, PHARMA_MASTER_CATALOG)
    mapped.forEach(item => {
      expect(['exact', 'high']).toContain(item.matchStatus)
      expect(item.isConfirmed).toBe(true)
    })
  })
})
