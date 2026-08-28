export default function PrintHeader({ title }: { title: string }) {
  return (
    <div className="hidden print:block w-full mb-3" style={{ borderBottom: '2px solid #111', paddingBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left: Company identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#000', letterSpacing: '-0.02em', lineHeight: '1.1', textTransform: 'uppercase' }}>
              Borgang Drug Distributors
            </div>
            <div style={{ fontSize: '9px', color: '#444', marginTop: '2px', lineHeight: '1.4' }}>
              Main Road, NH-52, Borgang, Biswanath, Assam
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace' }}>27AABCP1234F1Z5</span>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              admin@borgangdrugdistributors.com
            </div>
          </div>
        </div>

        {/* Right: Document title + date */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', background: '#111', color: '#fff', padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'inline-block' }}>
            {title}
          </div>
          <div style={{ fontSize: '8px', color: '#777', marginTop: '3px' }}>
            Printed: {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>
    </div>
  )
}
