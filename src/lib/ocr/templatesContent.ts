/**
 * Generates standalone, self-contained A4 HTML templates for OCR-ready transaction sheets.
 * Used for instant in-browser previews via srcDoc, direct 1-click printing, and offline file downloads.
 */

export interface TemplateCompanyInfo {
  name: string
  sub: string
  address: string
  gstin: string
  dlNo: string
  phone: string
}

const DEFAULT_COMPANY: TemplateCompanyInfo = {
  name: 'BORGANG DRUG DISTRIBUTORS',
  sub: 'WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS',
  address: 'Borgang, Biswanath, Assam - 784167',
  gstin: '18AKWPP4417G1ZN',
  dlNo: 'DNG/622/623',
  phone: '+91 6000763703'
}

function getBaseCss(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .top-actions {
      width: 210mm;
      max-width: 100%;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
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
      min-height: 297mm;
      padding: 10mm 9mm;
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .top-actions {
        display: none !important;
      }
      .sheet {
        border: none;
        box-shadow: none;
        width: 100%;
        min-height: auto;
        padding: 0;
      }
    }
    .frame {
      border: 2px solid #000;
      padding: 8px;
      position: relative;
    }
    .ocr-marker {
      position: absolute;
      font-family: monospace;
      font-size: 8px;
      font-weight: bold;
      color: #000;
    }
    .ocr-tl { top: 2px; left: 2px; }
    .ocr-tr { top: 2px; right: 2px; }
    .ocr-bl { bottom: 2px; left: 2px; }
    .ocr-br { bottom: 2px; right: 2px; }
    
    .header-box {
      border: 1.5px solid #000;
      margin-bottom: 6px;
    }
    .header-top {
      display: flex;
      border-bottom: 1.5px solid #000;
    }
    .branding {
      flex: 7;
      padding: 8px;
      border-right: 1.5px solid #000;
    }
    .branding h1 {
      margin: 0 0 3px 0;
      font-size: 17px;
      font-weight: 900;
      color: #0c2f66;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .branding .sub {
      font-size: 9px;
      font-weight: 700;
      color: #333;
    }
    .branding .meta {
      font-size: 8.5px;
      color: #444;
      margin-top: 2px;
    }
    .badge {
      flex: 5;
      padding: 8px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: right;
    }
    .badge .title {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      color: #111;
      display: block;
    }
    .badge .sub {
      font-size: 8px;
      color: #555;
      margin-top: 1px;
    }
    .info-grid {
      display: flex;
      font-size: 9.5px;
    }
    .party-col {
      flex: 7;
      padding: 6px 8px;
      border-right: 1.5px solid #000;
    }
    .party-col .label {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #444;
      margin-bottom: 2px;
    }
    .party-col .line {
      font-size: 12px;
      font-weight: 700;
      min-height: 18px;
      border-bottom: 1px dotted #888;
    }
    .order-col {
      flex: 5;
      padding: 6px 8px;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
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
      font-size: 10px;
    }
    .guide-banner {
      background: #f1f5f9;
      border: 1px solid #000;
      padding: 4px 8px;
      margin-bottom: 6px;
      font-size: 8px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
    }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 6px;
    }
    table.grid th {
      background: #e2e8f0;
      border: 1px solid #000;
      padding: 4px 2px;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
    }
    table.grid td {
      border: 1px solid #000;
      padding: 2px 2px;
      height: 22px;
      font-family: monospace;
      font-size: 9px;
    }
    table.grid tr.even {
      background: #fafafa;
    }
    .bottom-box {
      border: 1.5px solid #000;
      display: flex;
      font-size: 8.5px;
      margin-bottom: 6px;
    }
    .notes-col {
      flex: 7;
      padding: 6px;
      border-right: 1.5px solid #000;
    }
    .totals-col {
      flex: 5;
      padding: 6px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .signatures {
      border: 1.5px solid #000;
      display: flex;
      text-align: center;
      font-size: 8px;
    }
    .sig-box {
      flex: 1;
      padding: 6px;
      border-right: 1px solid #000;
    }
    .sig-box:last-child {
      border-right: none;
    }
    .sig-space {
      height: 28px;
    }
    .sig-line {
      border-top: 1px dotted #444;
      padding-top: 3px;
      font-weight: 800;
      text-transform: uppercase;
    }
  `
}

export function generateSalesSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let rows = ''
  for (let i = 1; i <= 18; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven}><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales Order Sheet - OCR Template</title>
  <style>${getBaseCss()}</style>
</head>
<body>
  <div class="top-actions">
    <div>
      <strong style="font-size: 13px;">Standard A4 Sales Order Sheet (OCR-Ready)</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">For Field Sales Reps & Chemist Booking</span>
    </div>
    <button onclick="window.print()" class="btn">🖨️ Print / Save as PDF (A4)</button>
  </div>

  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div class="header-box">
        <div class="header-top">
          <div class="branding">
            <h1>${c.name}</h1>
            <div class="sub">${c.sub}</div>
            <div class="meta">${c.address} | Ph: ${c.phone}</div>
            <div class="meta" style="font-weight: 700; color: #000; margin-top: 3px;">
              GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
            </div>
          </div>
          <div class="badge">
            <div>
              <span style="font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
              <span class="title">SALES ORDER SHEET</span>
              <span class="sub">FIELD REP ORDER BOOKING & VOUCHER ENTRY FORM</span>
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b;">
              REF: OCR-SALE-A4/2026
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="party-col">
            <div class="label">Customer / Chemist Shop Name *</div>
            <div class="line"></div>
            <div style="display: flex; gap: 15px; margin-top: 5px; font-size: 8.5px;">
              <div><strong>GSTIN:</strong> ________________________</div>
              <div><strong>D.L. No:</strong> ____________________</div>
            </div>
          </div>
          <div class="order-col">
            <div class="order-row">
              <span class="lbl">ORDER / SLIP NO:</span>
              <span class="val">SO-2026/______</span>
            </div>
            <div class="order-row">
              <span class="lbl">DATE:</span>
              <span class="val">____/____/2026</span>
            </div>
            <div class="order-row">
              <span class="lbl">SALES REP / BOOKED BY:</span>
              <span class="val">__________________</span>
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
            <th style="width: 24px;">S.No</th>
            <th style="text-align: left; padding-left: 6px;">Medicine / Product Description</th>
            <th style="width: 44px;">Pack</th>
            <th style="width: 48px;">HSN</th>
            <th style="width: 58px;">Batch No</th>
            <th style="width: 46px;">Exp (MM/YY)</th>
            <th style="width: 38px;">Order Qty</th>
            <th style="width: 34px;">Free</th>
            <th style="width: 48px;">Rate (₹)</th>
            <th style="width: 48px;">MRP (₹)</th>
            <th style="width: 36px;">GST%</th>
            <th style="width: 58px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="bottom-box">
        <div class="notes-col">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #444; margin-bottom: 2px;">
            Order Remarks & Terms:
          </div>
          <div style="min-height: 28px; line-height: 1.4; color: #444;">
            Goods once booked cannot be cancelled. Standard distributor credit policy applies.
          </div>
        </div>
        <div class="totals-col">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-weight: 800;">ESTIMATED SUB TOTAL:</span>
            <span style="font-family: monospace; font-weight: 700;">₹ ________________</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px;">
            <span style="font-weight: 900; font-size: 10px;">ESTIMATED TOTAL (WITH GST):</span>
            <span style="font-family: monospace; font-weight: 900; font-size: 11px;">₹ ________________</span>
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
</body>
</html>`
}

