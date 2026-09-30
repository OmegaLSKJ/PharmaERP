/**
 * Generates standalone, self-contained A4 HTML templates for OCR-ready transaction sheets.
 * Engineered with precision CSS to guarantee 100% fit on a single A4 sheet (210mm x 297mm)
 * with generous, elegant padding from all sides and crisp OCR alignment.
 */

export interface TemplateCompanyInfo {
  name: string
  sub: string
  address: string
  gstin: string
  dlNo: string
  phone: string
}

export interface SheetMetadata {
  partyName?: string
  partyGstin?: string
  repName?: string
  date?: string
  sheetNo?: string
  rowCount?: number
  copies?: number
}

const DEFAULT_COMPANY: TemplateCompanyInfo = {
  name: 'BORGANG DRUG DISTRIBUTORS',
  sub: 'WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS',
  address: 'Borgang, Biswanath, Assam - 784167',
  gstin: '18AKWPP4417G1ZN',
  dlNo: 'DNG/622/623',
  phone: '+91 6000763703'
}

function getBaseCss(rowCount: number = 25): string {
  const rowHeight = rowCount <= 15 ? '38px' : rowCount <= 20 ? '30px' : '24px'
  return `
    @page {
      size: A4 portrait;
      margin: 5mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      -webkit-font-smoothing: antialiased;
      width: 100%;
    }
    .top-actions {
      width: 210mm;
      max-width: 100%;
      margin: 12px auto 16px auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f172a;
      color: #fff;
      padding: 10px 18px;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    .top-actions .btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 7px 14px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .top-actions .btn:hover {
      background: #1d4ed8;
    }
    .sheet {
      width: 210mm;
      max-width: 210mm;
      height: 287mm;
      min-height: 285mm;
      max-height: 287mm;
      padding: 3mm 5mm;
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      margin: 12px auto;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: always;
      break-after: page;
    }
    .sheet:last-of-type {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    @media print {
      html, body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      .top-actions {
        display: none !important;
      }
      .sheet {
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        max-height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: always !important;
        break-after: page !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .sheet:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      table.grid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      table.grid tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    .frame {
      border: 2px solid #000;
      padding: 3mm 4mm;
      flex: 1;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
    }
    .ocr-marker {
      position: absolute;
      font-family: monospace;
      font-size: 8px;
      font-weight: bold;
      color: #000;
      line-height: 1;
      z-index: 10;
    }
    .ocr-tl { top: 3px; left: 5px; }
    .ocr-tr { top: 3px; right: 5px; }
    .ocr-bl { bottom: 3px; left: 5px; }
    .ocr-br { bottom: 3px; right: 5px; }
    
    .header-box {
      border: 1.2px solid #000;
      margin-bottom: 3px;
    }
    .header-top {
      display: flex;
      border-bottom: 1.2px solid #000;
    }
    .branding {
      flex: 7;
      padding: 3px 8px;
      border-right: 1.2px solid #000;
    }
    .branding h1 {
      margin: 0 0 2px 0;
      font-size: 15px;
      font-weight: 900;
      color: #0c2f66;
      letter-spacing: -0.3px;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .branding .sub {
      font-size: 8.5px;
      font-weight: 700;
      color: #333;
      line-height: 1.25;
    }
    .branding .meta {
      font-size: 8.5px;
      color: #444;
      margin-top: 1.5px;
      line-height: 1.25;
    }
    .badge {
      flex: 5;
      padding: 3px 8px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: right;
    }
    .badge .title {
      font-size: 11.5px;
      font-weight: 900;
      text-transform: uppercase;
      color: #111;
      display: block;
      line-height: 1.15;
    }
    .badge .sub {
      font-size: 8px;
      color: #555;
      margin-top: 1.5px;
      line-height: 1.2;
    }
    .info-grid {
      display: flex;
      font-size: 9px;
    }
    .party-col {
      flex: 7;
      padding: 3px 8px;
      border-right: 1.2px solid #000;
    }
    .party-col .label {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #444;
      margin-bottom: 2px;
    }
    .party-col .line {
      font-size: 11px;
      font-weight: 700;
      min-height: 20px;
      border-bottom: 1px dotted #888;
    }
    .order-col {
      flex: 5;
      padding: 3px 8px;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .order-row span.lbl {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #444;
    }
    .order-row span.val {
      font-family: monospace;
      font-weight: 700;
      font-size: 9px;
    }
    .guide-banner {
      background: #f1f5f9;
      border: 1px solid #000;
      padding: 2.5px 8px;
      margin-bottom: 3px;
      font-size: 8px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      line-height: 1.2;
    }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      margin-bottom: 3px;
    }
    table.grid th {
      background: #e2e8f0;
      border: 1px solid #000;
      padding: 3px 2px;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.1;
      height: 19px;
    }
    table.grid td {
      border: 1px solid #000;
      padding: 2px 4px;
      height: ${rowHeight};
      min-height: ${rowHeight};
      max-height: ${rowHeight};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, monospace;
      font-size: 9px;
      line-height: 1.2;
    }
    table.grid tr.even {
      background: #fafafa;
    }
    .bottom-box {
      border: 1.2px solid #000;
      display: flex;
      font-size: 8.5px;
      margin-bottom: 3px;
    }
    .notes-col {
      flex: 7;
      padding: 3px 6px;
      border-right: 1.2px solid #000;
    }
    .totals-col {
      flex: 5;
      padding: 3px 6px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .signatures {
      border: 1.2px solid #000;
      display: flex;
      text-align: center;
      font-size: 8px;
    }
    .sig-box {
      flex: 1;
      padding: 3px 6px;
      border-right: 1px solid #000;
    }
    .sig-box:last-child {
      border-right: none;
    }
    .sig-space {
      height: 24px;
    }
    .sig-line {
      border-top: 1px dotted #444;
      padding-top: 2px;
      font-weight: 800;
      text-transform: uppercase;
    }
  `
}

