import React from 'react'
import { numberToWordsIndian } from '../../lib/numberToWords'
import { useUIStore } from '../../store/uiStore'

export interface VoucherPrintLine {
  sNo: number
  ledger: string
  debit: number
  credit: number
  narration?: string
}

export interface VoucherPrintData {
  voucherType: string // 'Receipt' | 'Payment' | 'Contra' | 'Journal' | 'Debit Note' | 'Credit Note'
  voucherNo: string
  voucherDate: string
  physicalVoucherNo?: string
  paymentMode?: string // 'Cash' | 'Bank' | 'Online' | 'Adjust'
  primaryAccount?: string // e.g. 'Cash Account' or 'HDFC Bank'
  partyAccount?: string // e.g. 'MedPlus Chemist'
  bankRefNo?: string // Cheque / UTR / NEFT ref
  lines: VoucherPrintLine[]
  totalAmount: number
  narration?: string
}

export default function VoucherPrint({ data }: { data: VoucherPrintData }) {
  const storeCompany = useUIStore((s) => s.company)

  const company = {
    name: storeCompany.companyName || 'BORGANG DRUG DISTRIBUTORS',
    address: storeCompany.address || 'BORGANG, BISWANATH, ASSAM',
    city: storeCompany.city || 'BORGANG',
    pincode: storeCompany.pincode || '784167',
    state: storeCompany.state || 'Assam',
    phone: storeCompany.phone || '9435082103',
    email: storeCompany.email || 'borgangdrugdistributors@gmail.com',
    gstin: storeCompany.gstin || '18AKWPP4417G1ZN',
    dlNo: storeCompany.dlNo || 'DNG/622/623',
    pan: storeCompany.pan || 'AKWPP4417G',
    bankName: storeCompany.bankName || 'PUNJAB NATIONAL BANK',
    accountNo: storeCompany.accountNo || '1125250029704',
    ifsc: storeCompany.ifsc || 'PUNB0112520',
  }

  const vType = (data.voucherType || 'Payment').toUpperCase()
  const docTitle = vType.endsWith('VOUCHER') || vType.endsWith('NOTE') ? vType : `${vType} VOUCHER`
  const vDate = data.voucherDate || new Date().toISOString().slice(0, 10)

  // Ensure balanced entries
  const processedLines: VoucherPrintLine[] =
    data.lines && data.lines.length > 0
      ? data.lines.map((l, i) => ({
          sNo: l.sNo || i + 1,
          ledger: l.ledger,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration || '',
        }))
      : [
          {
            sNo: 1,
            ledger: data.partyAccount || 'Party Ledger',
            debit: data.voucherType.toLowerCase() === 'payment' ? data.totalAmount : 0,
            credit: data.voucherType.toLowerCase() === 'receipt' ? data.totalAmount : 0,
            narration: data.narration || '',
          },
          {
            sNo: 2,
            ledger: data.primaryAccount || 'Cash / Bank Account',
            debit: data.voucherType.toLowerCase() === 'receipt' ? data.totalAmount : 0,
            credit: data.voucherType.toLowerCase() === 'payment' ? data.totalAmount : 0,
            narration: data.bankRefNo ? `Ref: ${data.bankRefNo}` : '',
          },
        ]

  const totalDebit = processedLines.reduce((acc, l) => acc + l.debit, 0)
  const totalCredit = processedLines.reduce((acc, l) => acc + l.credit, 0)
  const grandTotal = Math.max(totalDebit, totalCredit, data.totalAmount || 0)
  const words = numberToWordsIndian(Math.round(grandTotal))

  // Filler rows to ensure minimum vertical box height
  const minRows = Math.max(1, 6 - processedLines.length)
  const fillerRows = Array.from({ length: minRows }, (_, idx) => idx)

  return (
    <div className="voucher-print-bill bg-white text-black font-sans text-[11px] leading-tight select-text w-full mx-auto p-0">
      {/* Main Outer Box Border */}
      <div className="border-[1.5px] border-black">
        {/* Header Grid: Company Info (7 cols) + Voucher Metadata (5 cols) */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black">
          {/* Company Branding */}
          <div className="col-span-7 p-2.5 border-r-[1.5px] border-black flex items-start gap-2.5">
            <img
              src="/favicon.png"
              alt="Logo"
              className="w-10 h-10 object-contain mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <h1 className="text-[17px] font-extrabold text-[#0c2f66] tracking-tight leading-none uppercase mb-1">
                {company.name}
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
                  {company.dlNo && <span>D.L. No: {company.dlNo}</span>}
                  {company.pan && <span>PAN: {company.pan}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Voucher Title Badge & Number */}
          <div className="col-span-5 p-2.5 flex flex-col justify-between text-right">
            <div className="text-center border-[1.5px] border-black bg-white py-1 px-3 font-black tracking-widest text-[13px] text-black uppercase mb-1">
              {docTitle}
            </div>
            <div className="text-[10px] text-left space-y-0.5 mt-1 border border-black p-1.5 bg-gray-50/50">
              <div className="flex justify-between font-bold">
                <span>Voucher No:</span>
                <span className="font-mono text-[11px] text-[#0c2f66]">{data.voucherNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-bold">{vDate}</span>
              </div>
              {data.physicalVoucherNo && (
                <div className="flex justify-between text-gray-800">
                  <span>Physical Vch No:</span>
                  <span className="font-mono font-bold">{data.physicalVoucherNo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Mode:</span>
                <span className="font-bold uppercase">{data.paymentMode || 'Cash'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Account & Beneficiary Strip */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black text-[10px] p-2 bg-gray-50/40">
          <div className="col-span-6 border-r border-black pr-2">
            <span className="text-gray-600 font-bold uppercase text-[9px] block">
              {vType.includes('RECEIPT') ? 'Received Into (Debit Account):' : 'Paid From (Credit Account):'}
            </span>
            <span className="text-[11px] font-black uppercase text-black block">
              {data.primaryAccount || 'Cash Account'}
            </span>
          </div>
          <div className="col-span-6 pl-2">
            <span className="text-gray-600 font-bold uppercase text-[9px] block">
              {vType.includes('RECEIPT') ? 'Received From (Payer):' : 'Paid To / In Favour Of:'}
            </span>
            <span className="text-[11px] font-black uppercase text-[#0c2f66] block">
              {data.partyAccount || 'Direct Entry / Multi-line Voucher'}
            </span>
          </div>
        </div>

        {/* Voucher Line Items Table */}
        <table className="w-full border-collapse text-[9.5px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-[#d4ebf2] text-black border-b-[1.5px] border-black font-bold">
              <th className="border-r border-black py-1 px-1 text-center w-[35px]">#</th>
              <th className="border-r border-black py-1 px-2 text-left">Particulars / Ledger Account</th>
              <th className="border-r border-black py-1 px-1 text-left w-[200px]">Narration / Cheque Ref</th>
              <th className="border-r border-black py-1 px-1 text-right w-[95px]">Debit (₹)</th>
              <th className="py-1 px-1 text-right w-[95px]">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {processedLines.map((l) => (
              <tr key={l.sNo} className="border-b border-gray-300 font-semibold leading-tight">
                <td className="border-r border-black py-1.5 px-1 text-center text-gray-700 text-[9px]">
                  {l.sNo}
                </td>
                <td className="border-r border-black py-1.5 px-2 text-left font-bold text-black">
                  {l.ledger}
                </td>
                <td className="border-r border-black py-1.5 px-1 text-left text-gray-700 text-[9px]">
                  {l.narration || '—'}
                </td>
                <td className="border-r border-black py-1.5 px-1 text-right font-mono font-bold">
                  {l.debit > 0 ? l.debit.toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-1 text-right font-mono font-bold">
                  {l.credit > 0 ? l.credit.toFixed(2) : ''}
                </td>
              </tr>
            ))}

            {/* Filler Rows to maintain vertical grid */}
            {fillerRows.map((_, fIdx) => (
              <tr key={`fill-${fIdx}`} className="border-b border-gray-200/40 h-[22px]">
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="border-r border-black py-0.5">&nbsp;</td>
                <td className="py-0.5">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Grand Amount Bar */}
        <div className="grid grid-cols-12 border-t-[1.5px] border-black text-[10px] font-bold">
          <div className="col-span-8 p-2 border-r-[1.5px] border-black flex flex-col justify-between">
            <div>
              <div className="text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                Amount In Words:
              </div>
              <div className="text-[10.5px] font-black italic text-black">
                {words}
              </div>
            </div>
            {data.narration && (
              <div className="mt-2 text-[9px] text-gray-800 border-t border-gray-300 pt-1">
                <strong>Narration:</strong> {data.narration}
              </div>
            )}
            {data.bankRefNo && (
              <div className="mt-0.5 text-[8.5px] text-gray-700 font-mono">
                <strong>Bank / Instrument Ref:</strong> {data.bankRefNo}
              </div>
            )}
          </div>

          {/* Grand Total Box on Right */}
          <div className="col-span-4 p-2 bg-gray-50/60 flex flex-col justify-center">
            <div className="border-[1.5px] border-black bg-gray-100/70 p-2">
              <div className="text-[9.5px] uppercase tracking-wider font-bold text-gray-800">
                Voucher Total
              </div>
              <div className="text-[18px] font-black font-mono tracking-tight flex items-baseline justify-between text-black">
                <span>₹</span>
                <span>{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Three-part Signature Block */}
        <div className="border-t-[1.5px] border-black p-2 bg-white">
          <div className="grid grid-cols-3 text-center text-[9.5px] font-bold pt-7 pb-1">
            <div>
              <div className="border-t border-black w-36 mx-auto pt-0.5">Prepared By</div>
            </div>
            <div>
              <div className="border-t border-black w-36 mx-auto pt-0.5">Checked &amp; Verified By</div>
            </div>
            <div>
              <div className="border-t border-black w-44 mx-auto pt-0.5">
                Authorised Signatory
                <div className="text-[8px] font-normal text-gray-600 uppercase mt-0.5">For {company.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[7.5px] text-gray-500 mt-1">
        This is a Computer Generated Accounting Voucher &bull; Borgang Drug Distributors
      </div>
    </div>
  )
}