export function generatePurchaseSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let rows = ''
  for (let i = 1; i <= 18; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven}><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order Sheet - OCR Template</title>
  <style>${getBaseCss()}</style>
</head>
<body>
  <div class="top-actions">
    <div>
      <strong style="font-size: 13px;">Standard A4 Purchase Order Sheet (OCR-Ready)</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">For Supplier / Manufacturer Purchase Orders</span>
    </div>
    <button onclick="window.print()" class="btn">🖨️ Print / Save as PDF (A4)</button>
  </div>

  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div class="header-box">
        <div class="header-top">
          <div class="branding">
            <h1>${c.name}</h1>
            <div class="sub">${c.sub}</div>
            <div class="meta">${c.address} | Ph: ${c.phone}</div>
            <div class="meta" style="font-weight: 700; color: #000; margin-top: 3px;">
              GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
            </div>
          </div>
          <div class="badge">
            <div>
              <span style="font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
              <span class="title">PURCHASE ORDER SHEET</span>
              <span class="sub">SUPPLIER & DISTRIBUTOR PROCUREMENT FORM</span>
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b;">
              REF: OCR-PUR-A4/2026
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="party-col">
            <div class="label">Supplier / Manufacturer / Distributor Name *</div>
            <div class="line"></div>
            <div style="display: flex; gap: 15px; margin-top: 5px; font-size: 8.5px;">
              <div><strong>GSTIN:</strong> ________________________</div>
              <div><strong>City / Station:</strong> ________________</div>
            </div>
          </div>
          <div class="order-col">
            <div class="order-row">
              <span class="lbl">PO NUMBER:</span>
              <span class="val">PO-2026/______</span>
            </div>
            <div class="order-row">
              <span class="lbl">DATE:</span>
              <span class="val">____/____/2026</span>
            </div>
            <div class="order-row">
              <span class="lbl">PURCHASE AGENT:</span>
              <span class="val">__________________</span>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-banner">
        <span>✍️ <strong>OCR Instructions:</strong> Write medicine descriptions, pack, quantity, and purchase rates clearly in CAPITAL LETTERS.</span>
        <span>PAGE 1 OF 1</span>
      </div>

      <table class="grid">
        <thead>
          <tr>
            <th style="width: 24px;">S.No</th>
            <th style="text-align: left; padding-left: 6px;">Medicine / Product Description</th>
            <th style="width: 44px;">Pack</th>
            <th style="width: 48px;">HSN</th>
            <th style="width: 58px;">Batch No</th>
            <th style="width: 46px;">Exp (MM/YY)</th>
            <th style="width: 38px;">Order Qty</th>
            <th style="width: 34px;">Free</th>
            <th style="width: 48px;">Pur Rate (₹)</th>
            <th style="width: 48px;">MRP (₹)</th>
            <th style="width: 36px;">GST%</th>
            <th style="width: 58px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="bottom-box">
        <div class="notes-col">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #444; margin-bottom: 2px;">
            Payment Terms & Delivery Instructions:
          </div>
          <div style="min-height: 28px; line-height: 1.4; color: #444;">
            Delivery within ________ days. F.O.R Destination. Standard goods warranty and minimum 70% shelf life required.
          </div>
        </div>
        <div class="totals-col">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-weight: 800;">ESTIMATED SUB TOTAL:</span>
            <span style="font-family: monospace; font-weight: 700;">₹ ________________</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px;">
            <span style="font-weight: 900; font-size: 10px;">ESTIMATED TOTAL (WITH GST):</span>
            <span style="font-family: monospace; font-weight: 900; font-size: 11px;">₹ ________________</span>
          </div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-space"></div>
          <div class="sig-line">ORDERED BY (PURCHASE MANAGER)</div>
        </div>
        <div class="sig-box">
          <div class="sig-space"></div>
          <div class="sig-line">VERIFIED & APPROVED BY</div>
        </div>
        <div class="sig-box">
          <div class="sig-space"></div>
          <div class="sig-line">SUPPLIER ACKNOWLEDGEMENT</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function generateChallanSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let rows = ''
  for (let i = 1; i <= 18; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    rows += `<tr${isEven}><td style="text-align:center;">${i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Delivery Challan Sheet - OCR Template</title>
  <style>${getBaseCss()}</style>
</head>
<body>
  <div class="top-actions">
    <div>
      <strong style="font-size: 13px;">Standard A4 Delivery Challan Sheet (OCR-Ready)</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">For Stock Transfer, Branch Dispatches & Delivery Runs</span>
    </div>
    <button onclick="window.print()" class="btn">🖨️ Print / Save as PDF (A4)</button>
  </div>

  <div class="sheet">
    <div class="frame">
      <div class="ocr-marker ocr-tl">[+ OCR-TL +]</div>
      <div class="ocr-marker ocr-tr">[+ OCR-TR +]</div>
      <div class="ocr-marker ocr-bl">[+ OCR-BL +]</div>
      <div class="ocr-marker ocr-br">[+ OCR-BR +]</div>

      <div class="header-box">
        <div class="header-top">
          <div class="branding">
            <h1>${c.name}</h1>
            <div class="sub">${c.sub}</div>
            <div class="meta">${c.address} | Ph: ${c.phone}</div>
            <div class="meta" style="font-weight: 700; color: #000; margin-top: 3px;">
              GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
            </div>
          </div>
          <div class="badge">
            <div>
              <span style="font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
              <span class="title">DELIVERY CHALLAN SHEET</span>
              <span class="sub">GOODS DISPATCH & RECEIVING SLIP</span>
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b;">
              REF: OCR-DC-A4/2026
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="party-col">
            <div class="label">Consignee / Destination Branch / Chemist Name *</div>
            <div class="line"></div>
            <div style="display: flex; gap: 15px; margin-top: 5px; font-size: 8.5px;">
              <div><strong>Address:</strong> ________________________</div>
              <div><strong>Contact:</strong> ____________________</div>
            </div>
          </div>
          <div class="order-col">
            <div class="order-row">
              <span class="lbl">CHALLAN NO:</span>
              <span class="val">DC-2026/______</span>
            </div>
            <div class="order-row">
              <span class="lbl">DISPATCH DATE:</span>
              <span class="val">____/____/2026</span>
            </div>
            <div class="order-row">
              <span class="lbl">VEHICLE / TRANSPORTER:</span>
              <span class="val">__________________</span>
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
            <th style="width: 24px;">S.No</th>
            <th style="text-align: left; padding-left: 6px;">Medicine / Item Description</th>
            <th style="width: 44px;">Pack</th>
            <th style="width: 50px;">HSN</th>
            <th style="width: 60px;">Batch No</th>
            <th style="width: 48px;">Exp (MM/YY)</th>
            <th style="width: 40px;">Disp Qty</th>
            <th style="width: 36px;">Free</th>
            <th style="width: 48px;">Rate (₹)</th>
            <th style="width: 48px;">MRP (₹)</th>
            <th style="width: 40px;">Boxes/Pkgs</th>
            <th style="width: 58px;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="bottom-box">
        <div class="notes-col">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #444; margin-bottom: 2px;">
            Transport & Dispatch Notes:
          </div>
          <div style="min-height: 28px; line-height: 1.4; color: #444;">
            Total Cases / Corrugated Cartons: _______ Nos. Received goods in sound condition without damage or tampering.
          </div>
        </div>
        <div class="totals-col">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-weight: 800;">TOTAL QUANTITY DISPATCHED:</span>
            <span style="font-family: monospace; font-weight: 700;">________________ Units</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px;">
            <span style="font-weight: 900; font-size: 10px;">ESTIMATED TOTAL VALUE:</span>
            <span style="font-family: monospace; font-weight: 900; font-size: 11px;">₹ ________________</span>
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
</body>
</html>`
}

