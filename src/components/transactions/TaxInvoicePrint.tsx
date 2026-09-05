import React from 'react'
import { numberToWordsIndian } from '../../lib/numberToWords'
import { useUIStore } from '../../store/uiStore'

export interface TaxInvoiceItem {
  id?: string
  name: string
  packing?: string
  mfr?: string
  hsn?: string
  batch?: string
  expiry?: string
  qty: number
  freeQty?: number
  mrp?: number
  rate: number
  discount?: number
  scheme?: number
  gstRate?: number
  amount?: number
}

export interface TaxInvoiceBuyer {
  name: string
  address?: string
  city?: string
  state?: string
  phone?: string
  gstin?: string
  dlNo?: string
  pan?: string
}

export interface TaxInvoicePrintData {
  title?: string
  copyType?: string
  invoiceNo: string
  invoiceDate: string
  dueDate?: string
  paymentMode?: string
  orderNo?: string
  orderDate?: string
  patientName?: string
  prescriberName?: string
  prescriptionReference?: string
  buyer: TaxInvoiceBuyer
  items: TaxInvoiceItem[]
  subtotal?: number
  discountTotal?: number
  taxTotal?: number
  roundingAdjustment?: number
  grandTotal?: number
}

export default function TaxInvoicePrint({ data }: { data: TaxInvoicePrintData }) {
  const company = useUIStore((s) => s.company)

  const docTitle = data.title || 'TAX INVOICE'
  const copyType = data.copyType || 'Original for Recipient'
  const invNo = data.invoiceNo || 'INV-TEMP'
  const invDate = data.invoiceDate || new Date().toISOString().split('T')[0]
  const payMode = data.paymentMode || 'Credit'
  const jurisdiction = company.jurisdiction || company.city || 'Guwahati'

  // Format date display
  function formatDate(dStr?: string): string {
    if (!dStr) return ''
    if (dStr.includes('/') && dStr.length <= 10) return dStr
    const parts = dStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
    return dStr
  }

  // Format expiry to MM/YY
  function formatExp(expStr?: string): string {
    if (!expStr) return '—'
    if (expStr.includes('/')) return expStr
    const parts = expStr.split('-')
    if (parts.length === 3) {
      const month = String(parseInt(parts[1], 10)).padStart(2, '0')
      const yr = parts[0].slice(-2)
      return `${month}/${yr}`
    }
    return expStr
  }

  // Calculate line items with tax breakdown
  let calcSubtotal = 0
  let calcDiscount = 0
  const gstBreakdown: Record<number, { taxable: number; cgst: number; sgst: number }> = {
    0: { taxable: 0, cgst: 0, sgst: 0 },
    5: { taxable: 0, cgst: 0, sgst: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0 },
    28: { taxable: 0, cgst: 0, sgst: 0 },
  }

  const processedItems = data.items.map((item, idx) => {
    const qty = Number(item.qty) || 0
    const freeQty = Number(item.freeQty) || 0
    const rate = Number(item.rate) || 0
    const mrp = Number(item.mrp || rate * 1.2)
    const discPercent = Number(item.discount || 0)
    const gstRate = Number(item.gstRate ?? 12)

    const gross = qty * rate
    calcSubtotal += gross

    const discAmt = gross * (discPercent / 100)
    calcDiscount += discAmt

    const taxable = gross - discAmt
    const halfGst = gstRate / 2
    const cgst = taxable * (halfGst / 100)
    const sgst = taxable * (halfGst / 100)
    const lineTotal = taxable + cgst + sgst

    const slab = [0, 5, 12, 18, 28].includes(gstRate) ? gstRate : 12
    if (!gstBreakdown[slab]) {
      gstBreakdown[slab] = { taxable: 0, cgst: 0, sgst: 0 }
    }
    gstBreakdown[slab].taxable += taxable
    gstBreakdown[slab].cgst += cgst
    gstBreakdown[slab].sgst += sgst

    return {
      sNo: idx + 1,
      name: item.name,
      packing: item.packing || '1x10',
      mfr: item.mfr || 'PHARMA',
      hsn: item.hsn || '3004',
      batch: item.batch || 'BAT-' + (idx + 101),
      expiry: formatExp(item.expiry),
      qty,
      freeQty,
      mrp,
      rate,
      discPercent,
      taxable,
      gstRate,
      lineTotal,
    }
  })

  let totalTaxable = 0
  let totalCgst = 0
  let totalSgst = 0
  Object.values(gstBreakdown).forEach((b) => {
    totalTaxable += b.taxable
    totalCgst += b.cgst
    totalSgst += b.sgst
  })

  const rawGrandTotal =
    data.grandTotal !== undefined ? data.grandTotal : totalTaxable + totalCgst + totalSgst
  const roundedGrandTotal = Math.round(rawGrandTotal)
  const roundoff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2))
  const words = numberToWordsIndian(roundedGrandTotal)

  // Ensure minimum rows so table fills nicely like a printed bill
  const minRows = Math.max(1, 5 - processedItems.length)
  const fillerRows = Array.from({ length: minRows }, (_, idx) => idx)

  return (
    <div className="tax-invoice-bill bg-white text-black font-sans text-[11px] leading-tight select-text w-full min-w-[760px] print:min-w-0 mx-auto p-0">
      {/* Main Box Outer Border */}
      <div className="border-[1.5px] border-black">
        {/* Header: Company Details & Invoice Type */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black">
          {/* Company Branding (7 cols) */}
          <div className="col-span-7 p-2.5 border-r-[1.5px] border-black flex items-start gap-2.5">
            <img
              src="/favicon.png"
              alt="Logo"
              className="w-10 h-10 object-contain mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <h1 className="text-[17px] font-extrabold text-[#0c2f66] tracking-tight leading-none uppercase mb-1">
                {company.companyName}
              </h1>
              <div className="text-[10px] text-gray-800 font-semibold leading-tight">
                <div>WHOLESALE PHARMACEUTICAL DISTRIBUTORS</div>
                <div>
                  {company.address}
                  {company.city ? `, ${company.city}` : ''}
                  {company.pincode ? ` - ${company.pincode}` : ''}
                </div>
                <div>State: {company.state || 'Assam'} (State Code: 18)</div>
                <div className="flex flex-wrap gap-x-3 text-[9.5px] mt-0.5 font-bold text-black">
                  {company.phone && <span>Ph: {company.phone}</span>}
                  {company.email && <span>E: {company.email.toLowerCase()}</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 text-[9.5px] mt-0.5 font-bold text-black">
                  {company.gstin && (
                    <span>
                      GSTIN: <span className="font-mono">{company.gstin}</span>
                    </span>
                  )}
                  {company.dlNo && (
                    <span>
                      D.L. No: <span className="font-mono">{company.dlNo}</span>
                    </span>
                  )}
                  {company.pan && <span>PAN: {company.pan}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Document Header Badge (5 cols) */}
          <div className="col-span-5 p-2.5 flex flex-col justify-between text-right">
            <div className="text-center border-[1.5px] border-black bg-white py-1 px-3 font-black tracking-widest text-[13px] text-black uppercase mb-1">
              {docTitle}
            </div>
            <div className="text-[10px] text-left space-y-0.5 mt-1 border border-black p-1.5 bg-gray-50/50">
              <div className="flex justify-between font-bold">
                <span>Invoice No:</span>
                <span className="font-mono text-[11px] text-[#0c2f66]">{invNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Dated:</span>
                <span className="font-bold">{formatDate(invDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase">{payMode}</span>
              </div>
              {data.dueDate && (
                <div className="flex justify-between text-[9px] text-gray-700">
                  <span>Due Date:</span>
                  <span>{formatDate(data.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Billed To / Party Details Section */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black text-[10px]">
          <div className="col-span-8 p-2 border-r-[1.5px] border-black">
            <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">
              Billed To / Buyer (Consignee):
            </div>
            <div className="text-[12px] font-black uppercase text-[#0c2f66]">
              {data.buyer.name || 'CASH SALE / WALK-IN CUSTOMER'}
            </div>
            <div className="font-semibold text-gray-800 leading-tight mt-0.5">
              {data.buyer.address && <div>{data.buyer.address}</div>}
              {data.buyer.city && <div>{data.buyer.city} {data.buyer.state ? `(${data.buyer.state})` : ''}</div>}
              {data.buyer.phone && <div>Contact / Phone: {data.buyer.phone}</div>}
            </div>
            <div className="flex flex-wrap gap-x-4 mt-1 font-bold text-[9.5px]">
              {data.buyer.gstin && (
                <span>
                  GSTIN: <span className="font-mono">{data.buyer.gstin}</span>
                </span>
              )}
              {data.buyer.dlNo && <span>D.L. No: {data.buyer.dlNo}</span>}
              {data.buyer.pan && <span>PAN: {data.buyer.pan}</span>}
            </div>
          </div>

          <div className="col-span-4 p-2 flex flex-col justify-between text-[9.5px]">
            <div className="space-y-1">
              {data.orderNo && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Order No:</span>
                  <span className="font-bold">{data.orderNo}</span>
                </div>
              )}
              {data.prescriberName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Doctor / Rx:</span>
                  <span className="font-bold">{data.prescriberName}</span>
                </div>
              )}
              {data.patientName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient:</span>
                  <span className="font-bold">{data.patientName}</span>
                </div>
              )}
            </div>
            <div className="text-[8.5px] text-gray-600 pt-1 border-t border-gray-300">
              Supply Type: Intra-State Supply (Taxable under GST)
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full border-collapse text-[9.5px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-[#d4ebf2] text-black border-b-[1.5px] border-black font-bold">
              <th className="border-r border-black py-1 px-0.5 text-center w-[26px]">#</th>
              <th className="border-r border-black py-1 px-1.5 text-left">Product Description</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[54px]">Pack</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[56px]">Mfr</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[42px]">HSN</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[66px]">Batch</th>
              <th className="border-r border-black py-1 px-0.5 text-center w-[42px]">Exp.</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[44px]">Qty</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[50px]">M.R.P.</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[50px]">Rate</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[34px]">Disc%</th>
              <th className="border-r border-black py-1 px-0.5 text-right w-[36px]">GST%</th>
              <th className="py-1 px-1 text-right w-[66px]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item) => (
              <tr key={item.sNo} className="border-b border-gray-300 font-semibold leading-tight">
                <td className="border-r border-black py-1 px-0.5 text-center text-[9px] text-gray-700">
                  {item.sNo}
                </td>
                <td className="border-r border-black py-1 px-1.5 text-left font-bold text-black">
                  {item.name}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center whitespace-nowrap text-[9px]">
                  {item.packing}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center uppercase whitespace-nowrap text-[9px]">
                  {item.mfr}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono text-[9px]">
                  {item.hsn}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono text-[9px] whitespace-nowrap">
                  {item.batch}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-center font-mono text-[9px]">
                  {item.expiry}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono font-bold text-[9px]">
                  {item.qty}
                  {item.freeQty ? <span className="text-[8px] text-emerald-700">+{item.freeQty}</span> : ''}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono text-[9px]">
                  {item.mrp.toFixed(2)}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono text-[9px]">
                  {item.rate.toFixed(2)}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono text-[9px]">
                  {item.discPercent > 0 ? `${item.discPercent}%` : '—'}
                </td>
                <td className="border-r border-black py-1 px-0.5 text-right font-mono text-[9px]">
                  {item.gstRate}%
                </td>
                <td className="py-1 px-1 text-right font-mono font-bold text-[9px]">
                  {item.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}

            {/* Filler Rows to maintain crisp invoice vertical lines */}
            {fillerRows.map((_, fIdx) => (
              <tr key={`filler-${fIdx}`} className="border-b border-gray-200/40 h-[20px]">
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="py-0.5">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* GST Slab Breakdown & Totals Section */}
        <div className="grid grid-cols-12 border-t-[1.5px] border-black text-[9.5px]">
          {/* Left: GST Slabs Summary Table (7 cols) */}
          <div className="col-span-7 p-2 border-r-[1.5px] border-black flex flex-col justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                GST Tax Analysis:
              </div>
              <table className="w-full border border-black text-[9px] border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-gray-100 font-bold border-b border-black">
                    <th className="border-r border-black px-1 py-0.5 text-center w-[18%]">Tax Slab</th>
                    <th className="border-r border-black px-1 py-0.5 text-right w-[21%]">Taxable Val</th>
                    <th className="border-r border-black px-1 py-0.5 text-right w-[18%]">CGST</th>
                    <th className="border-r border-black px-1 py-0.5 text-right w-[18%]">SGST</th>
                    <th className="px-1 py-0.5 text-right w-[25%]">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(gstBreakdown)
                    .filter(([_, v]) => v.taxable > 0)
                    .map(([slab, v]) => (
                      <tr key={slab} className="border-b border-gray-300 font-mono">
                        <td className="border-r border-black px-1 py-0.5 text-center font-sans font-bold">
                          {slab}% GST
                        </td>
                        <td className="border-r border-black px-1 py-0.5 text-right">
                          {v.taxable.toFixed(2)}
                        </td>
                        <td className="border-r border-black px-1 py-0.5 text-right">
                          {v.cgst.toFixed(2)}
                        </td>
                        <td className="border-r border-black px-1 py-0.5 text-right">
                          {v.sgst.toFixed(2)}
                        </td>
                        <td className="px-1 py-0.5 text-right font-bold">
                          {(v.cgst + v.sgst).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-gray-50 font-mono font-bold border-t border-black">
                    <td className="border-r border-black px-1 py-0.5 text-center font-sans">TOTAL</td>
                    <td className="border-r border-black px-1 py-0.5 text-right">
                      {totalTaxable.toFixed(2)}
                    </td>
                    <td className="border-r border-black px-1 py-0.5 text-right">
                      {totalCgst.toFixed(2)}
                    </td>
                    <td className="border-r border-black px-1 py-0.5 text-right">
                      {totalSgst.toFixed(2)}
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      {(totalCgst + totalSgst).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bank Details Box */}
            <div className="border border-black p-1.5 mt-2 bg-gray-50/60 leading-tight text-[9px]">
              <div className="font-bold text-black uppercase mb-1">Bank Payment Details:</div>
              <div className="grid grid-cols-3 gap-1 text-[8.5px]">
                <div><span className="text-gray-600">Bank:</span> <strong>{company.bankName || 'PUNJAB NATIONAL BANK'}</strong></div>
                <div><span className="text-gray-600">A/C:</span> <strong className="font-mono">{company.accountNo || '1125250029704'}</strong></div>
                <div><span className="text-gray-600">IFSC:</span> <strong className="font-mono">{company.ifsc || 'PUNB0112520'}</strong></div>
              </div>
            </div>
          </div>

          {/* Right: Totals Calculation Summary (5 cols) */}
          <div className="col-span-5 p-2 flex flex-col justify-between">
            <div className="space-y-1 font-bold">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span>{processedItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gross Amount:</span>
                <span className="font-mono">₹{calcSubtotal.toFixed(2)}</span>
              </div>
              {calcDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{calcDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{totalTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Central GST (CGST):</span>
                <span className="font-mono">₹{totalCgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>State GST (SGST):</span>
                <span className="font-mono">₹{totalSgst.toFixed(2)}</span>
              </div>
              {roundoff !== 0 && (
                <div className="flex justify-between text-gray-500 text-[9px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{roundoff > 0 ? `+₹${roundoff}` : `-₹${Math.abs(roundoff)}`}</span>
                </div>
              )}
            </div>

            {/* Grand Total Box */}
            <div className="border-[1.5px] border-black bg-gray-100/70 p-2 mt-2">
              <div className="text-[9.5px] uppercase tracking-wider font-bold text-gray-800">Grand Total Payable</div>
              <div className="text-[19px] font-black font-mono tracking-tight flex items-baseline justify-between text-black">
                <span>₹</span>
                <span>{roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="border-t-[1.5px] border-black px-2.5 py-1.5 bg-gray-50 text-[10px] font-bold">
          Amount Chargeable (in words):{' '}
          <span className="italic font-normal text-black underline">{words}</span>
        </div>

        {/* Terms & Signatures Footer */}
        <div className="grid grid-cols-12 border-t-[1.5px] border-black text-[9px]">
          {/* Terms & Conditions */}
          <div className="col-span-7 p-2 border-r-[1.5px] border-black leading-snug">
            <div className="font-bold underline mb-0.5 uppercase text-gray-800">
              Terms &amp; Conditions:
            </div>
            <ol className="list-decimal list-inside text-gray-700 space-y-0.5 text-[8.5px]">
              <li>Goods once sold will not be accepted back or exchanged without prior consent.</li>
              <li>Interest @ 18% p.a. will be levied if payment is not cleared within agreed credit period.</li>
              <li>Discrepancies in quantity or price must be notified within 24 hours of receipt.</li>
              <li>All disputes are subject to {jurisdiction.toUpperCase()} jurisdiction only.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="col-span-5 p-2 flex flex-col justify-between">
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase text-gray-700">For {company.companyName}</div>
            </div>
            <div className="flex justify-between items-end pt-8">
              <div className="text-center text-[8.5px] text-gray-700">
                <div className="border-t border-black w-24 pt-0.5">Receiver's Sign</div>
              </div>
              <div className="text-center text-[8.5px] font-bold text-black">
                <div className="border-t border-black w-28 pt-0.5">Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[8px] text-gray-500 mt-1">
        This is a Computer Generated Tax Invoice &bull; Powered by Borgang Drug Distributors
      </div>
    </div>
  )
}
