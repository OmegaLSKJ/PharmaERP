import { useUIStore } from '../../store/uiStore'

interface PrintHeaderProps {
  title: string
  subtitle?: string
}

export default function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  const company = useUIStore((s) => s.company)
  const now = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  return (
    <div
      className="hidden print:block w-full"
      style={{
        fontFamily: "'Segoe UI', Arial, sans-serif",
        marginBottom: '10px',
        borderBottom: '2.5px solid #1a1a1a',
        paddingBottom: '8px',
      }}
    >
      {/* Top strip: company identity + document badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>

        {/* Left: Logo + Name + Address strip */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
          <img
            src="/favicon.png"
            alt="Logo"
            style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0, marginTop: '2px' }}
          />
          <div>
            {/* Company name */}
            <div style={{
              fontSize: '18px',
              fontWeight: '900',
              color: '#0c2f66',
              letterSpacing: '-0.02em',
              lineHeight: '1.1',
              textTransform: 'uppercase',
            }}>
              {company.companyName}
            </div>

            {/* Address line */}
            <div style={{ fontSize: '9px', color: '#333', marginTop: '2px', lineHeight: '1.5' }}>
              {company.address}{company.pincode && `, ${company.pincode}`}
              {company.city && company.city !== company.address && `, ${company.city}`}
              {company.state && ` – ${company.state}`}
            </div>

            {/* Key registration numbers */}
            <div style={{ fontSize: '8.5px', color: '#333', marginTop: '2px', lineHeight: '1.6', display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
              {company.gstin && (
                <span>
                  <strong>GSTIN:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{company.gstin}</span>
                </span>
              )}
              {company.dlNo && (
                <span>
                  <strong>D.L. No:</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{company.dlNo}</span>
                </span>
              )}
              {company.pan && (
                <span>
                  <strong>PAN:</strong>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{company.pan}</span>
                </span>
              )}
              {company.phone && (
                <span>
                  <strong>Ph:</strong> {company.phone}
                </span>
              )}
              {company.email && (
                <span>
                  <strong>E:</strong> {company.email.toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Document title + print timestamp */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '800',
            background: '#0c2f66',
            color: '#ffffff',
            padding: '4px 12px',
            borderRadius: '4px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'inline-block',
            marginBottom: '4px',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '8px', color: '#555', marginTop: '2px', fontWeight: 600 }}>
              {subtitle}
            </div>
          )}
          <div style={{ fontSize: '7.5px', color: '#888', marginTop: '3px' }}>
            Printed: {now}
          </div>
          {(company.fyStart || company.fyEnd) && (
            <div style={{ fontSize: '7.5px', color: '#888', marginTop: '1px' }}>
              FY: {company.fyStart?.slice(0, 7)} to {company.fyEnd?.slice(0, 7)}
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar: Bank details & Legal Jurisdiction */}
      {(company.bankName || company.accountNo || company.jurisdiction) && (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '4px',
            borderTop: '1px dashed #ccc',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '8px',
            color: '#555',
          }}
        >
          <div>
            {company.bankName && (
              <span>
                <strong>Bank:</strong> {company.bankName} | <strong>A/C No:</strong>{' '}
                <span style={{ fontFamily: 'monospace' }}>{company.accountNo}</span> | <strong>IFSC:</strong>{' '}
                <span style={{ fontFamily: 'monospace' }}>{company.ifsc}</span>
              </span>
            )}
          </div>
          <div>
            <span>
              Subject to {(company.jurisdiction || company.city || 'Biswanath').toUpperCase()} Jurisdiction &bull;
              Computer Generated Statement
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