export function generateSalesSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY, meta?: SheetMetadata): string {
  const rowCount = meta?.rowCount || 25
  const copies = Math.max(1, meta?.copies || 1)
  const rowH = rowCount <= 15 ? '38px' : rowCount <= 20 ? '30px' : '24px'
  let rows = ''
  for (let i = 1; i <= rowCount; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven} style="height:${rowH};"><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  const singleSheet = `
  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div>
        <div class="header-box">
          <div class="header-top">
            <div class="branding">
              <h1>${c.name}</h1>
              <div class="sub">${c.sub}</div>
              <div class="meta">${c.address} | Ph: ${c.phone}</div>
              <div class="meta" style="font-weight: 700; color: #000;">
                GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
              </div>
            </div>
            <div class="badge">
              <div>
                <span style="font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
                <span class="title">SALES ORDER SHEET</span>
                <span class="sub">FIELD REP BOOKING & VOUCHER ENTRY</span>
              </div>
              <div style="font-family: monospace; font-size: 7px; color: #64748b;">
                REF: OCR-SALE-A4/2026
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="party-col">
              <div class="label">Customer / Chemist Shop Name *</div>
              ${meta?.partyName ? `<div style="font-weight: 800; font-size: 11px; min-height: 18px; color: #000; padding-top: 2px;">${meta.partyName}</div>` : '<div class="line"></div>'}
              <div style="display: flex; gap: 15px; margin-top: 3px; font-size: 7.5px;">
                <div><strong>GSTIN:</strong> ${meta?.partyGstin || '________________________'}</div>
                <div><strong>D.L. No:</strong> ____________________</div>
              </div>
            </div>
            <div class="order-col">
              <div class="order-row">
                <span class="lbl">ORDER / SLIP NO:</span>
                <span class="val">${meta?.sheetNo || 'SO-2026/______'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">DATE:</span>
                <span class="val">${meta?.date || '____/____/2026'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">SALES REP / BOOKED BY:</span>
                <span class="val">${meta?.repName || '__________________'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-banner">
          <span>✍️ <strong>OCR Instructions:</strong> Write medicine names, batch, expiry (MM/YY), and quantities in BLOCK CAPITALS.</span>
          <span>PAGE 1 OF 1</span>
        </div>

        <table class="grid">
          <thead>
            <tr>
              <th style="width: 22px;">S.No</th>
              <th style="text-align: left; padding-left: 8px;">Medicine / Product Description</th>
              <th style="width: 40px;">Pack</th>
              <th style="width: 44px;">HSN</th>
              <th style="width: 50px;">Batch No</th>
              <th style="width: 42px;">Exp</th>
              <th style="width: 28px;">Qty</th>
              <th style="width: 26px;">Free</th>
              <th style="width: 46px;">Rate (₹)</th>
              <th style="width: 46px;">MRP (₹)</th>
              <th style="width: 28px;">GST%</th>
              <th style="width: 58px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div>
        <div class="bottom-box">
          <div class="notes-col">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 7.5px; color: #444; margin-bottom: 2px;">
              Order Remarks & Terms:
            </div>
            <div style="min-height: 20px; line-height: 1.3; color: #444;">
              Goods once booked cannot be cancelled. Standard distributor credit policy applies.
            </div>
          </div>
          <div class="totals-col">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 800;">ESTIMATED SUB TOTAL:</span>
              <span style="font-family: monospace; font-weight: 700;">₹ ________________</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 2px;">
              <span style="font-weight: 900; font-size: 9px;">ESTIMATED TOTAL (WITH GST):</span>
              <span style="font-family: monospace; font-weight: 900; font-size: 10px;">₹ ________________</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">BOOKED BY (SALES REP)</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">ORDER VERIFIED BY</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">CHEMIST SIGNATURE & STAMP</div>
          </div>
        </div>
      </div>
    </div>
  </div>`

  let allSheets = ''
  for (let cIdx = 0; cIdx < copies; cIdx++) {
    allSheets += singleSheet
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales Order Sheet - OCR Template</title>
  <style>${getBaseCss(rowCount)}</style>
</head>
<body>
  ${allSheets}
</body>
</html>`
}

export function generatePurchaseSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY, meta?: SheetMetadata): string {
  const rowCount = meta?.rowCount || 25
  const copies = Math.max(1, meta?.copies || 1)
  const rowH = rowCount <= 15 ? '38px' : rowCount <= 20 ? '30px' : '24px'
  let rows = ''
  for (let i = 1; i <= rowCount; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven} style="height:${rowH};"><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  const singleSheet = `
  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div>
        <div class="header-box">
          <div class="header-top">
            <div class="branding">
              <h1>${c.name}</h1>
              <div class="sub">${c.sub}</div>
              <div class="meta">${c.address} | Ph: ${c.phone}</div>
              <div class="meta" style="font-weight: 700; color: #000;">
                GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
              </div>
            </div>
            <div class="badge">
              <div>
                <span style="font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
                <span class="title">PURCHASE / GOODS INWARD ENTRY SHEET</span>
                <span class="sub">STANDARD PHARMA INWARD ORDER & STOCK RECEIPT FORM</span>
              </div>
              <div style="font-family: monospace; font-size: 7px; color: #64748b;">
                FORM REF: PHARMA-OCR-A4/2026
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="party-col">
              <div class="label">Supplier / Distributor Name *</div>
              ${meta?.partyName ? `<div style="font-weight: 800; font-size: 11px; min-height: 18px; color: #000; padding-top: 2px;">${meta.partyName}</div>` : '<div class="line"></div>'}
              <div style="display: flex; gap: 15px; margin-top: 3px; font-size: 7.5px;">
                <div><strong>PARTY GSTIN / DL:</strong> ${meta?.partyGstin || '________________________'}</div>
              </div>
            </div>
            <div class="order-col">
              <div class="order-row">
                <span class="lbl">INWARD / BILL NO:</span>
                <span class="val">${meta?.sheetNo || '___________________'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">DATE:</span>
                <span class="val">${meta?.date || '30/09/2026'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">RECEIVED BY / MANAGER:</span>
                <span class="val">${meta?.repName || '___________________'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-banner">
          <span>✍️ <strong>OCR Instructions:</strong> Write medicine name, batch, expiry (MM/YY), and quantity clearly in CAPITAL LETTERS. Avoid overlapping cells.</span>
          <span>PAGE 1 OF 1</span>
        </div>

        <table class="grid">
          <thead>
            <tr>
              <th style="width: 22px;">S.No</th>
              <th style="text-align: left; padding-left: 8px;">Medicine / Product Description</th>
              <th style="width: 40px;">Pack</th>
              <th style="width: 44px;">HSN</th>
              <th style="width: 50px;">Batch No</th>
              <th style="width: 42px;">Exp</th>
              <th style="width: 28px;">Qty</th>
              <th style="width: 26px;">Free</th>
              <th style="width: 46px;">Rate (₹)</th>
              <th style="width: 46px;">MRP (₹)</th>
              <th style="width: 28px;">GST%</th>
              <th style="width: 58px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div>
        <div class="bottom-box">
          <div class="notes-col">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 7.5px; color: #444; margin-bottom: 2px;">
              Notes / Special Instructions:
            </div>
            <div style="min-height: 18px; line-height: 1.3; color: #444; font-size: 6.8px;">
              [ ] Cold Chain (2°C - 8°C) &nbsp;&nbsp;&nbsp; [ ] Urgent Delivery (Same Day) &nbsp;&nbsp;&nbsp; [ ] Normal Dispatch
            </div>
          </div>
          <div class="totals-col">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
              <span style="font-weight: 700;">TOTAL BILLED ITEMS:</span>
              <span style="font-family: monospace; font-weight: 700;">______ Lines</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 1px;">
              <span style="font-weight: 900; font-size: 8.5px;">ESTIMATED TOTAL:</span>
              <span style="font-family: monospace; font-weight: 900; font-size: 9.5px;">₹ ________________</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">SALES REP / PREPARED BY</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">CHEMIST STAMP & SIGNATURE</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">AUTHORIZED SIGNATORY / WAREHOUSE</div>
          </div>
        </div>
      </div>
    </div>
  </div>`

  let allSheets = ''
  for (let cIdx = 0; cIdx < copies; cIdx++) {
    allSheets += singleSheet
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order Sheet - OCR Template</title>
  <style>${getBaseCss(rowCount)}</style>
</head>
<body>
  ${allSheets}
</body>
</html>`
}

export function generateChallanSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY, meta?: SheetMetadata): string {
  const rowCount = meta?.rowCount || 25
  const copies = Math.max(1, meta?.copies || 1)
  const rowH = rowCount <= 15 ? '38px' : rowCount <= 20 ? '30px' : '24px'
  let rows = ''
  for (let i = 1; i <= rowCount; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven} style="height:${rowH};"><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  const singleSheet = `
  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div>
        <div class="header-box">
          <div class="header-top">
            <div class="branding">
              <h1>${c.name}</h1>
              <div class="sub">${c.sub}</div>
              <div class="meta">${c.address} | Ph: ${c.phone}</div>
              <div class="meta" style="font-weight: 700; color: #000;">
                GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
              </div>
            </div>
            <div class="badge">
              <div>
                <span style="font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
                <span class="title">DELIVERY CHALLAN SHEET</span>
                <span class="sub">GOODS DISPATCH & RECEIVING SLIP</span>
              </div>
              <div style="font-family: monospace; font-size: 7px; color: #64748b;">
                REF: OCR-DC-A4/2026
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="party-col">
              <div class="label">Consignee / Destination Branch / Chemist Name *</div>
              ${meta?.partyName ? `<div style="font-weight: 800; font-size: 11px; min-height: 18px; color: #000; padding-top: 2px;">${meta.partyName}</div>` : '<div class="line"></div>'}
              <div style="display: flex; gap: 15px; margin-top: 3px; font-size: 7.5px;">
                <div><strong>Address:</strong> ________________________</div>
                <div><strong>Contact:</strong> ____________________</div>
              </div>
            </div>
            <div class="order-col">
              <div class="order-row">
                <span class="lbl">CHALLAN NO:</span>
                <span class="val">${meta?.sheetNo || 'DC-2026/______'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">DISPATCH DATE:</span>
                <span class="val">${meta?.date || '____/____/2026'}</span>
              </div>
              <div class="order-row">
                <span class="lbl">VEHICLE / TRANSPORTER:</span>
                <span class="val">${meta?.repName || '__________________'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-banner">
          <span>✍️ <strong>OCR Instructions:</strong> Write medicine descriptions, batch, expiry, and dispatched quantity clearly in CAPITAL LETTERS.</span>
          <span>PAGE 1 OF 1</span>
        </div>

        <table class="grid">
          <thead>
            <tr>
              <th style="width: 22px;">S.No</th>
              <th style="text-align: left; padding-left: 8px;">Medicine / Item Description</th>
              <th style="width: 40px;">Pack</th>
              <th style="width: 44px;">HSN</th>
              <th style="width: 50px;">Batch No</th>
              <th style="width: 42px;">Exp</th>
              <th style="width: 28px;">Qty</th>
              <th style="width: 26px;">Free</th>
              <th style="width: 46px;">Rate (₹)</th>
              <th style="width: 46px;">MRP (₹)</th>
              <th style="width: 36px;">Boxes</th>
              <th style="width: 58px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div>
        <div class="bottom-box">
          <div class="notes-col">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 7.5px; color: #444; margin-bottom: 2px;">
              Transport & Dispatch Notes:
            </div>
            <div style="min-height: 20px; line-height: 1.3; color: #444; font-size: 7px;">
              Total Cases / Corrugated Cartons: _______ Nos. Received goods in sound condition without damage or tampering.
            </div>
          </div>
          <div class="totals-col">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
              <span style="font-weight: 800;">TOTAL QUANTITY DISPATCHED:</span>
              <span style="font-family: monospace; font-weight: 700;">________________ Units</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 1px;">
              <span style="font-weight: 900; font-size: 8.5px;">ESTIMATED TOTAL VALUE:</span>
              <span style="font-family: monospace; font-weight: 900; font-size: 9.5px;">₹ ________________</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">DISPATCHED BY (GODOWN INCHARGE)</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">DRIVER / TRANSPORTER SIGNATURE</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">CONSIGNEE RECEIVER SIGN & STAMP</div>
          </div>
        </div>
      </div>
    </div>
  </div>`

  let allSheets = ''
  for (let cIdx = 0; cIdx < copies; cIdx++) {
    allSheets += singleSheet
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Delivery Challan Sheet - OCR Template</title>
  <style>${getBaseCss(rowCount)}</style>
</head>
<body>
  ${allSheets}
</body>
</html>`
}

export function generateVoucherSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let rows = ''
  for (let i = 1; i <= 25; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    const drCr = i === 1 ? 'Dr' : i === 2 ? 'Cr' : ''
    rows += `<tr${isEven}><td style="text-align:center;">${i}</td><td style="text-align:center;">${drCr}</td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accounting Voucher Sheet - OCR Template</title>
  <style>${getBaseCss(25)}</style>
</head>
<body>
  <div class="top-actions">
    <div>
      <strong style="font-size: 13px;">Standard A4 Accounting Voucher Sheet (OCR-Ready)</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">For Payment / Receipt / Journal & Cash Entries</span>
    </div>
    <button onclick="window.print()" class="btn">🖨️ Print / Save as PDF (A4)</button>
  </div>

  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div>
        <div class="header-box">
          <div class="header-top">
            <div class="branding">
              <h1>${c.name}</h1>
              <div class="sub">${c.sub}</div>
              <div class="meta">${c.address} | Ph: ${c.phone}</div>
              <div class="meta" style="font-weight: 700; color: #000;">
                GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
              </div>
            </div>
            <div class="badge">
              <div>
                <span style="font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
                <span class="title">ACCOUNTING VOUCHER</span>
                <span class="sub">PAYMENT / RECEIPT / JOURNAL</span>
              </div>
              <div style="font-family: monospace; font-size: 7px; color: #64748b;">
                REF: OCR-VOUCH-A4/2026
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="party-col">
              <div class="label">Voucher Type & Bank / Cash Account</div>
              <div style="display: flex; gap: 15px; margin-top: 3px; font-size: 8px; font-weight: 700;">
                <span>[ ] PAYMENT</span>
                <span>[ ] RECEIPT</span>
                <span>[ ] JOURNAL</span>
                <span>[ ] CONTRA</span>
              </div>
              <div style="margin-top: 4px; font-size: 8px;">
                <strong>Account Head:</strong> _____________________________________
              </div>
            </div>
            <div class="order-col">
              <div class="order-row">
                <span class="lbl">VOUCHER NO:</span>
                <span class="val">VR-2026/______</span>
              </div>
              <div class="order-row">
                <span class="lbl">VOUCHER DATE:</span>
                <span class="val">____/____/2026</span>
              </div>
              <div class="order-row">
                <span class="lbl">REF / CHQ / UTR NO:</span>
                <span class="val">__________________</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-banner">
          <span>✍️ <strong>OCR Instructions:</strong> Write ledger name, narration, bill reference, and debit/credit amounts in BLOCK LETTERS.</span>
          <span>PAGE 1 OF 1</span>
        </div>

        <table class="grid">
          <thead>
            <tr>
              <th style="width: 26px;">S.No</th>
              <th style="width: 32px;">Type</th>
              <th style="text-align: left; padding-left: 8px;">Particulars / Ledger Account Name</th>
              <th style="width: 80px;">Bill / Ref No</th>
              <th style="text-align: left; padding-left: 6px;">Narration / Remarks</th>
              <th style="width: 75px; text-align: right; padding-right: 6px;">Debit (₹)</th>
              <th style="width: 75px; text-align: right; padding-right: 6px;">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div>
        <div class="bottom-box">
          <div class="notes-col">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 7.5px; color: #444; margin-bottom: 2px;">
              Amount in Words:
            </div>
            <div style="min-height: 22px; line-height: 1.3; color: #333; font-style: italic;">
              Rupees __________________________________________________________________________________ only.
            </div>
          </div>
          <div class="totals-col">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 800;">TOTAL DEBIT (₹):</span>
              <span style="font-family: monospace; font-weight: 700;">________________</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 2px;">
              <span style="font-weight: 900; font-size: 9px;">TOTAL CREDIT (₹):</span>
              <span style="font-family: monospace; font-weight: 900; font-size: 10px;">________________</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">PREPARED BY (ACCOUNTANT)</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">VERIFIED & AUDITED BY</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">AUTHORISED SIGNATORY / MANAGER</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function generateSampleFilledSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let emptyRows = ''
  for (let i = 5; i <= 25; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    emptyRows += `<tr${isEven}><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Filled A4 Sales Order Sheet - OCR Test</title>
  <style>${getBaseCss(25)}</style>
</head>
<body>
  <div class="top-actions">
    <div>
      <strong style="font-size: 13px;">Sample Pre-Filled A4 Sales Order Sheet</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">Pre-populated with 4 medicines for instant OCR testing</span>
    </div>
    <button onclick="window.print()" class="btn">🖨️ Print / Save as PDF (A4)</button>
  </div>

  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div>
        <div class="header-box">
          <div class="header-top">
            <div class="branding">
              <h1>${c.name}</h1>
              <div class="sub">${c.sub}</div>
              <div class="meta">${c.address} | Ph: ${c.phone}</div>
              <div class="meta" style="font-weight: 700; color: #000;">
                GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
              </div>
            </div>
            <div class="badge">
              <div>
                <span style="font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
                <span class="title">SALES ORDER SHEET</span>
                <span class="sub">FIELD REP BOOKING & VOUCHER ENTRY</span>
              </div>
              <div style="font-family: monospace; font-size: 7px; color: #64748b;">
                REF: OCR-SALE-A4/2026
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="party-col">
              <div class="label">Customer / Chemist Shop Name *</div>
              <div class="line" style="color: #0c2f66; font-weight: 800; font-size: 12px;">APOLLO PHARMACY & SURGICALS</div>
              <div style="display: flex; gap: 15px; margin-top: 3px; font-size: 7.5px;">
                <div><strong>GSTIN:</strong> 18AABCA1234D1ZX</div>
                <div><strong>D.L. No:</strong> AS/BIS/2024/991</div>
              </div>
            </div>
            <div class="order-col">
              <div class="order-row">
                <span class="lbl">ORDER / SLIP NO:</span>
                <span class="val">SO-2026/8841</span>
              </div>
              <div class="order-row">
                <span class="lbl">DATE:</span>
                <span class="val">28/09/2026</span>
              </div>
              <div class="order-row">
                <span class="lbl">SALES REP / BOOKED BY:</span>
                <span class="val">RAHUL SHARMA (REP-04)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-banner">
          <span>✍️ <strong>OCR Instructions:</strong> Write medicine names, batch, expiry (MM/YY), and quantities in BLOCK CAPITALS.</span>
          <span>PAGE 1 OF 1</span>
        </div>

        <table class="grid">
          <thead>
            <tr>
              <th style="width: 22px;">S.No</th>
              <th style="text-align: left; padding-left: 8px;">Medicine / Product Description</th>
              <th style="width: 40px;">Pack</th>
              <th style="width: 44px;">HSN</th>
              <th style="width: 50px;">Batch No</th>
              <th style="width: 42px;">Exp</th>
              <th style="width: 28px;">Qty</th>
              <th style="width: 26px;">Free</th>
              <th style="width: 46px;">Rate (₹)</th>
              <th style="width: 46px;">MRP (₹)</th>
              <th style="width: 28px;">GST%</th>
              <th style="width: 58px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center;">1</td>
              <td style="font-weight: 700; color: #0c2f66;">PAN 40MG TAB</td>
              <td style="text-align:center;">15'S</td>
              <td style="text-align:center;"></td>
              <td style="text-align:center; font-weight:700;">BAT-8821</td>
              <td style="text-align:center;">09/27</td>
              <td style="text-align:center; font-weight: 800;">50</td>
              <td style="text-align:center;">5</td>
              <td style="text-align:right;">112.50</td>
              <td style="text-align:right;">155.00</td>
              <td style="text-align:center;"></td>
              <td style="text-align:right; font-weight:700;">5625.00</td>
            </tr>
            <tr class="even">
              <td style="text-align:center;">2</td>
              <td style="font-weight: 700; color: #0c2f66;">MOXIKIND CV 625 TAB</td>
              <td style="text-align:center;">10'S</td>
              <td style="text-align:center;"></td>
              <td style="text-align:center; font-weight:700;">MK-9042</td>
              <td style="text-align:center;">11/26</td>
              <td style="text-align:center; font-weight: 800;">30</td>
              <td style="text-align:center;">-</td>
              <td style="text-align:right;">168.00</td>
              <td style="text-align:right;">220.00</td>
              <td style="text-align:center;"></td>
              <td style="text-align:right; font-weight:700;">5040.00</td>
            </tr>
            <tr>
              <td style="text-align:center;">3</td>
              <td style="font-weight: 700; color: #0c2f66;">TELMA 40MG TAB</td>
              <td style="text-align:center;">15'S</td>
              <td style="text-align:center;"></td>
              <td style="text-align:center; font-weight:700;">TL-4410</td>
              <td style="text-align:center;">04/28</td>
              <td style="text-align:center; font-weight: 800;">40</td>
              <td style="text-align:center;">4</td>
              <td style="text-align:right;">98.00</td>
              <td style="text-align:right;">135.00</td>
              <td style="text-align:center;"></td>
              <td style="text-align:right; font-weight:700;">3920.00</td>
            </tr>
            <tr class="even">
              <td style="text-align:center;">4</td>
              <td style="font-weight: 700; color: #0c2f66;">AUGMENTIN 625 DUO TAB</td>
              <td style="text-align:center;">10'S</td>
              <td style="text-align:center;"></td>
              <td style="text-align:center; font-weight:700;">AG-1190</td>
              <td style="text-align:center;">08/27</td>
              <td style="text-align:center; font-weight: 800;">25</td>
              <td style="text-align:center;">-</td>
              <td style="text-align:right;">185.00</td>
              <td style="text-align:right;">240.00</td>
              <td style="text-align:center;"></td>
              <td style="text-align:right; font-weight:700;">4625.00</td>
            </tr>
            ${emptyRows}
          </tbody>
        </table>
      </div>

      <div>
        <div class="bottom-box">
          <div class="notes-col">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 7.5px; color: #444; margin-bottom: 2px;">
              Order Remarks & Terms:
            </div>
            <div style="min-height: 22px; line-height: 1.3; color: #333;">
              Sample test booking with 4 standard SKUs. 45 days credit terms agreed. Supply via route van #2.
            </div>
          </div>
          <div class="totals-col">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 800;">ESTIMATED SUB TOTAL:</span>
              <span style="font-family: monospace; font-weight: 700;">₹ 19,210.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 2px;">
              <span style="font-weight: 900; font-size: 9px;">ESTIMATED TOTAL (WITH GST):</span>
              <span style="font-family: monospace; font-weight: 900; font-size: 10px;">₹ 21,515.20</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">BOOKED BY (RAHUL SHARMA)</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">ORDER VERIFIED BY</div>
          </div>
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">CHEMIST SIGNATURE & STAMP</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function getTemplateHtmlById(templateId: string, company?: TemplateCompanyInfo, meta?: SheetMetadata): string {
  switch (templateId) {
    case 'purchase':
      return generatePurchaseSheetHtml(company, meta)
    case 'challan':
      return generateChallanSheetHtml(company, meta)
    case 'voucher':
      return generateVoucherSheetHtml(company)
    case 'sample':
      return generateSampleFilledSheetHtml(company)
    case 'sale':
    default:
      return generateSalesSheetHtml(company, meta)
  }
}
