import React from 'react'
import { numberToWordsIndian } from '../../lib/numberToWords'
import { useUIStore } from '../../store/uiStore'

export interface InvoicePrintItem {
  id?: string
  itemName: string
  packing?: string
  mfr?: string
  hsn?: string
  batch?: string
  expiry?: string
  qty: number
  freeQty?: number
  mrp?: number
  purchaseRate: number
  discount?: number
  scheme?: number
  gstRate?: number
  amount?: number
}

export interface InvoicePrintData {
  companyName?: string
  companyAddress1?: string
  companyAddress2?: string
  companyPhone?: string
  companyGstin?: string
  companyDlNo?: string
  companyEmail?: string
  companyBankName?: string
  companyAccountNo?: string
  companyIfsc?: string
  companyJurisdiction?: string

  buyerName?: string
  buyerAddress?: string
  buyerPhone?: string
  buyerGstin?: string
  buyerDlNo?: string
  buyerPan?: string
  buyerBalance?: number

  receiptNo?: string
  invoiceNo?: string
  invoiceDate?: string
  orderNo?: string
  orderDate?: string
  paymentType?: string

  items: InvoicePrintItem[]
}

export default function PurchaseInvoicePrint({ data }: { data: InvoicePrintData }) {
  const storeCompany = useUIStore((s) => s.company)

  const company = {
    name: data.companyName || storeCompany.companyName,
    addr1: data.companyAddress1 || storeCompany.address,
    addr2: data.companyAddress2 || `${storeCompany.city}${storeCompany.state ? ', ' + storeCompany.state : ''}`,
    phone: data.companyPhone || storeCompany.phone,
    gstin: data.companyGstin || storeCompany.gstin,
    dlNo: data.companyDlNo || storeCompany.dlNo,
    email: data.companyEmail || storeCompany.email,
    bankName: data.companyBankName || storeCompany.bankName,
    accountNo: data.companyAccountNo || storeCompany.accountNo,
    ifsc: data.companyIfsc || storeCompany.ifsc,
    jurisdiction: data.companyJurisdiction || storeCompany.jurisdiction,
  }


  const buyer = {
    name: data.buyerName || 'HUVET ENTERPRISES',
    address: data.buyerAddress || 'TEZPUR',
    phone: data.buyerPhone || '03712232931',
    dlNo: data.buyerDlNo || 'STR-5018/5019',
    gstin: data.buyerGstin || '18AAHFH7021B1ZS',
    pan: data.buyerPan || 'AAHFH7021B',
    balance: data.buyerBalance !== undefined ? data.buyerBalance : -144352.0,
  }

  const receiptNo = data.receiptNo || data.invoiceNo || 'P000045'
  const invDate = data.invoiceDate ? formatDateDisplay(data.invoiceDate) : '02-04-2026'
  const orderNo = data.orderNo || ''
  const orderDate = data.orderDate ? formatDateDisplay(data.orderDate) : ''

  // Format expiry to MM/YY or M/YY
  function formatExp(expStr?: string): string {
    if (!expStr) return ''
    if (expStr.includes('/')) return expStr
    const parts = expStr.split('-')
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10)
      const yr = parts[0].slice(-2)
      return `${month}/${yr}`
    }
    return expStr
  }

  function formatDateDisplay(dStr: string): string {
    if (!dStr) return ''
    if (dStr.includes('-') && dStr.length === 10) {
      const [y, m, d] = dStr.split('-')
      return `${d}-${m}-${y}`
    }
    return dStr
  }

  // Calculate totals and GST slab breakdown
  let subtotal = 0
  let totalDiscountAmount = 0
  const gstBreakdown: Record<number, { taxable: number; sgst: number; cgst: number }> = {
    5: { taxable: 0, sgst: 0, cgst: 0 },
    12: { taxable: 0, sgst: 0, cgst: 0 },
    18: { taxable: 0, sgst: 0, cgst: 0 },
    0: { taxable: 0, sgst: 0, cgst: 0 },
  }

  const processedItems = data.items.map((item) => {
    const qty = Number(item.qty) || 0
    const freeQty = Number(item.freeQty) || 0
    const rate = Number(item.purchaseRate) || 0
    const discPercent = Number(item.discount) || 0
    const schPercent = Number(item.scheme) || 0
    const gstRate = Number(item.gstRate ?? 5)

    const grossAmount = qty * rate
    subtotal += grossAmount

    const itemDiscountAmount = grossAmount * (discPercent / 100) + grossAmount * (schPercent / 100)
    totalDiscountAmount += itemDiscountAmount

    const taxableAmount = grossAmount - itemDiscountAmount
    const halfGstRate = gstRate / 2
    const sgstAmount = taxableAmount * (halfGstRate / 100)
    const cgstAmount = taxableAmount * (halfGstRate / 100)

    // Add to GST slab
    const nearestSlab = [5, 12, 18, 0].includes(gstRate) ? gstRate : 5
    if (!gstBreakdown[nearestSlab]) {
      gstBreakdown[nearestSlab] = { taxable: 0, sgst: 0, cgst: 0 }
    }
    gstBreakdown[nearestSlab].taxable += taxableAmount
    gstBreakdown[nearestSlab].sgst += sgstAmount
    gstBreakdown[nearestSlab].cgst += cgstAmount

    return {
      ...item,
      qty,
      freeQty,
      rate,
      grossAmount,
      taxableAmount,
      gstRate,
      halfGstRate,
      sgstAmount,
      cgstAmount,
      discPercent,
      schPercent,
      expDisplay: formatExp(item.expiry),
    }
  })

  // GST Totals
  let totalTaxable = 0
  let totalSgst = 0
  let totalCgst = 0
  Object.values(gstBreakdown).forEach((b) => {
    totalTaxable += b.taxable
    totalSgst += b.sgst
    totalCgst += b.cgst
  })

  const rawGrandTotal = totalTaxable + totalSgst + totalCgst
  const roundedGrandTotal = Math.round(rawGrandTotal)
  const roundoff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2))

  const words = numberToWordsIndian(roundedGrandTotal)

  // Determine discount display percentage or string
  const primaryDiscountPercent = data.items.length > 0 ? (Number(data.items[0].discount) || 5) : 5
  const primaryGstRate = data.items.length > 0 ? (Number(data.items[0].gstRate) || 5) : 5
  const primaryHalfGst = (primaryGstRate / 2).toFixed(1).replace(/\.0$/, '')

  // Fill up table rows so the printed form always maintains vertical lines
  const minRows = Math.max(1, 5 - processedItems.length)
  const fillerRows = Array.from({ length: minRows }, (_, idx) => idx)

  return (
    <div className="goods-receipt-note-print bg-white text-black font-sans text-[11px] leading-tight select-text w-full mx-auto p-0">
      {/* Top indicator: Original Copy */}
      <div className="text-right text-[10px] text-black pr-2 pb-0.5 font-normal tracking-wide">
        Original Copy
      </div>

      {/* Main Outer Box with 1.5px solid black border */}
      <div className="border-[1.5px] border-black text-black">
        {/* Header Grid: Left Company Details, Center Credit/GRN Box, Right Buyer Details */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black">
          {/* Left: Seller/Company Info */}
          <div className="col-span-5 p-2 pr-1 border-r-[1.5px] border-black flex flex-col justify-start">
            <h1 className="text-[17px] font-extrabold text-[#0c2f66] tracking-tight leading-none uppercase mb-1">
              {company.name}
            </h1>
            <div className="text-[10px] font-bold text-black uppercase leading-snug">
              <div>{company.addr1}</div>
              <div>{company.addr2}</div>
              <div>Phone : {company.phone}</div>
              <div className="mt-0.5">GSTIN : <span className="font-mono">{company.gstin}</span></div>
              <div>D.L.No. : {company.dlNo}</div>
              <div className="lowercase">E-Mail : {company.email.toLowerCase()}</div>
            </div>
          </div>

          {/* Center: CREDIT & GOODS RECEIPT NOTE Box */}
          <div className="col-span-3 p-2 border-r-[1.5px] border-black flex flex-col items-center justify-center text-center">
            <div className="text-[14px] font-black text-black tracking-wide uppercase mb-2">
              {data.paymentType || 'CREDIT'}
            </div>
            <div className="border-[1.5px] border-black px-2 py-1 text-[13px] font-black tracking-wider uppercase bg-white">
              GOODS RECEIPT NOTE
            </div>
          </div>

          {/* Right: Buyer's Details & Invoice metadata */}
          <div className="col-span-4 p-1.5 flex flex-col justify-between text-[9.5px]">
            <div className="border border-black p-1 mb-1 leading-tight">
              <div className="text-[9px] font-bold underline mb-0.5">Buyer's Details:</div>
              <div className="text-[11px] font-black uppercase text-black">{buyer.name}</div>
              <div className="font-bold uppercase text-[9.5px]">{buyer.address}</div>
              <div className="flex justify-between font-bold text-[9px] mt-0.5">
                <span>Phone: {buyer.phone}</span>
                <span>D.L.No.:{buyer.dlNo}</span>
              </div>
              <div className="flex justify-between font-bold text-[9px]">
                <span>GST : <span className="font-mono">{buyer.gstin}</span></span>
                <span>Balance: {buyer.balance.toFixed(2)}</span>
              </div>
              <div className="font-bold text-[9px]">PAN :{buyer.pan}</div>
            </div>

            <div className="font-bold text-[10px] leading-tight space-y-0.5 px-0.5">
              <div className="flex justify-between">
                <span>G.Rcpt. No. : <strong className="font-mono text-[11px]">{receiptNo}</strong></span>
              </div>
              <div className="flex justify-between">
                <span>Inv. Date : <strong>{invDate}</strong></span>
              </div>
              <div className="text-[9px] text-gray-800">
                ORDER NO: {orderNo}, DATE- {orderDate}
              </div>
            </div>
          </div>
        </div>

        {/* Main Line Items Table */}
        <table className="w-full border-collapse text-[10px] font-sans" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-[#d4ebf2] text-black border-b-[1.5px] border-black text-[9.5px] font-bold">
              <th className="border-r border-black py-1 px-0.5 text-center w-[52px]">Qty+Free</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[48px]">Pack</th>
              <th className="border-r border-black py-1 px-1.5 text-left">Product Description</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[52px]">Mfr.</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[44px]">HSN</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[66px]">Batch</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[40px]">Exp.</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[48px]">M.R.P</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[48px]">RATE</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[36px]">Sch.</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[36px]">Disc</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[36px]">SGST</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[36px]">CGST</th>
              <th className="py-1 px-1 text-right w-[66px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-gray-300 font-bold leading-none">
                <td className="border-r border-black py-1 px-0.5 text-center font-mono">
                  {item.qty}{item.freeQty ? `+${item.freeQty}` : ''}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center uppercase whitespace-nowrap">{item.packing || '—'}</td>
                <td className="border-r border-black py-1 px-1.5 text-left uppercase font-black text-black">
                  {item.itemName}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center uppercase whitespace-nowrap">{item.mfr || 'CONCEP'}</td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono">{item.hsn || '3004'}</td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono whitespace-nowrap">{item.batch || '—'}</td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono">{item.expDisplay || '—'}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.mrp?.toFixed(2) || '0.00'}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.rate.toFixed(2)}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.schPercent.toFixed(2)}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.discPercent.toFixed(2)}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.halfGstRate.toFixed(2)}</td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono">{item.halfGstRate.toFixed(2)}</td>
                <td className="py-1 px-1 text-right font-mono font-black text-black">
                  {item.grossAmount.toFixed(2)}
                </td>
              </tr>
            ))}

            {/* Filler rows to extend vertical borders down */}
            {fillerRows.map((_, i) => (
              <tr key={`fill-${i}`} className="h-5">
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="border-r border-black py-1"></td>
                <td className="py-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Lower Section: 3-column split (GST Table, Center Signatory & E.O.E., Right Totals) */}
        <div className="grid grid-cols-12 border-t-[1.5px] border-black min-h-[110px]">
          {/* GST Summary Table */}
          <div className="col-span-5 border-r-[1.5px] border-black p-1 text-[9.5px]">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black font-bold text-[9px]">
                  <th className="text-left pb-0.5 w-[55px]">GST Rate</th>
                  <th className="text-right pb-0.5">Taxable</th>
                  <th className="text-right pb-0.5">SGST</th>
                  <th className="text-right pb-0.5 pr-1">CGST</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[9px] font-bold">
                {[5, 12, 18, 0].map((rate) => {
                  const b = gstBreakdown[rate] || { taxable: 0, sgst: 0, cgst: 0 }
                  return (
                    <tr key={rate}>
                      <td className="text-left py-0.5">{rate}%</td>
                      <td className="text-right py-0.5">{b.taxable.toFixed(2)}</td>
                      <td className="text-right py-0.5">{b.sgst.toFixed(2)}</td>
                      <td className="text-right py-0.5 pr-1">{b.cgst.toFixed(2)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t border-black font-bold">
                  <td className="text-left pt-0.5">Total</td>
                  <td className="text-right pt-0.5">{totalTaxable.toFixed(2)}</td>
                  <td className="text-right pt-0.5">{totalSgst.toFixed(2)}</td>
                  <td className="text-right pt-0.5 pr-1">{totalCgst.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Center Authorization & Terms */}
          <div className="col-span-4 border-r-[1.5px] border-black p-1.5 flex flex-col justify-between">
            <div className="text-right text-[10px] font-bold">E.&.O.E.</div>
            <div className="text-center">
              <div className="text-[10px] font-black uppercase text-black">
                For {company.name}
              </div>
              <div className="h-6"></div>
              <div className="text-[10px] font-bold text-black border-t border-dotted border-gray-400 pt-0.5">
                Authorised Signatory
              </div>
            </div>
          </div>

          {/* Right Totals Breakdown */}
          <div className="col-span-3 p-1.5 text-[10px] font-bold flex flex-col justify-between">
            <div className="space-y-0.5 font-mono">
              <div className="flex justify-between">
                <span className="font-sans font-bold">SUB TOTAL</span>
                <span className="font-bold">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-black">
                <span className="font-sans font-bold">Discount {primaryDiscountPercent} %</span>
                <span>{totalDiscountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-black">
                <span className="font-sans font-bold">SGST {primaryHalfGst} %</span>
                <span>{totalSgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-black">
                <span className="font-sans font-bold">CGST {primaryHalfGst} %</span>
                <span>{totalCgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-black">
                <span className="font-sans font-bold">Roundoff</span>
                <span>{roundoff.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grand Total Row */}
        <div className="grid grid-cols-12 border-t-[1.5px] border-black items-center">
          <div className="col-span-8 px-2 py-1 text-[11px] font-black text-black">
            {words}
          </div>
          <div className="col-span-4 border-l-[1.5px] border-black px-2 py-1 flex justify-between items-center text-[13px] font-black bg-white">
            <span className="tracking-wide">GRAND TOTAL</span>
            <span className="font-mono text-[14px]">{roundedGrandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer: Bank Details & Legal Jurisdiction */}
        <div className="border-t-[1.5px] border-black p-1.5 text-[9.5px] font-bold leading-tight bg-white">
          <div className="uppercase underline text-[9.5px]">OUR BANK DETAILS:</div>
          <div className="font-mono text-[9px] uppercase mt-0.5">
            (A){company.bankName}, (B) A/C-{company.accountNo}, (C) IFSC-{company.ifsc}
          </div>
          <div className="text-[9px] text-black mt-0.5">
            All disputes subject to {company.jurisdiction} jurisdiction only
          </div>
        </div>
      </div>
    </div>
  )
}
