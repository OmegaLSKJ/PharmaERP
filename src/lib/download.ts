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

export function exportVisibleTables(filename: string) {
  const tables = Array.from(document.querySelectorAll('table'))
  const rows = tables.flatMap((table, tableIndex) => {
    const tableRows = Array.from(table.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => csvCell(cell.textContent ?? '')).join(','))
    return tableIndex ? ['', ...tableRows] : tableRows
  })
  if (!rows.length) rows.push(csvCell(document.querySelector('main')?.textContent ?? document.body.textContent ?? ''))
  save(filename.endsWith('.csv') ? filename : `${filename}.csv`, `\uFEFF${rows.join('\r\n')}`, 'text/csv;charset=utf-8')
}

export function exportJson(filename: string, data: unknown) {
  save(filename.endsWith('.json') ? filename : `${filename}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

export function downloadCsvTemplate(filename: string, headers: string[]) {
  save(filename.endsWith('.csv') ? filename : `${filename}.csv`, `\uFEFF${headers.map(csvCell).join(',')}\r\n`, 'text/csv;charset=utf-8')
}