export function generateVoucherSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  let rows = ''
  for (let i = 1; i <= 16; i++) {
    const isEven = i % 2 === 0 ? ' class="even"' : ''
    const drCr = i === 1 ? 'Dr' : i === 2 ? 'Cr' : ''
    rows += `<tr${isEven}><td style="text-align:center;">${i}</td><td style="text-align:center;">${drCr}</td><td></td><td></td><td></td><td></td><td></td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accounting Voucher Sheet - OCR Template</title>
  <style>${getBaseCss()}</style>
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

      <div class="header-box">
        <div class="header-top">
          <div class="branding">
            <h1>${c.name}</h1>
            <div class="sub">${c.sub}</div>
            <div class="meta">${c.address} | Ph: ${c.phone}</div>
            <div class="meta" style="font-weight: 700; color: #000; margin-top: 3px;">
              GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
            </div>
          </div>
          <div class="badge">
            <div>
              <span style="font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
              <span class="title">ACCOUNTING VOUCHER</span>
              <span class="sub">PAYMENT / RECEIPT / JOURNAL / CONTRA</span>
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b;">
              REF: OCR-VOUCH-A4/2026
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="party-col">
            <div class="label">Voucher Type & Bank / Cash Account</div>
            <div style="display: flex; gap: 15px; margin-top: 4px; font-size: 9px; font-weight: 700;">
              <span>[ ] PAYMENT</span>
              <span>[ ] RECEIPT</span>
              <span>[ ] JOURNAL</span>
              <span>[ ] CONTRA</span>
            </div>
            <div style="margin-top: 6px; font-size: 8.5px;">
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
            <th style="width: 28px;">S.No</th>
            <th style="width: 38px;">Type</th>
            <th style="text-align: left; padding-left: 6px;">Particulars / Ledger Account Name</th>
            <th style="width: 90px;">Bill / Inv Ref</th>
            <th style="text-align: left; padding-left: 6px;">Narration / Remarks</th>
            <th style="width: 85px; text-align: right; padding-right: 6px;">Debit (₹)</th>
            <th style="width: 85px; text-align: right; padding-right: 6px;">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="bottom-box">
        <div class="notes-col">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #444; margin-bottom: 2px;">
            Amount in Words:
          </div>
          <div style="min-height: 28px; line-height: 1.4; color: #333; font-style: italic;">
            Rupees __________________________________________________________________________________ only.
          </div>
        </div>
        <div class="totals-col">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-weight: 800;">TOTAL DEBIT (₹):</span>
            <span style="font-family: monospace; font-weight: 700;">________________</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px;">
            <span style="font-weight: 900; font-size: 10px;">TOTAL CREDIT (₹):</span>
            <span style="font-family: monospace; font-weight: 900; font-size: 11px;">________________</span>
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
</body>
</html>`
}

