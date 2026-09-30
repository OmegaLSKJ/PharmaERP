import React from 'react'
import { useUIStore } from '../../store/uiStore'

export type BlankSheetMode = 'sale' | 'purchase' | 'challan'

interface BlankTransactionSheetPrintProps {
  mode: BlankSheetMode
  partyName?: string
  partyGstin?: string
  repName?: string
  date?: string
  sheetNo?: string
  rowCount?: number
}

export default function BlankTransactionSheetPrint({
  mode = 'sale',
  partyName = '',
  partyGstin = '',
  repName = '',
  date = '',
  sheetNo = '',
  rowCount = 25
}: BlankTransactionSheetPrintProps) {
  const storeCompany = useUIStore((s) => s.company)

  const company = {
    name: storeCompany.companyName || 'BORGANG DRUG DISTRIBUTORS',
    address: storeCompany.address || 'BORGANG, BISWANATH, ASSAM',
    city: storeCompany.city || 'BORGANG',
    pincode: storeCompany.pincode || '784167',
    state: storeCompany.state || 'Assam',
    phone: storeCompany.phone || '+91 6000763703',
    email: storeCompany.email || 'borgangdrugdistributors@gmail.com',
    gstin: storeCompany.gstin || '18AKWPP4417G1ZN',
    dlNo: storeCompany.dlNo || 'DNG/622/623',
    pan: storeCompany.pan || 'AKWPP4417G',
  }

  const getSheetConfig = () => {
    switch (mode) {
      case 'purchase':
        return {
          title: 'PURCHASE / GOODS INWARD ENTRY SHEET',
          subtitle: 'STANDARD PHARMA INWARD ORDER & STOCK RECEIPT FORM',
          partyLabel: 'Supplier / Distributor Name',
          docNoLabel: 'Inward / Bill No',
          repLabel: 'Received By / Manager',
          accentColor: '#1e3a8a', // Dark blue
        }
      case 'challan':
        return {
          title: 'DELIVERY CHALLAN & DISPATCH SHEET',
          subtitle: 'GOODS DELIVERY & HANDOVER ORDER RECORD',
          partyLabel: 'Consignee / Recipient Chemist',
          docNoLabel: 'Challan No',
          repLabel: 'Dispatched By / Driver',
          accentColor: '#0f766e', // Teal
        }
      case 'sale':
      default:
        return {
          title: 'SALES ORDER & BOOKING SHEET',
          subtitle: 'FIELD REPRESENTATIVE ORDER BOOKING & BILLING FORM',
          partyLabel: 'Customer / Chemist Shop Name',
          docNoLabel: 'Order / Slip No',
          repLabel: 'Sales Rep / Booked By',
          accentColor: '#0c2f66', // Deep navy
        }
    }
  }

  const config = getSheetConfig()
  const rows = Array.from({ length: rowCount }, (_, i) => i + 1)

  return (
    <div className="blank-sheet-root w-full max-w-[210mm] mx-auto bg-white text-black font-sans p-6 sm:p-8 text-[11px] leading-tight select-text print:p-4 print:m-0 print:w-full print:max-w-none">
      
      {/* Outer Border Frame with OCR Corner Markers */}
      <div className="border-2 border-black p-4 sm:p-5 relative bg-white">
        
        {/* OCR Corner Calibration Crosshairs */}
        <div className="absolute top-1 left-1 text-[8px] font-mono text-black font-bold select-none">+ OCR-TL +</div>
        <div className="absolute top-1 right-1 text-[8px] font-mono text-black font-bold select-none">+ OCR-TR +</div>
        <div className="absolute bottom-1 left-1 text-[8px] font-mono text-black font-bold select-none">+ OCR-BL +</div>
        <div className="absolute bottom-1 right-1 text-[8px] font-mono text-black font-bold select-none">+ OCR-BR +</div>

        {/* 1. Header Box */}
        <div className="border border-black mb-2.5">
          <div className="grid grid-cols-12 border-b border-black">
            {/* Left Branding */}
            <div className="col-span-8 p-2 border-r border-black">
              <h1 className="text-[16px] font-black tracking-tight uppercase leading-none text-[#0c2f66] mb-1">
                {company.name}
              </h1>
              <div className="text-[9px] font-semibold text-gray-800">
                WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS
              </div>
              <div className="text-[9px] text-gray-700 mt-0.5">
                {company.address} - {company.pincode} ({company.state}) | Ph: {company.phone}
              </div>
              <div className="text-[9px] font-bold text-gray-900 mt-0.5">
                GSTIN: <span className="font-mono">{company.gstin}</span> | D.L. No: <span className="font-mono">{company.dlNo}</span>
              </div>
            </div>

            {/* Right Document Title Badge */}
            <div className="col-span-4 p-2 flex flex-col justify-between text-right bg-gray-50/70">
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 block">STANDARD OCR FORM</span>
                <span className="text-[12px] font-extrabold uppercase tracking-tight block text-gray-900 mt-0.5">
                  {config.title}
                </span>
                <span className="text-[8px] text-gray-600 block leading-none mt-0.5">
                  {config.subtitle}
                </span>
              </div>
              <div className="text-[8px] font-mono text-gray-500 mt-1">
                FORM REF: PHARMA-OCR-A4/2026
              </div>
            </div>
          </div>

          {/* 2. Metadata Fill-In Grid */}
          <div className="grid grid-cols-12 text-[10px]">
            {/* Party Name */}
            <div className="col-span-7 p-2 border-r border-black">
              <span className="font-bold uppercase text-gray-700 text-[9px] block">
                {config.partyLabel} *
              </span>
              <div className="font-bold text-[12px] min-h-[22px] flex items-center">
                {partyName || <span className="text-gray-400 font-normal italic">____________________________________________________</span>}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-bold text-gray-700 text-[9px]">PARTY GSTIN / DL:</span>
                <span className="font-mono font-semibold text-[10px]">
                  {partyGstin || '___________________________'}
                </span>
              </div>
            </div>

            {/* Order Reference Details */}
            <div className="col-span-5 p-2 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700 text-[9px] uppercase">{config.docNoLabel}:</span>
                <span className="font-mono font-bold text-[11px]">{sheetNo || '___________________'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700 text-[9px] uppercase">DATE:</span>
                <span className="font-mono font-bold text-[11px]">{date || '[ DD / MM / YYYY ]'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700 text-[9px] uppercase">{config.repLabel}:</span>
                <span className="font-semibold text-[10px]">{repName || '___________________'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions banner for sales reps */}
        <div className="bg-gray-100 border border-black px-2 py-1 mb-2 text-[8px] flex items-center justify-between font-medium text-gray-800">
          <span>
            ✍️ <strong>OCR Instructions:</strong> Write medicine name, batch, expiry (MM/YY), and quantity clearly in CAPITAL LETTERS. Avoid overlapping cells.
          </span>
          <span className="font-mono text-gray-600">PAGE 1 OF 1</span>
        </div>

        {/* 3. High-Accuracy OCR Data Table */}
        <div className="border border-black overflow-hidden mb-2">
          <table className="w-full border-collapse text-left text-[9px]">
            <thead>
              <tr className="bg-gray-200 border-b border-black text-[9px] font-black uppercase text-gray-900 leading-tight">
                <th className="border-r border-black py-1 px-1 w-6 text-center">S.No</th>
                <th className="border-r border-black py-1 px-2.5">Medicine / Product Description</th>
                <th className="border-r border-black py-1 px-1 w-11 text-center">Pack</th>
                <th className="border-r border-black py-1 px-1 w-11 text-center">HSN</th>
                <th className="border-r border-black py-1 px-1 w-13 text-center">Batch No</th>
                <th className="border-r border-black py-1 px-1 w-11 text-center">Exp</th>
                <th className="border-r border-black py-1 px-1 w-8 text-right">Qty</th>
                <th className="border-r border-black py-1 px-1 w-7 text-right">Free</th>
                <th className="border-r border-black py-1 px-1 w-12 text-right">Rate (₹)</th>
                <th className="border-r border-black py-1 px-1 w-12 text-right">MRP (₹)</th>
                <th className="border-r border-black py-1 px-1 w-8 text-center">GST%</th>
                <th className="py-1 px-1.5 w-14 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rowNum) => (
                <tr key={rowNum} className="border-b border-gray-400 min-h-[23px] h-[23px]">
                  <td className="border-r border-black px-1 text-center font-mono text-gray-600 font-semibold bg-gray-50/50">
                    {rowNum}
                  </td>
                  <td className="border-r border-black px-2 font-medium"></td>
                  <td className="border-r border-black px-1 text-center text-gray-400 font-mono"></td>
                  <td className="border-r border-black px-1 text-center font-mono"></td>
                  <td className="border-r border-black px-1 text-center font-mono uppercase"></td>
                  <td className="border-r border-black px-1 text-center font-mono"></td>
                  <td className="border-r border-black px-1 text-right font-mono"></td>
                  <td className="border-r border-black px-1 text-right font-mono text-gray-400"></td>
                  <td className="border-r border-black px-1 text-right font-mono"></td>
                  <td className="border-r border-black px-1 text-right font-mono"></td>
                  <td className="border-r border-black px-1 text-center font-mono text-gray-600"></td>
                  <td className="px-2 text-right font-mono"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Bottom Summary & Confirmation Grid */}
        <div className="border border-black grid grid-cols-12 text-[9px]">
          
          {/* Notes & Special Delivery Requests */}
          <div className="col-span-7 p-2 border-r border-black space-y-1">
            <span className="font-bold uppercase text-gray-700 block">Notes / Special Instructions:</span>
            <div className="text-[9px] text-gray-500 italic space-y-0.5">
              <div>[ ] Cold Chain (2°C - 8°C) &nbsp;&nbsp;&nbsp; [ ] Urgent Delivery (Same Day) &nbsp;&nbsp;&nbsp; [ ] Normal Dispatch</div>
              <div className="border-b border-dotted border-gray-400 pt-2"></div>
              <div className="border-b border-dotted border-gray-400 pt-2"></div>
            </div>
          </div>

          {/* Totals & Grand Amount Box */}
          <div className="col-span-5 p-2 bg-gray-50/60 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Total Billed Items:</span>
                <span className="font-mono font-bold">______ Lines</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Total Quantity:</span>
                <span className="font-mono font-bold">______ Units</span>
              </div>
            </div>
            <div className="border-t border-black pt-1 mt-1 flex justify-between items-center">
              <span className="font-black text-[10px] uppercase text-gray-900">ESTIMATED TOTAL:</span>
              <span className="font-mono font-bold text-[12px]">₹ _________________</span>
            </div>
          </div>
        </div>

        {/* 5. Signature & Stamp Blocks */}
        <div className="grid grid-cols-3 border border-t-0 border-black text-[8px] text-center">
          <div className="p-3 border-r border-black">
            <div className="min-h-[28px]"></div>
            <div className="border-t border-dotted border-gray-600 pt-1 font-bold uppercase">
              Sales Rep / Prepared By
            </div>
          </div>
          <div className="p-3 border-r border-black">
            <div className="min-h-[28px]"></div>
            <div className="border-t border-dotted border-gray-600 pt-1 font-bold uppercase">
              Chemist Stamp & Signature
            </div>
          </div>
          <div className="p-3 bg-gray-50/50">
            <div className="min-h-[28px]"></div>
            <div className="border-t border-dotted border-gray-600 pt-1 font-bold uppercase">
              Authorized Signatory / Warehouse
            </div>
          </div>
        </div>

      </div>

      {/* Print Specific CSS Rules */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, [data-sidebar], header, nav {
            display: none !important;
          }
          .blank-sheet-root {
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

    </div>
  )
}
