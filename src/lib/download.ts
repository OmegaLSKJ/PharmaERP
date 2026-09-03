import type { CompanyProfile } from '../store/uiStore'

function save(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""').trim()}"`

function companyHeaderRows(reportTitle: string, company?: CompanyProfile): string {
  if (!company) return ''
  const now = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const identityParts: string[] = []
  if (company.gstin) identityParts.push(`GSTIN: ${company.gstin}`)
  if (company.dlNo)   identityParts.push(`D.L. No: ${company.dlNo}`)
  if (company.pan)    identityParts.push(`PAN: ${company.pan}`)

  const lines: string[] = [
    csvCell(company.companyName.toUpperCase()),
    csvCell(
      [company.address, company.pincode ? `– ${company.pincode}` : '', company.state].filter(Boolean).join(' ')
    ),
    identityParts.length ? csvCell(identityParts.join('  |  ')) : '',
    company.phone || company.email
      ? csvCell([company.phone && `Ph: ${company.phone}`, company.email && `E: ${company.email}`].filter(Boolean).join('  |  '))
      : '',
    csvCell(`Report: ${reportTitle}  |  Generated: ${now}`),
    '',  // blank separator row
  ]

  return lines.filter((l) => l !== undefined).join('\r\n') + '\r\n'
}

export function exportVisibleTables(filename: string, company?: CompanyProfile) {
  const tables = Array.from(document.querySelectorAll('table'))
  const rows = tables.flatMap((table, tableIndex) => {
    const tableRows = Array.from(table.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => csvCell(cell.textContent ?? '')).join(','))
    return tableIndex ? ['', ...tableRows] : tableRows
  })
  if (!rows.length) rows.push(csvCell(document.querySelector('main')?.textContent ?? document.body.textContent ?? ''))
  const reportTitle = filename.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const header = companyHeaderRows(reportTitle, company)
  const baseName = filename.endsWith('.csv') ? filename : `${filename}.csv`
  save(baseName, `\uFEFF${header}${rows.join('\r\n')}`, 'text/csv;charset=utf-8')
}

export function exportJson(filename: string, data: unknown) {
  save(filename.endsWith('.json') ? filename : `${filename}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

export function downloadCsvTemplate(filename: string, headers: string[]) {
  save(filename.endsWith('.csv') ? filename : `${filename}.csv`, `\uFEFF${headers.map(csvCell).join(',')}\r\n`, 'text/csv;charset=utf-8')
}
