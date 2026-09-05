import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Link2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ArrowDownCircle,
  CheckCircle2
} from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'
import { deleteErp, getErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import TopTableScroller from '../../../components/common/TopTableScroller'

interface Map {
  id: string
  product: string
  code: string
  company: string
  batch: string
  unit: string
  stock: number
  cost: number
  purchase: number
  sale: number
  mrp: number
  value: number
  sales_scheme: string
  purchase_scheme: string
  received: string
  mfg: string
  exp: string
  supplier: string
  invoice_no: string
  invoice_date: string
  rack?: string
  status?: string
}

export default function ItemMapping() {
  const [mappings, setMappings] = useState<Map[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Chunking controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')

  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    getErp<any[]>('item-mappings')
      .then((rows) => {
        setMappings(
          rows.map((row) => {
            const getVal = (cleanKey: string, excelKeys: string[]) => {
              if (row[cleanKey] !== undefined) return row[cleanKey]
              for (const k of excelKeys) {
                if (row[k] !== undefined) return row[k]
                if (row[`${k} - nan`] !== undefined) return row[`${k} - nan`]
              }
              return undefined
            }

            const product =
              row.canonicalItem ?? getVal('product', ['Product Name', 'productName']) ?? row.supplierItem ?? ''
            const code = row.supplierItem ?? getVal('code', ['Code']) ?? ''
            const company = row.company ?? getVal('company', ['Company']) ?? ''
            const batch = row.batch ?? getVal('batch', ['Batch']) ?? ''
            const unit = row.unit ?? getVal('unit', ['Unit']) ?? row.packing ?? ''
            const stock = Number(row.stock ?? getVal('stock', ['Current Stock']) ?? 0)
            const cost = Number(row.costPrice ?? getVal('cost', ['Cost Price', 'Cost Price - Rate']) ?? 0)
            const purchase = Number(
              row.purchasePrice ?? getVal('purchase', ['Purchase Price', 'Purchase Price - Rate']) ?? 0
            )
            const sale = Number(row.salePrice ?? getVal('sale', ['Sales Price', 'Sales Price - Rate']) ?? 0)
            const mrp = Number(row.mrp ?? getVal('mrp', ['M.R.P.', 'M.R.P. - Rate']) ?? 0)
            const value = Number(row.reportedValue ?? getVal('value', ['Value', 'Value - At Cost']) ?? 0)

            // Scheme formatting
            const salesDeal =
              row.salesSchemeDeal ??
              row.sales_scheme?.split('+')[0] ??
              getVal('', ['Sales Scheme - Deal']) ??
              '0'
            const salesFree =
              row.salesSchemeFree ??
              row.sales_scheme?.split('+')[1] ??
              getVal('', ['Sales Scheme - Free', 'nan - Free']) ??
              '0'
            const purcDeal =
              row.purchaseSchemeDeal ??
              row.purchase_scheme?.split('+')[0] ??
              getVal('', ['Purc.Scheme - Deal', 'Purchase Scheme - Deal']) ??
              '0'
            const purcFree =
              row.purchaseSchemeFree ??
              row.purchase_scheme?.split('+')[1] ??
              getVal('', ['Purc.Scheme - Free', 'Purchase Scheme - Free']) ??
              '0'

            const received =
              row.receivedOn ?? getVal('received', ['Rec.Date', 'Received Date', 'received_date']) ?? ''
            const mfg = row.manufacturedOn ?? getVal('mfg', ['MFG', 'MFG - Date']) ?? '—'
            const exp = row.expiryOn ?? getVal('exp', ['EXP', 'EXP - Date']) ?? ''
            const supplier = row.supplier ?? getVal('supplier', ['Supplier', 'Supplier - Name']) ?? row.party ?? ''
            const invoice_no =
              row.invoiceNumber ?? row.invoice_no ?? getVal('invoice_no', ['Inv.No', 'Invoice No', 'invoiceNo']) ?? ''
            const invoice_date =
              row.invoiceDate ?? row.invoice_date ?? getVal('invoice_date', ['Inv.Date', 'Invoice Date', 'invoiceDate']) ?? ''
            const rack = row.rackNumber ?? row.rack ?? getVal('rack', ['Rack', 'Rack - Name']) ?? ''

            return {
              id: row.id,
              product: String(product),
              code: String(code),
              company: String(company),
              batch: String(batch),
              unit: String(unit),
              stock,
              cost,
              purchase,
              sale,
              mrp,
              value,
              sales_scheme: `${salesDeal}+${salesFree}`,
              purchase_scheme: `${purcDeal}+${purcFree}`,
              received: String(received),
              mfg: String(mfg),
              exp: String(exp),
              supplier: String(supplier),
              invoice_no: String(invoice_no),
              invoice_date: String(invoice_date),
              rack: String(rack),
              status: row.status === 'posted' ? 'active' : (row.status ?? 'active')
            }
          })
        )
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load mappings.'))
      .finally(() => setLoading(false))
  }, [showToast])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return mappings
    return mappings.filter(
      (m) =>
        m.product.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.batch.toLowerCase().includes(q) ||
        m.invoice_no.toLowerCase().includes(q) ||
        (m.rack && m.rack.toLowerCase().includes(q))
    )
  }, [mappings, search])

  // Reset pagination on search / pageSize change
  useEffect(() => {
    setCurrentPage(1)
    setContinuousCount(pageSize || 50)
  }, [search, pageSize])

  const totalItems = filtered.length
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / (pageSize || 50)) || 1

  const displayedItems = useMemo(() => {
    if (pageSize === 0) return filtered
    if (chunkMode === 'continuous') {
      return filtered.slice(0, continuousCount)
    }
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, chunkMode, currentPage, pageSize, continuousCount])

  const startIdx = totalItems === 0 ? 0 : pageSize === 0 ? 1 : chunkMode === 'continuous' ? 1 : (currentPage - 1) * pageSize + 1
  const endIdx =
    pageSize === 0
      ? totalItems
      : chunkMode === 'continuous'
      ? Math.min(continuousCount, totalItems)
      : Math.min(currentPage * pageSize, totalItems)

  const handleLoadMore = () => {
    setContinuousCount((prev) => Math.min(prev + (pageSize || 50), totalItems))
  }

  const addMapping = async () => {
    const product = window.prompt('Product name:')
    if (!product) return
    const code = window.prompt('Item / barcode code:', `ITM-${Date.now().toString().slice(-4)}`) ?? ''
    const company = window.prompt('Company / Manufacturer:') ?? ''
    try {
      const row = await postErp<any>('item-mappings', {
        product,
        code,
        company,
        batch: 'UNSPECIFIED',
        unit: 'NO.',
        stock: 0,
        cost: 0,
        purchase: 0,
        sale: 0,
        mrp: 0,
        value: 0,
        sales_scheme: '0+0',
        purchase_scheme: '0+0',
        received: new Date().toISOString().slice(0, 10),
        mfg: '—',
        exp: '',
        supplier: 'DIRECT',
        invoice_no: '',
        invoice_date: '',
        rack: '',
        status: 'posted'
      })
      setMappings((items) => [
        ...items,
        {
          id: row.id,
          product,
          code,
          company,
          batch: 'UNSPECIFIED',
          unit: 'NO.',
          stock: 0,
          cost: 0,
          purchase: 0,
          sale: 0,
          mrp: 0,
          value: 0,
          sales_scheme: '0+0',
          purchase_scheme: '0+0',
          received: new Date().toISOString().slice(0, 10),
          mfg: '—',
          exp: '',
          supplier: 'DIRECT',
          invoice_no: '',
          invoice_date: '',
          rack: '',
          status: 'active'
        }
      ])
      showToast('Item mapping saved.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save mapping.')
    }
  }

  const removeMapping = async (id: string) => {
    if (!window.confirm('Delete this mapping?')) return
    try {
      await deleteErp('item-mappings', id)
      setMappings((items) => items.filter((item) => item.id !== id))
      showToast('Mapping deleted.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete mapping.')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[100vw]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Item Mapping</h1>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              {totalItems.toLocaleString()} Mappings
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
            <Link2 size={14} className="text-indigo-400" />
            Imported stock mapping with fixed top scroller and continuous chunking
          </p>
        </div>
        <button
          onClick={addMapping}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> New Mapping
        </button>
      </div>

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search product, supplier, batch, invoice or rack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                chunkMode === 'paginated'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
                chunkMode === 'continuous'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Layers size={12} /> Continuous
            </button>
          </div>

          {/* Chunk Size */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>Chunk:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={500}>500 / page</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chunk Info Strip */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Showing <span className="font-semibold text-slate-200">{startIdx}</span> to{' '}
          <span className="font-semibold text-slate-200">{endIdx}</span> of{' '}
          <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> entries
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-slate-200 whitespace-nowrap shrink-0">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Top Fixed Scroller Wrapped Table */}
      <TopTableScroller
        shortcuts={[
          { label: 'Product', offsetPercent: 0 },
          { label: 'Batch / Stock', offsetPercent: 0.2 },
          { label: 'Prices & MRP', offsetPercent: 0.42 },
          { label: 'Schemes', offsetPercent: 0.65 },
          { label: 'Supplier & Inv', offsetPercent: 0.85 },
          { label: 'Rack', offsetPercent: 1.0 }
        ]}
      >
        <table className="w-full text-xs min-w-[2000px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <th className="text-left px-4 py-3 font-semibold">Product / Code</th>
              <th className="text-left px-4 py-3 font-semibold">Company</th>
              <th className="text-left px-4 py-3 font-semibold">Batch / Unit</th>
              <th className="text-right px-4 py-3 font-semibold">Stock</th>
              <th className="text-right px-4 py-3 font-semibold">Cost</th>
              <th className="text-right px-4 py-3 font-semibold">Purchase</th>
              <th className="text-right px-4 py-3 font-semibold">Sale</th>
              <th className="text-right px-4 py-3 font-semibold">MRP</th>
              <th className="text-right px-4 py-3 font-semibold">Value</th>
              <th className="text-center px-4 py-3 font-semibold">Sales Scheme</th>
              <th className="text-center px-4 py-3 font-semibold">Purchase Scheme</th>
              <th className="text-left px-4 py-3 font-semibold">Received</th>
              <th className="text-left px-4 py-3 font-semibold">Mfg / Expiry</th>
              <th className="text-left px-4 py-3 font-semibold">Supplier</th>
              <th className="text-left px-4 py-3 font-semibold">Invoice</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading && (
              <tr>
                <td colSpan={16} className="p-8 text-center text-slate-500 text-sm animate-pulse">
                  Loading mappings…
                </td>
              </tr>
            )}
            {!loading &&
              displayedItems.map((m) => (
                <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-white">
                    <div>{m.product}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{m.company}</td>
                  <td className="px-4 py-2.5 font-mono text-amber-400">
                    <div className="font-semibold">{m.batch}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.unit}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-200">{m.stock}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{formatCurrency(m.cost)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{formatCurrency(m.purchase)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{formatCurrency(m.sale)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 font-medium">{formatCurrency(m.mrp)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200 font-bold">{formatCurrency(m.value)}</td>
                  <td className="px-4 py-2.5 text-center text-slate-300 font-mono">{m.sales_scheme}</td>
                  <td className="px-4 py-2.5 text-center text-slate-300 font-mono">{m.purchase_scheme}</td>
                  <td className="px-4 py-2.5 text-slate-300 font-mono whitespace-nowrap">{m.received}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300 whitespace-nowrap">
                    <div>{m.mfg}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.exp}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{m.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    <div>{m.invoice_no || '—'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.invoice_date || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      aria-label={`Delete ${m.product}`}
                      onClick={() => removeMapping(m.id)}
                      className="p-1 hover:text-rose-400 text-slate-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && displayedItems.length === 0 && (
              <tr>
                <td colSpan={16} className="p-8 text-center text-slate-500 text-sm">
                  No mappings match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TopTableScroller>

      {/* Continuous Stream "Load Next Chunk" Button */}
      {chunkMode === 'continuous' && continuousCount < totalItems && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-slate-400">
            Loaded <span className="font-semibold text-slate-200">{endIdx}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> mappings (
            {Math.round((endIdx / totalItems) * 100)}%)
          </div>
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            <ArrowDownCircle size={15} /> Load Next {Math.min(pageSize || 50, totalItems - endIdx)} Mappings
          </button>
        </div>
      )}

      {chunkMode === 'continuous' && continuousCount >= totalItems && totalItems > 0 && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium shadow-xs">
          <CheckCircle2 size={14} /> All {totalItems.toLocaleString()} mappings loaded
        </div>
      )}

      {/* Bottom Pagination Footer */}
      {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shadow-xs">
          <div>
            Showing page <span className="font-medium text-slate-200">{currentPage}</span> of{' '}
            <span className="font-medium text-slate-200">{totalPages}</span> ({pageSize} per chunk)
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
            >
              <ChevronsLeft size={13} /> First
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="px-3 py-1 font-mono font-semibold text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
            >
              Next <ChevronRight size={13} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1"
            >
              Last <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
