import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Download, Printer, RefreshCw, Search, BookOpen, ChevronLeft, ChevronRight, Database, Info } from 'lucide-react'
import { getErp } from '../../lib/erpApi'
import { REPORTS, type ReportId } from './catalog'
import { buildAnalysisReport, csvReport, formatCell } from './engine'
import type { AnalysisData, Filters, ReportColumn, ReportRow } from './types'
import './sale-analysis.css'

const emptyFilters: Filters = { from: '', to: '', party: '', company: '', item: '', search: '' }
const initialReport = () => {
  const id = new URLSearchParams(window.location.search).get('report')
  return REPORTS.find(r => r.id === id)?.id ?? 'consolidated'
}
export default function SaleAnalysis() {
  const [reportId, setReportId] = useState<ReportId>(initialReport)
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState({ key: 'date', direction: -1 })
  const [printing, setPrinting] = useState(false)
  const generation = useRef(0)
  const report = REPORTS.find(r => r.id === reportId)!
  const reload = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError(''); setNotice('')
    try {
      const result = await getErp<AnalysisData>('report-sale-analysis')
      if (current === generation.current) { setData(result); setNotice('Live report data refreshed.'); setPage(1) }
    } catch (e) {
      if (current === generation.current) { setData(null); setError(e instanceof Error ? e.message : 'Unable to load the report data.') }
    } finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => { void reload(); return () => { generation.current++ } }, [reload])
  useEffect(() => {
    const before = () => { if (data && !loading && !error) flushSync(() => setPrinting(true)) }
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [data, loading, error])
  const result = useMemo(() => data ? buildAnalysisReport(reportId, data, filters) : { rows: [], columns: [], totals: {} }, [data, reportId, filters])
  const sorted = useMemo(() => [...result.rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    if (av == null) return bv == null ? 0 : 1
    if (bv == null) return -1
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'en', { numeric: true })) * sort.direction
  }), [result, sort])
  const invalidPeriod = reportId !== 'stock' && filters.from && filters.to && filters.from > filters.to
  const ready = Boolean(data && !loading && !error && !invalidPeriod)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize)), currentPage = Math.min(page, pageCount)
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  function filter(key: keyof Filters, value: string) { setFilters(prev => ({ ...prev, [key]: value })); setPage(1) }
  function selectReport(id: ReportId) {
    setReportId(id); setPage(1); setFilters(prev => ({ ...prev, search: '' })); setSort({ key: id === 'monthly' ? 'month' : 'date', direction: -1 })
    // React Router owns navigation; keep the selected report in component state.
  }
  function exportCSV() {
    if (!ready || !sorted.length || !data) return
    const totals = { ...result.totals, [result.columns[0].key]: 'Filtered total' }
    const metadata = [['Report', report.name], ['Organization', data.organization], ['Source', 'Live Supabase'], ['Loaded at', data.loadedAt], ['Period', reportId === 'stock' ? `As of ${filters.to || 'latest movement'}` : `${filters.from || 'Earliest'} to ${filters.to || 'Latest'}`], ['Party', reportId === 'stock' ? 'Not applicable' : data.options.parties.find(p => p.id === filters.party)?.name || 'All'], ['Company', data.options.companies.find(p => p.id === filters.company)?.name || 'All'], ['Item', data.options.items.find(p => p.id === filters.item)?.name || 'All'], ['Search', filters.search], ['Currency', 'INR'], ['Basis', report.note], ['Unavailable values', 'Blank; totals are also blank when any included value is unknown'], []]
    const content = csvReport(Object.keys(result.totals).length ? [...sorted, totals] : sorted, result.columns, metadata)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `sale-analysis-${reportId}-${filters.from || 'start'}-${filters.to || 'latest'}.csv`; document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice(`Exported all ${sorted.length} filtered rows.`)
  }
  function renderTable(rows: ReportRow[], print = false) {
    return <table><caption className="sr-only">{report.name}; amounts in INR; a dash means unavailable</caption><thead><tr>{result.columns.map(c => <th key={c.key} scope="col" className={c.format ? 'sa-number' : ''} aria-sort={sort.key === c.key ? sort.direction === 1 ? 'ascending' : 'descending' : undefined}>{print ? c.label : <button type="button" onClick={() => setSort(s => ({ key: c.key, direction: s.key === c.key ? -s.direction : 1 }))}>{c.label}<span aria-hidden>{sort.key === c.key ? sort.direction === 1 ? ' ↑' : ' ↓' : ' ↕'}</span></button>}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={String(r.id || r.documentId || i)}>{result.columns.map(c => <td key={c.key} className={`${c.format ? 'sa-number' : ''} ${typeof r[c.key] === 'number' && (r[c.key] as number) < 0 ? 'sa-negative' : ''}`}>{formatCell(r[c.key], c)}</td>)}</tr>)}</tbody>{rows.length > 0 && Object.keys(result.totals).length > 0 && <tfoot><tr>{result.columns.map((c, i) => <td key={c.key} className={c.format ? 'sa-number' : ''}>{i === 0 ? 'Filtered total' : Object.prototype.hasOwnProperty.call(result.totals, c.key) ? formatCell(result.totals[c.key], c) : ''}</td>)}</tr></tfoot>}</table>
  }
  const metrics: ReportColumn[] = (reportId === 'stock' ? [{ key: 'valuation', label: 'Stock value', format: 'money' }, { key: 'quantity', label: 'On-hand units', format: 'number' }] : reportId === 'collection' ? [{ key: 'salesValue', label: 'Sales incl. tax', format: 'money' }, { key: 'paidAmount', label: 'Collected', format: 'money' }] : result.columns.filter(c => c.total && c.format === 'money').filter(c => ['total', 'net', 'claimAmount', 'freeCost', 'activityValue', 'discount', 'margin'].includes(c.key)).slice(-3)) as ReportColumn[]
  return <div className="sale-analysis">
    <header className="sa-heading"><div><div className="sa-eyebrow">REPORTS / SALE ANALYSIS</div><h1>{report.name}</h1><p>16 report views · Existing ERP data · Read-only</p></div><div className="sa-actions"><button type="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button><button type="button" onClick={() => { flushSync(() => setPrinting(true)); window.print() }} disabled={!ready}><Printer size={15} /> Print / PDF</button><button type="button" className="sa-primary" onClick={exportCSV} disabled={!ready || !sorted.length}><Download size={15} /> Export CSV</button></div></header>
    <div className="sa-body"><nav className="sa-catalog" aria-label="Sale Analysis reports">{[...new Set(REPORTS.map(r => r.group))].map(group => <section key={group}><h2>{group}</h2>{REPORTS.filter(r => r.group === group).map(r => <button key={r.id} type="button" aria-current={r.id === reportId ? 'page' : undefined} onClick={() => selectReport(r.id)}><BookOpen size={13} /><span>{r.name}</span></button>)}</section>)}</nav>
    <div className="sa-content">
      {loading && <div className="sa-message" role="status"><RefreshCw size={17} className="animate-spin" /> Loading all report records from Supabase…</div>}
      {error && <div className="sa-error" role="alert"><strong>Reports could not be loaded</strong><p>{error}</p><button type="button" onClick={() => void reload()}>Retry connection</button></div>}
      {!loading && !error && data && <>
        <div className="sa-source"><Database size={16} /><span><strong>{data.organization}</strong> · Live Supabase · Loaded {new Date(data.loadedAt).toLocaleString('en-IN')}</span></div>
        <section className="sa-metrics" aria-label="Report totals">{metrics.map(c => <div key={c.key}><span>{c.label}</span><strong>{formatCell(result.totals[c.key], c)}</strong><small>{result.totals[c.key] === null ? 'Source detail is incomplete' : c.key === 'valuation' ? 'At current recorded cost' : 'Matching current filters'}</small></div>)}<div><span>Report rows</span><strong>{sorted.length.toLocaleString('en-IN')}</strong><small>All pages included in exports</small></div></section>
        <section className="sa-filters" aria-label="Report filters"><label>From date<input type="date" value={filters.from} disabled={reportId === 'stock'} onChange={e => filter('from', e.target.value)} /></label><label>{reportId === 'stock' ? 'Stock as of' : 'To date'}<input type="date" value={filters.to} onChange={e => filter('to', e.target.value)} /></label>{(['party', 'company', 'item'] as const).map(key => <label key={key}>{key === 'party' ? 'Party' : key === 'company' ? 'Company' : 'Item'}<select value={filters[key]} disabled={reportId === 'stock' && key === 'party'} onChange={e => filter(key, e.target.value)}><option value="">All {key === 'party' ? 'parties' : key === 'company' ? 'companies' : 'items'}</option>{[...(key === 'party' ? data.options.parties : key === 'company' ? data.options.companies : data.options.items)].sort((a, b) => a.name.localeCompare(b.name)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}<button type="button" className="sa-reset" onClick={() => { setFilters(emptyFilters); setPage(1) }}>Reset filters</button></section>
        {invalidPeriod && <p className="sa-error" role="alert">From date must be on or before To date.</p>}
        {!invalidPeriod && <section className="sa-report" aria-label="Report results"><div className="sa-table-toolbar"><h2>{report.name} <span>{sorted.length}</span></h2><label className="sa-search"><Search size={15} /><span className="sr-only">Search report</span><input type="search" value={filters.search} placeholder="Search this report…" onChange={e => filter('search', e.target.value)} /></label></div><div className="sa-table-scroll" role="region" aria-label="Report table" tabIndex={0}>{renderTable(pageRows)}{!sorted.length && <div className="sa-empty"><BookOpen size={28} /><h3>No matching records</h3><p>{reportId === 'claims' ? 'There are no matching recorded claims or incentives.' : 'No source records match this report and the selected filters.'}</p><button type="button" onClick={() => { setFilters(emptyFilters); setPage(1) }}>Clear filters</button></div>}</div><div className="sa-pagination"><span>{sorted.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)}` : '0'} of {sorted.length} rows · INR · — = unavailable</span><div><label>Rows <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label><button type="button" aria-label="Previous report page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button type="button" aria-label="Next report page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div></section>}
        <details className="sa-basis" open><summary><Info size={15} /> Report basis</summary><p>{report.note}</p></details>
        {data.warnings.length > 0 && <details className="sa-basis sa-quality"><summary>Source data notes ({data.warnings.length})</summary><ul>{data.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
        <details className="sa-basis"><summary>Loaded source records</summary><div className="sa-counts">{Object.entries(data.counts).map(([table, count]) => <span key={table}>{table.replace(/_/g, ' ')} <strong>{count.toLocaleString('en-IN')}</strong></span>)}</div></details>
      </>}
      <div className="sa-status" role="status" aria-live="polite">{notice}</div>
    </div></div>
    {printing && ready && data && createPortal(<section className="sale-analysis-print"><h1>{data.organization}</h1><h2>{report.name}</h2><p>Live Supabase · Loaded {new Date(data.loadedAt).toLocaleString('en-IN')} · INR · {sorted.length} filtered rows</p><p>{reportId === 'stock' ? `Stock as of ${filters.to || 'latest movement'}` : `Period: ${filters.from || 'Earliest'} to ${filters.to || 'Latest'}`} · Party: {reportId === 'stock' ? 'Not applicable' : data.options.parties.find(p => p.id === filters.party)?.name || 'All'} · Company: {data.options.companies.find(p => p.id === filters.company)?.name || 'All'} · Item: {data.options.items.find(p => p.id === filters.item)?.name || 'All'} · Search: {filters.search || 'None'}</p>{renderTable(sorted, true)}<p>{report.note}</p><p>A dash means source data is unavailable; totals also remain unavailable when any included value is unknown.</p></section>, document.body)}
  </div>
}
