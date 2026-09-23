import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Download, Printer, RefreshCw, Search, BookOpen, ChevronLeft, ChevronRight,
  Database, Info, ArrowLeft, ExternalLink, X
} from 'lucide-react'
import { getErp } from '../../lib/erpApi'
import { openTransactionWindow } from '../../lib/windowUtils'
import { REPORTS, type ReportId } from './catalog'
import { buildPurchaseReport, csvReport, formatCell } from './engine'
import type { Filters, PurchaseData, ReportColumn, ReportRow } from './types'
import '../sale-analysis/sale-analysis.css'

const emptyFilters: Filters = { from: '', to: '', supplier: '', company: '', item: '', search: '' }
const initial = () => { const id = new URLSearchParams(window.location.search).get('report'); return REPORTS.find(row => row[0] === id)?.[0] ?? 'consolidated' }

export default function PurchaseAnalysis() {
  const [reportId, setReportId] = useState<ReportId>(initial)
  const [data, setData] = useState<PurchaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState({ key: 'date', direction: -1 })
  const [previousReport, setPreviousReport] = useState<ReportId | null>(null)
  const [breadcrumbLabel, setBreadcrumbLabel] = useState<string | null>(null)
  const [viewingUnallocatedModal, setViewingUnallocatedModal] = useState(false)

  const report = REPORTS.find(row => row[0] === reportId)!

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getErp<PurchaseData>('report-purchase-analysis'))
      setPage(1)
      setNotice('Live purchase report data refreshed.')
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Unable to load purchase report data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const unallocatedBills = useMemo(() => {
    if (!data) return []
    return data.records.filter(r => r.type === 'PURCHASE' && (r.detail === 'Purchase bill has no item lines' || (r.company === 'Unallocated' && r.document)))
  }, [data])

  const result = useMemo(() => data ? buildPurchaseReport(reportId, data, filters) : { rows: [], columns: [], totals: {} }, [data, reportId, filters])
  const sorted = useMemo(() => [...result.rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    if (av == null) return bv == null ? 0 : 1
    if (bv == null) return -1
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'en', { numeric: true })) * sort.direction
  }), [result, sort])

  const invalid = Boolean(filters.from && filters.to && filters.from > filters.to)
  const ready = Boolean(data && !loading && !error && !invalid)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize)), currentPage = Math.min(page, pageCount)
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const update = (key: keyof Filters, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1) }

  const select = (id: ReportId) => {
    setReportId(id)
    setPage(1)
    setFilters(previous => ({ ...previous, search: '' }))
    setSort({ key: id === 'monthly' ? 'month' : 'date', direction: -1 })
    setPreviousReport(null)
    setBreadcrumbLabel(null)
  }

  function drilldownToUnallocated() {
    setPreviousReport(reportId)
    setBreadcrumbLabel('Unallocated Purchase Bills (Header-only bills without lines)')
    setReportId('purchases')
    setFilters({ ...emptyFilters, search: 'Purchase bill has no item lines' })
    setPage(1)
    setNotice('Showing unallocated bills in Purchase Book.')
  }

  function drilldownToCompany(companyId: string, companyName: string) {
    if (companyName === 'Unallocated') {
      drilldownToUnallocated()
      return
    }
    setPreviousReport('company')
    setBreadcrumbLabel(`Company: ${companyName}`)
    setReportId('purchases')
    setFilters({ ...emptyFilters, company: companyId })
    setPage(1)
    setNotice(`Filtered Purchase Book by ${companyName}.`)
  }

  function drilldownToSupplier(supplierId: string, supplierName: string) {
    setPreviousReport('party')
    setBreadcrumbLabel(`Supplier: ${supplierName}`)
    setReportId('purchases')
    setFilters({ ...emptyFilters, supplier: supplierId })
    setPage(1)
    setNotice(`Filtered Purchase Book by ${supplierName}.`)
  }

  function drilldownToItem(itemId: string, itemName: string) {
    setPreviousReport(reportId)
    setBreadcrumbLabel(`Item: ${itemName}`)
    setReportId('purchases')
    setFilters({ ...emptyFilters, item: itemId })
    setPage(1)
    setNotice(`Filtered Purchase Book by ${itemName}.`)
  }

  const exportCSV = () => {
    if (!ready || !data || !sorted.length) return
    const metadata = [
      ['Report', report[1]], ['Organization', data.organization], ['Source', 'Live Supabase'],
      ['Loaded at', data.loadedAt], ['Period', `${filters.from || 'Earliest'} to ${filters.to || 'Latest'}`],
      ['Supplier', data.options.suppliers.find(row => row.id === filters.supplier)?.name || 'All'],
      ['Company', data.options.companies.find(row => row.id === filters.company)?.name || 'All'],
      ['Item', data.options.items.find(row => row.id === filters.item)?.name || 'All'],
      ['Currency', 'INR'], ['Basis', report[2]],
      ['Unavailable values', 'Blank; totals are blank when included values are unknown'], []
    ]
    const totals = { ...result.totals, [result.columns[0].key]: 'Filtered total' }
    const content = csvReport(Object.keys(result.totals).length ? [...sorted, totals] : sorted, result.columns, metadata)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `purchase-analysis-${reportId}-${filters.from || 'start'}-${filters.to || 'latest'}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(`Exported all ${sorted.length} filtered rows.`)
  }

  const table = (rows: ReportRow[]) => (
    <table>
      <caption className="sr-only">{report[1]}; amounts in INR; a dash means unavailable</caption>
      <thead>
        <tr>
          {result.columns.map(column => (
            <th key={column.key} scope="col" className={column.format ? 'sa-number' : ''}>
              <button type="button" onClick={() => setSort(current => ({ key: column.key, direction: current.key === column.key ? -current.direction : 1 }))}>
                {column.label}<span aria-hidden>{sort.key === column.key ? sort.direction === 1 ? ' ↑' : ' ↓' : ' ↕'}</span>
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.id || row.documentId || index)}>
            {result.columns.map(column => {
              const val = row[column.key]

              // Open document in new window
              if ((reportId === 'purchases' || reportId === 'consolidated') && column.key === 'document' && val) {
                const docId = String(row.documentId || '').replace(/^purchase:/, '')
                return (
                  <td key={column.key}>
                    <button
                      type="button"
                      className="sa-doc-link"
                      title={`Open purchase bill ${val} in new window`}
                      onClick={(e) => {
                        e.stopPropagation()
                        openTransactionWindow(`/transactions/purchase/${docId || val}`)
                      }}
                    >
                      <span>{String(val)}</span>
                      <ExternalLink size={11} />
                    </button>
                  </td>
                )
              }

              // Company drilldown
              if (reportId === 'company' && column.key === 'company') {
                if (val === 'Unallocated') {
                  return (
                    <td key={column.key}>
                      <div className="sa-cell-flex">
                        <span style={{ fontWeight: 600 }}>Unallocated</span>
                        <button
                          type="button"
                          className="sa-drilldown-pill"
                          title="View exact bill number, date, supplier, and open in new window"
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewingUnallocatedModal(true)
                          }}
                        >
                          View bill{unallocatedBills.length !== 1 ? 's' : ''} ({unallocatedBills.length}) →
                        </button>
                      </div>
                    </td>
                  )
                }
                return (
                  <td key={column.key}>
                    <button
                      type="button"
                      className="sa-drilldown-link"
                      title={`View ${val} bills in Purchase Book`}
                      onClick={() => drilldownToCompany(String(row.companyId || ''), String(val))}
                    >
                      <span>{String(val)}</span>
                      <ChevronRight size={12} />
                    </button>
                  </td>
                )
              }

              // Supplier drilldown
              if ((reportId === 'party' || reportId === 'summary') && column.key === 'supplier' && val) {
                return (
                  <td key={column.key}>
                    <button
                      type="button"
                      className="sa-drilldown-link"
                      title={`View ${val} bills in Purchase Book`}
                      onClick={() => drilldownToSupplier(String(row.supplierId || ''), String(val))}
                    >
                      <span>{String(val)}</span>
                      <ChevronRight size={12} />
                    </button>
                  </td>
                )
              }

              // Item drilldown
              if (reportId === 'item' && column.key === 'item' && val) {
                return (
                  <td key={column.key}>
                    <button
                      type="button"
                      className="sa-drilldown-link"
                      title={`View ${val} in Purchase Book`}
                      onClick={() => drilldownToItem(String(row.itemId || ''), String(val))}
                    >
                      <span>{String(val)}</span>
                      <ChevronRight size={12} />
                    </button>
                  </td>
                )
              }

              return (
                <td key={column.key} className={`${column.format ? 'sa-number' : ''} ${typeof val === 'number' && val < 0 ? 'sa-negative' : ''}`}>
                  {formatCell(val, column)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr>
            {result.columns.map((column, index) => (
              <td key={column.key} className={column.format ? 'sa-number' : ''}>
                {index === 0 ? 'Filtered total' : Object.prototype.hasOwnProperty.call(result.totals, column.key) ? formatCell(result.totals[column.key], column) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )

  const metrics: ReportColumn[] = result.columns.filter(column => column.total && column.format === 'money').filter(column => ['total', 'net', 'discount', 'activityValue'].includes(column.key)).slice(-3)

  return (
    <div className="sale-analysis">
      <header className="sa-heading">
        <div>
          <div className="sa-eyebrow">REPORTS / PURCHASE ANALYSIS</div>
          <h1>{report[1]}</h1>
          <p>{REPORTS.length} report views · Existing ERP data · Read-only</p>
        </div>
        <div className="sa-actions">
          <button type="button" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => window.print()} disabled={!ready}>
            <Printer size={15} /> Print / PDF
          </button>
          <button type="button" className="sa-primary" onClick={exportCSV} disabled={!ready || !sorted.length}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </header>

      <div className="sa-body">
        <nav className="sa-catalog" aria-label="Purchase Analysis reports">
          <section>
            <h2>Purchase analysis</h2>
            {REPORTS.map(row => (
              <button key={row[0]} type="button" aria-current={row[0] === reportId ? 'page' : undefined} onClick={() => select(row[0])}>
                <BookOpen size={13} />
                <span>{row[1]}</span>
              </button>
            ))}
          </section>
        </nav>

        <div className="sa-content">
          {loading && <div className="sa-message" role="status"><RefreshCw size={17} className="animate-spin" /> Loading all purchase report records from Supabase…</div>}
          {error && <div className="sa-error" role="alert"><strong>Purchase reports could not be loaded</strong><p>{error}</p><button type="button" onClick={() => void reload()}>Retry connection</button></div>}

          {!loading && !error && data && (
            <>
              <div className="sa-source">
                <Database size={16} />
                <span><strong>{data.organization}</strong> · Live Supabase · Loaded {new Date(data.loadedAt).toLocaleString('en-IN')}</span>
              </div>

              <section className="sa-metrics" aria-label="Report totals">
                {metrics.map(column => (
                  <div key={column.key}>
                    <span>{column.label}</span>
                    <strong>{formatCell(result.totals[column.key], column)}</strong>
                    <small>{result.totals[column.key] === null ? 'Source detail is incomplete' : 'Matching current filters'}</small>
                  </div>
                ))}
                <div><span>Report rows</span><strong>{sorted.length.toLocaleString('en-IN')}</strong><small>All pages included in exports</small></div>
              </section>

              <section className="sa-filters" aria-label="Report filters">
                <label>From date<input type="date" value={filters.from} onChange={e => update('from', e.target.value)} /></label>
                <label>To date<input type="date" value={filters.to} onChange={e => update('to', e.target.value)} /></label>
                {([{ key: 'supplier', label: 'Supplier', values: data.options.suppliers }, { key: 'company', label: 'Company', values: data.options.companies }, { key: 'item', label: 'Item', values: data.options.items }] as const).map(field => (
                  <label key={field.key}>
                    {field.label}
                    <select value={filters[field.key]} onChange={e => update(field.key, e.target.value)}>
                      <option value="">All {field.label.toLowerCase()}s</option>
                      {[...field.values].sort((a, b) => a.name.localeCompare(b.name)).map(option => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <button type="button" className="sa-reset" onClick={() => { setFilters(emptyFilters); setPage(1); setPreviousReport(null); setBreadcrumbLabel(null) }}>
                  Reset filters
                </button>
              </section>

              {invalid && <p className="sa-error" role="alert">From date must be on or before To date.</p>}

              {!invalid && (
                <section className="sa-report">
                  {previousReport && (
                    <div className="sa-breadcrumb-bar">
                      <button
                        type="button"
                        className="sa-back-btn"
                        onClick={() => {
                          setReportId(previousReport)
                          setPreviousReport(null)
                          setBreadcrumbLabel(null)
                          setFilters(emptyFilters)
                        }}
                      >
                        <ArrowLeft size={14} /> Back to {REPORTS.find(r => r[0] === previousReport)?.[1] || 'Summary'}
                      </button>
                      <span className="sa-breadcrumb-note">
                        {breadcrumbLabel || 'Filtered view'}
                      </span>
                    </div>
                  )}

                  <div className="sa-table-toolbar">
                    <h2>{report[1]} <span>{sorted.length}</span></h2>
                    <label className="sa-search">
                      <Search size={15} />
                      <span className="sr-only">Search report</span>
                      <input type="search" value={filters.search} placeholder="Search this report…" onChange={e => update('search', e.target.value)} />
                    </label>
                  </div>

                  <div className="sa-table-scroll" role="region" aria-label="Purchase report table" tabIndex={0}>
                    {table(pageRows)}
                    {!sorted.length && (
                      <div className="sa-empty">
                        <BookOpen size={28} />
                        <h3>No matching records</h3>
                        <p>No source records match this report and the selected filters.</p>
                        <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); setPreviousReport(null); setBreadcrumbLabel(null) }}>
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sa-pagination">
                    <span>{sorted.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)}` : '0'} of {sorted.length} rows · INR · — = unavailable</span>
                    <div>
                      <label>Rows <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
                      <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>
                      <span>{currentPage} / {pageCount}</span>
                      <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button>
                    </div>
                  </div>
                </section>
              )}

              <details className="sa-basis" open>
                <summary><Info size={15} /> Report basis</summary>
                <p>{report[2]}</p>
              </details>

              {data.warnings.length > 0 && (
                <details className="sa-basis sa-quality">
                  <summary>Source data notes ({data.warnings.length})</summary>
                  <ul>
                    {data.warnings.map(note => {
                      const isHeaderOnly = note.includes('have no item lines') || note.includes('Unallocated bill values')
                      return (
                        <li key={note} className="sa-warning-item">
                          <span>{note}</span>
                          {isHeaderOnly && (
                            <button
                              type="button"
                              className="sa-warning-btn"
                              title="Inspect unallocated bills in modal"
                              onClick={() => setViewingUnallocatedModal(true)}
                            >
                              View Bills ({unallocatedBills.length}) →
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}

              <details className="sa-basis">
                <summary>Loaded source records</summary>
                <div className="sa-counts">{Object.entries(data.counts).map(([table, count]) => <span key={table}>{table.replace(/_/g, ' ')} <strong>{count.toLocaleString('en-IN')}</strong></span>)}</div>
              </details>
            </>
          )}

          <div className="sa-status" role="status" aria-live="polite">{notice}</div>
        </div>
      </div>

      {viewingUnallocatedModal && createPortal(
        <div className="sa-modal-backdrop" onClick={() => setViewingUnallocatedModal(false)}>
          <div className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="sa-modal-title" onClick={e => e.stopPropagation()}>
            <header className="sa-modal-header">
              <div>
                <h2 id="sa-modal-title">Unallocated Purchase Bills (Missing Item Lines)</h2>
                <p>{unallocatedBills.length} posted bill{unallocatedBills.length !== 1 ? 's' : ''} recorded in Supabase without line-item medicine details.</p>
              </div>
              <button type="button" className="sa-modal-close" onClick={() => setViewingUnallocatedModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="sa-modal-body">
              <table className="sa-modal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill #</th>
                    <th>Supplier</th>
                    <th className="sa-number">Bill value</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unallocatedBills.map((bill, idx) => {
                    const docId = String(bill.documentId || '').replace(/^purchase:/, '')
                    return (
                      <tr key={bill.id || bill.documentId || idx}>
                        <td>{bill.date || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{bill.document || '—'}</td>
                        <td>{bill.supplier || 'Unassigned'}</td>
                        <td className="sa-number" style={{ fontWeight: 600 }}>
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(bill.total)}
                        </td>
                        <td><span className="sa-badge-status">{bill.status || 'posted'}</span></td>
                        <td>
                          <div className="sa-action-group">
                            <button
                              type="button"
                              className="sa-btn-sm sa-btn-primary"
                              title="Open bill in new window"
                              onClick={() => openTransactionWindow(`/transactions/purchase/${docId || bill.document}`)}
                            >
                              <ExternalLink size={12} /> Open in new window
                            </button>
                            <button
                              type="button"
                              className="sa-btn-sm"
                              title="View row in Purchase Book"
                              onClick={() => {
                                setViewingUnallocatedModal(false)
                                drilldownToUnallocated()
                              }}
                            >
                              View in Purchase Book →
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="sa-modal-footer-note">
                <Info size={14} />
                <span>
                  These totals are preserved under <strong>Unallocated</strong> so company-wise and purchase registers match 100%. Opening the bill in a new window allows you to view or edit line items.
                </span>
              </div>
            </div>
            <footer className="sa-modal-actions">
              <div className="sa-modal-actions-left">
                <button
                  type="button"
                  className="sa-modal-btn-primary"
                  onClick={() => {
                    setViewingUnallocatedModal(false)
                    drilldownToUnallocated()
                  }}
                >
                  <BookOpen size={14} />
                  <span>View in Purchase Book ({unallocatedBills.length}) →</span>
                </button>
              </div>
              <div className="sa-modal-actions-right">
                <button type="button" className="sa-btn-secondary" onClick={() => setViewingUnallocatedModal(false)}>
                  Close
                </button>
              </div>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
