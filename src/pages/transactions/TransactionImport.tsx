import { ChangeEvent, DragEvent, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'
import { downloadCsvTemplate } from '../../lib/download'
import { postErp } from '../../lib/erpApi'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'

type ImportRow = Record<string, string | number | boolean | null>
type ImportType = keyof typeof IMPORT_TYPES
type ImportResult = { type: string; importedRows: number; records: number }
type ImportHistory = ImportResult & { id: string; file: string; label: string; importedAt: string }

const IMPORT_TYPES = {
  parties: { label: 'Party master', required: ['code', 'party_type', 'legal_name'], headers: ['code', 'party_type', 'legal_name', 'phone', 'email', 'gstin', 'credit_limit', 'city', 'state', 'pincode', 'address', 'status'] },
  manufacturers: { label: 'Manufacturers', required: ['name'], headers: ['code', 'name', 'status'] },
  salts: { label: 'Salt master', required: ['code', 'name'], headers: ['code', 'name', 'composition', 'category'] },
  hsn: { label: 'HSN / SAC master', required: ['code'], headers: ['code', 'description', 'gst_rate'] },
  warehouses: { label: 'Locations / warehouses', required: ['code', 'name'], headers: ['code', 'name', 'warehouse_type', 'address', 'capacity', 'status'] },
  accounts: { label: 'Chart of accounts', required: ['code', 'name'], headers: ['code', 'name', 'account_type', 'account_group', 'opening_balance', 'status'] },
  items: { label: 'Item master', required: ['code', 'name'], headers: ['code', 'name', 'packing', 'manufacturer', 'salt', 'hsn_code', 'mrp', 'sale_rate', 'purchase_rate', 'status'] },
  'opening-stock': { label: 'Opening stock', required: ['item_code', 'batch', 'warehouse_code', 'quantity'], headers: ['item_code', 'batch', 'expiry', 'warehouse_code', 'quantity', 'mrp', 'remarks'] },
  sales: { label: 'Sales invoices', required: ['invoice_number', 'invoice_date', 'customer', 'item_code', 'batch', 'quantity', 'rate'], headers: ['invoice_number', 'invoice_date', 'customer', 'item_code', 'batch', 'quantity', 'free_quantity', 'rate', 'discount_percent', 'gst_rate'] },
  purchases: { label: 'Purchase invoices', required: ['invoice_number', 'invoice_date', 'supplier', 'item_code', 'batch', 'quantity', 'purchase_rate'], headers: ['invoice_number', 'supplier_invoice_number', 'invoice_date', 'supplier', 'item_code', 'batch', 'expiry', 'quantity', 'free_quantity', 'purchase_rate', 'discount_percent', 'gst_rate', 'mrp'] },
} as const

const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== ''
const normalizeCell = (value: unknown): ImportRow[string] => {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value ?? null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export default function TransactionImport() {
  const [type, setType] = useState<ImportType>('parties')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [history, setHistory] = useState<ImportHistory[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const showToast = useUIStore((state) => state.showToast)
  const config = IMPORT_TYPES[type]

  const resetFile = () => { setFile(null); setRows([]); setErrors([]); if (inputRef.current) inputRef.current.value = '' }

  const validate = (parsedRows: ImportRow[]) => {
    if (!parsedRows.length) return ['The selected file has no data rows.']
    if (parsedRows.length > 5000) return ['A single import is limited to 5,000 data rows. Split this file and try again.']
    const columns = new Set(parsedRows.flatMap((row) => Object.keys(row)))
    const problems = config.required.filter((column) => !columns.has(column)).map((column) => `Missing required column: ${column}`)
    parsedRows.forEach((row, index) => config.required.forEach((column) => { if (!hasValue(row[column])) problems.push(`Row ${index + 2}: ${column} is required.`) }))
    return problems.slice(0, 50)
  }

  const readFile = async (selected: File) => {
    resetFile()
    setReading(true)
    try {
      if (selected.size > 10 * 1024 * 1024) throw new Error('The file exceeds the 10 MB limit.')
      const extension = selected.name.split('.').pop()?.toLowerCase()
      let parsedRows: ImportRow[]
      if (extension === 'csv') {
        const parsed = await new Promise<Papa.ParseResult<ImportRow>>((resolve, reject) => Papa.parse<ImportRow>(selected, { header: true, skipEmptyLines: 'greedy', transformHeader: normalizeHeader, complete: resolve, error: reject, dynamicTyping: true }))
        if (parsed.errors.length) throw new Error(parsed.errors.slice(0, 3).map((entry) => `Row ${(entry.row ?? 0) + 2}: ${entry.message}`).join('; '))
        parsedRows = parsed.data
      } else if (extension === 'xlsx') {
        const matrix = await readSheet(selected)
        if (!matrix.length) throw new Error('The workbook is empty.')
        const headers = matrix[0].map(normalizeHeader)
        if (headers.some((header) => !header)) throw new Error('Every Excel column must have a header in the first row.')
        parsedRows = matrix.slice(1).filter((row) => row.some(hasValue)).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])))
      } else throw new Error('Choose a .csv or .xlsx file.')
      setFile(selected)
      setRows(parsedRows)
      setErrors(validate(parsedRows))
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unable to read this file.'])
    } finally { setReading(false) }
  }

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0]; if (selected) void readFile(selected) }
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); const selected = event.dataTransfer.files?.[0]; if (selected) void readFile(selected) }
  const importRows = async () => {
    if (!file || !rows.length || errors.length) return
    setImporting(true)
    try {
      const result = await postErp<ImportResult>('bulk-import', { type, rows })
      setHistory((current) => [{ ...result, id: crypto.randomUUID(), file: file.name, label: config.label, importedAt: new Date().toLocaleString() }, ...current])
      showToast(`${result.records} ${config.label.toLowerCase()} record${result.records === 1 ? '' : 's'} imported.`)
      resetFile()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      setErrors([message]); showToast(message)
    } finally { setImporting(false) }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-semibold text-foreground">Import ERP data</h1><p className="mt-1 text-sm text-muted-foreground">Start with your own CSV or Excel workbook. No sample business data is preloaded.</p></div>
        <div className="glass-surface rounded-xl px-3 py-2 text-xs text-muted-foreground"><Database className="mr-2 inline h-4 w-4 text-emerald-500" />Import order: masters → items → stock → transactions</div>
      </div>

      <section className="glass-surface space-y-4 rounded-2xl p-4 sm:p-5">
        <label className="block text-sm font-medium" htmlFor="import-type">What are you importing?</label>
        <select id="import-type" value={type} onChange={(event) => { setType(event.target.value as ImportType); resetFile() }} className="w-full sm:max-w-md">
          {Object.entries(IMPORT_TYPES).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
        </select>
        <div className={cn('rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10', dragging ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-background/30 hover:border-blue-500/60')} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          {reading ? <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-500" /> : <Upload className="mx-auto mb-3 h-8 w-8 text-blue-500" />}
          <p className="font-medium">Drop your {config.label.toLowerCase()} file here</p><p className="mt-1 text-xs text-muted-foreground">CSV and Excel (.xlsx), up to 10 MB and 5,000 rows</p>
          <input ref={inputRef} id="data-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onChoose} className="sr-only" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={reading} className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-xs active:scale-[0.98] transition disabled:opacity-50 cursor-pointer">Choose file</button>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background/30 p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">Use the exact column names</p><p className="text-xs text-muted-foreground">Required: {config.required.join(', ')}</p></div><button type="button" onClick={() => downloadCsvTemplate(`${type}-import-template`, [...config.headers])} className="glass-action inline-flex items-center justify-center gap-2 rounded-lg h-9 px-3.5 text-xs sm:text-sm font-medium hover:bg-secondary active:scale-[0.98] transition cursor-pointer"><Download size={15} />Download CSV template</button></div>
      </section>

      {(file || errors.length > 0) && <section className="glass-surface space-y-4 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{file?.name ?? 'File validation'}</h2><p className="text-xs text-muted-foreground">{rows.length.toLocaleString()} data rows detected</p></div><button type="button" aria-label="Remove selected file" onClick={resetFile} className="glass-action rounded-lg p-2 hover:bg-secondary transition active:scale-[0.98]"><X size={16} /></button></div>
        {errors.length > 0 ? <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"><p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={16} />Fix these issues before importing</p><ul className="max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div> : <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 size={17} />File structure is valid and ready to import.</div>}
        {rows.length > 0 && <div className="overflow-x-auto rounded-xl border border-border"><table className="min-w-full text-xs"><thead className="bg-background/70"><tr>{Object.keys(rows[0]).map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{header}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={index} className="border-t border-border">{Object.keys(rows[0]).map((header) => <td key={header} className="max-w-56 truncate whitespace-nowrap px-3 py-2 text-muted-foreground">{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table>{rows.length > 8 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Previewing 8 of {rows.length.toLocaleString()} rows.</p>}</div>}
        <div className="flex justify-end"><button type="button" onClick={importRows} disabled={!file || !rows.length || errors.length > 0 || importing} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 h-10 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs active:scale-[0.98] transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">{importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{importing ? 'Importing…' : `Import ${rows.length.toLocaleString()} rows`}</button></div>
      </section>}

      <section className="glass-surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">This session</h2><p className="text-xs text-muted-foreground">Completed imports appear here until you leave this page.</p></div>
        {history.length === 0 ? <div className="p-8 text-center"><FileSpreadsheet className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">No files imported yet</p><p className="mt-1 text-xs text-muted-foreground">Choose a data type, download its template, and upload your completed file.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="bg-background/50 text-muted-foreground"><th className="px-4 py-3 text-left">File</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Rows</th><th className="px-4 py-3 text-right">Records</th><th className="px-4 py-3 text-left">Imported</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{entry.file}</td><td className="px-4 py-3">{entry.label}</td><td className="px-4 py-3 text-right">{entry.importedRows.toLocaleString()}</td><td className="px-4 py-3 text-right text-emerald-400">{entry.records.toLocaleString()}</td><td className="px-4 py-3 text-muted-foreground">{entry.importedAt}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  )
}