export function generateSampleFilledSheetHtml(c: TemplateCompanyInfo = DEFAULT_COMPANY): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Filled A4 Sales Order Sheet - OCR Test</title>
  <style>${getBaseCss()}</style>
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

      <div class="header-box">
        <div class="header-top">
          <div class="branding">
            <h1>${c.name}</h1>
            <div class="sub">${c.sub}</div>
            <div class="meta">${c.address} | Ph: ${c.phone}</div>
            <div class="meta" style="font-weight: 700; color: #000; margin-top: 3px;">
              GSTIN: <span style="font-family: monospace;">${c.gstin}</span> &nbsp;|&nbsp; D.L. No: <span style="font-family: monospace;">${c.dlNo}</span>
            </div>
          </div>
          <div class="badge">
            <div>
              <span style="font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.5px;">STANDARD OCR FORM</span>
              <span class="title">SALES ORDER SHEET</span>
              <span class="sub">FIELD REP ORDER BOOKING & VOUCHER ENTRY FORM</span>
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b;">
              REF: OCR-SALE-A4/2026
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="party-col">
            <div class="label">Customer / Chemist Shop Name *</div>
            <div class="line" style="color: #0c2f66; font-weight: 800; font-size: 13px;">APOLLO PHARMACY & SURGICALS</div>
            <div style="display: flex; gap: 15px; margin-top: 5px; font-size: 8.5px;">
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
            <th style="width: 24px;">S.No</th>
            <th style="text-align: left; padding-left: 6px;">Medicine / Product Description</th>
            <th style="width: 44px;">Pack</th>
            <th style="width: 48px;">HSN</th>
            <th style="width: 58px;">Batch No</th>
            <th style="width: 46px;">Exp (MM/YY)</th>
            <th style="width: 38px;">Order Qty</th>
            <th style="width: 34px;">Free</th>
            <th style="width: 48px;">Rate (₹)</th>
            <th style="width: 48px;">MRP (₹)</th>
            <th style="width: 36px;">GST%</th>
            <th style="width: 58px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">1</td>
            <td style="font-weight: 700; color: #0c2f66;">PAN 40MG TAB</td>
            <td style="text-align:center;">15'S</td>
            <td style="text-align:center;">30049099</td>
            <td style="text-align:center; font-weight:700;">BAT-8821</td>
            <td style="text-align:center;">09/27</td>
            <td style="text-align:center; font-weight: 800;">50</td>
            <td style="text-align:center;">5</td>
            <td style="text-align:right;">112.50</td>
            <td style="text-align:right;">155.00</td>
            <td style="text-align:center;">12%</td>
            <td style="text-align:right; font-weight:700;">5625.00</td>
          </tr>
          <tr class="even">
            <td style="text-align:center;">2</td>
            <td style="font-weight: 700; color: #0c2f66;">MOXIKIND CV 625 TAB</td>
            <td style="text-align:center;">10'S</td>
            <td style="text-align:center;">30041010</td>
            <td style="text-align:center; font-weight:700;">MK-9042</td>
            <td style="text-align:center;">11/26</td>
            <td style="text-align:center; font-weight: 800;">30</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:right;">168.00</td>
            <td style="text-align:right;">220.00</td>
            <td style="text-align:center;">12%</td>
            <td style="text-align:right; font-weight:700;">5040.00</td>
          </tr>
          <tr>
            <td style="text-align:center;">3</td>
            <td style="font-weight: 700; color: #0c2f66;">TELMA 40MG TAB</td>
            <td style="text-align:center;">15'S</td>
            <td style="text-align:center;">30049099</td>
            <td style="text-align:center; font-weight:700;">TL-4410</td>
            <td style="text-align:center;">04/28</td>
            <td style="text-align:center; font-weight: 800;">40</td>
            <td style="text-align:center;">4</td>
            <td style="text-align:right;">98.00</td>
            <td style="text-align:right;">135.00</td>
            <td style="text-align:center;">12%</td>
            <td style="text-align:right; font-weight:700;">3920.00</td>
          </tr>
          <tr class="even">
            <td style="text-align:center;">4</td>
            <td style="font-weight: 700; color: #0c2f66;">AUGMENTIN 625 DUO TAB</td>
            <td style="text-align:center;">10'S</td>
            <td style="text-align:center;">30041010</td>
            <td style="text-align:center; font-weight:700;">AG-1190</td>
            <td style="text-align:center;">08/27</td>
            <td style="text-align:center; font-weight: 800;">25</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:right;">185.00</td>
            <td style="text-align:right;">240.00</td>
            <td style="text-align:center;">12%</td>
            <td style="text-align:right; font-weight:700;">4625.00</td>
          </tr>
          <tr><td style="text-align:center;">5</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">6</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">7</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">8</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">9</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">10</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">11</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">12</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">13</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">14</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">15</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">16</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td style="text-align:center;">17</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr class="even"><td style="text-align:center;">18</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <div class="bottom-box">
        <div class="notes-col">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #444; margin-bottom: 2px;">
            Order Remarks & Terms:
          </div>
          <div style="min-height: 28px; line-height: 1.4; color: #333;">
            Sample test booking with 4 standard SKUs. 45 days credit terms agreed. Supply via route van #2.
          </div>
        </div>
        <div class="totals-col">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="font-weight: 800;">ESTIMATED SUB TOTAL:</span>
            <span style="font-family: monospace; font-weight: 700;">₹ 19,210.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px;">
            <span style="font-weight: 900; font-size: 10px;">ESTIMATED TOTAL (WITH GST):</span>
            <span style="font-family: monospace; font-weight: 900; font-size: 11px;">₹ 21,515.20</span>
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
</body>
</html>`
}

export function getTemplateHtmlById(templateId: string, company?: TemplateCompanyInfo): string {
  switch (templateId) {
    case 'purchase':
      return generatePurchaseSheetHtml(company)
    case 'challan':
      return generateChallanSheetHtml(company)
    case 'voucher':
      return generateVoucherSheetHtml(company)
    case 'sample':
      return generateSampleFilledSheetHtml(company)
    case 'sale':
    default:
      return generateSalesSheetHtml(company)
  }
}
