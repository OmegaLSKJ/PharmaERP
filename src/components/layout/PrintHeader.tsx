import { useUIStore } from '../../store/uiStore'

interface PrintHeaderProps {
  title: string
  subtitle?: string
}

export default function PrintHeader({ title, subtitle }: PrintHeaderProps) {
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
    jurisdiction: storeCompany.jurisdiction || 'Biswanath',
  }

  const now = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="hidden print:block w-full mb-3 text-black font-sans select-text">
      {/* Framed Header Box */}
      <div className="border-[1.5px] border-black bg-white">
        {/* Top Grid: Branding on Left (7 cols) + Document Badge on Right (5 cols) */}
        <div className="grid grid-cols-12 border-b-[1.5px] border-black">
          {/* Left: Logo & Company Information */}
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

          {/* Right: Document Badge & Audit Metadata */}
          <div className="col-span-5 p-2.5 flex flex-col justify-between text-right">
            <div className="text-center border-[1.5px] border-black bg-white py-1 px-3 font-black tracking-widest text-[13px] text-black uppercase mb-1">
              {title}
            </div>
            <div className="text-[10px] text-left space-y-0.5 mt-1 border border-black p-1.5 bg-gray-50/50">
              {subtitle && (
                <div className="flex justify-between font-bold text-[#0c2f66]">
                  <span>Period / Scope:</span>
                  <span className="text-right">{subtitle}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Generated On:</span>
                <span className="font-bold">{now}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Report Type:</span>
                <span className="font-semibold uppercase text-[9px]">Official Audited Report</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sub-bar: Bank Details & Legal Jurisdiction */}
        <div className="px-2 py-1 bg-gray-50/60 flex justify-between items-center text-[8.5px] font-bold text-gray-700">
          <div>
            <strong>Bank:</strong> {company.bankName} | <strong>A/C:</strong>{' '}
            <span className="font-mono">{company.accountNo}</span> | <strong>IFSC:</strong>{' '}
            <span className="font-mono">{company.ifsc}</span>
          </div>
          <div>
            Subject to {company.jurisdiction.toUpperCase()} Jurisdiction &bull; Computer Generated Statement
          </div>
        </div>
      </div>
    </div>
  )
}
