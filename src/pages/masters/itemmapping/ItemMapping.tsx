import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Save,
  X,
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
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import TopTableScroller from '../../../components/common/TopTableScroller'
import { inferHsnForItem } from '../../../lib/hsnUtils'

interface Map {
  id: string
  product: string
  code: string
  company: string
  hsn?: string
  gstRate?: number
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
type MappingForm = Omit<Map, 'id' | 'status'>
const emptyMapping = (): MappingForm => ({ product: '', code: '', company: '', hsn: '3004', gstRate: 5, batch: '', unit: '', stock: 0, cost: 0, purchase: 0, sale: 0, mrp: 0, value: 0, sales_scheme: '0+0', purchase_scheme: '0+0', received: '', mfg: '', exp: '', supplier: '', invoice_no: '', invoice_date: '', rack: '' })

export default function ItemMapping() {
  const [mappings, setMappings] = useState<Map[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<MappingForm | null>(null)
  const [saving, setSaving] = useState(false)

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
            const inferred = inferHsnForItem(String(product))
            const hsn = row.hsn ?? getVal('hsn', ['HSN', 'hsn_code', 'hsnCode']) ?? inferred.code
            const gstRate = Number(row.gstRate ?? row.gst_rate ?? getVal('gstRate', ['GST%', 'GST Rate']) ?? inferred.gstRate)

            return {
              id: row.id,
              product: String(product),
              code: String(code),
              company: String(company),
              hsn: String(hsn),
              gstRate,
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
        (m.hsn && m.hsn.toLowerCase().includes(q)) ||
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

  const addMapping = () => { setEditingId(null); setEditor(emptyMapping()) }
  const editMapping = (mapping: Map) => { const { id: _id, status: _status, ...values } = mapping; setEditingId(mapping.id); setEditor(values) }
  const saveMapping = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor?.product.trim()) { showToast('Product name is required.'); return }
    setSaving(true)
    try {
      const payload = { ...editor, product: editor.product.trim() }
      const saved = editingId ? await patchErp<any>('item-mappings', editingId, payload) : await postErp<any>('item-mappings', payload)
      const row: Map = { ...payload, id: saved.id || editingId || '', status: 'active' }
      setMappings((items) => editingId ? items.map((item) => item.id === editingId ? row : item) : [row, ...items])
      setEditor(null); setEditingId(null); showToast(editingId ? 'Mapping updated.' : 'Mapping saved.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save mapping.')
    } finally {
      setSaving(false)
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Item Mapping</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {totalItems.toLocaleString()} Mappings
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            Imported stock mapping with fixed top scroller and continuous chunking
          </p>
        </div>
        <button
          onClick={addMapping}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition"
        >
          <Plus size={16} /> New Mapping
        </button>
      </div>

      {editor && (
        <form onSubmit={saveMapping} className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-4 shadow-sm text-card-foreground">
          <div className="flex items-center justify-between md:col-span-2 lg:col-span-4">
            <div>
              <h2 className="font-semibold text-foreground">{editingId ? 'Edit mapping' : 'New mapping'}</h2>
              <p className="text-xs text-muted-foreground">All mapping fields are editable. Stock movements remain in the inventory ledger.</p>
            </div>
            <button type="button" onClick={() => { setEditor(null); setEditingId(null) }} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <X size={18} />
            </button>
          </div>
          <MappingField label="Product *"><input required value={editor.product} onChange={(e) => setEditor({ ...editor, product: e.target.value })} /></MappingField>
          <MappingField label="Item code"><input value={editor.code} onChange={(e) => setEditor({ ...editor, code: e.target.value })} /></MappingField>
          <MappingField label="Company / manufacturer"><input value={editor.company} onChange={(e) => setEditor({ ...editor, company: e.target.value })} /></MappingField>
          <MappingField label="Unit"><input value={editor.unit} onChange={(e) => setEditor({ ...editor, unit: e.target.value })} /></MappingField>
          <MappingField label="Batch"><input value={editor.batch} onChange={(e) => setEditor({ ...editor, batch: e.target.value })} /></MappingField>
          <MappingNumber label="Stock" value={editor.stock} onChange={(stock) => setEditor({ ...editor, stock })} />
          <MappingNumber label="Cost price" value={editor.cost} onChange={(cost) => setEditor({ ...editor, cost })} />
          <MappingNumber label="Purchase price" value={editor.purchase} onChange={(purchase) => setEditor({ ...editor, purchase })} />
          <MappingNumber label="Sale price" value={editor.sale} onChange={(sale) => setEditor({ ...editor, sale })} />
          <MappingNumber label="MRP" value={editor.mrp} onChange={(mrp) => setEditor({ ...editor, mrp })} />
          <MappingNumber label="Reported value" value={editor.value} onChange={(value) => setEditor({ ...editor, value })} />
          <MappingField label="Sales scheme (deal+free)"><input value={editor.sales_scheme} onChange={(e) => setEditor({ ...editor, sales_scheme: e.target.value })} /></MappingField>
          <MappingField label="Purchase scheme (deal+free)"><input value={editor.purchase_scheme} onChange={(e) => setEditor({ ...editor, purchase_scheme: e.target.value })} /></MappingField>
          <MappingField label="Received date"><input type="date" value={editor.received} onChange={(e) => setEditor({ ...editor, received: e.target.value })} /></MappingField>
          <MappingField label="Manufactured date"><input type="date" value={editor.mfg} onChange={(e) => setEditor({ ...editor, mfg: e.target.value })} /></MappingField>
          <MappingField label="Expiry date"><input type="date" value={editor.exp} onChange={(e) => setEditor({ ...editor, exp: e.target.value })} /></MappingField>
          <MappingField label="Supplier"><input value={editor.supplier} onChange={(e) => setEditor({ ...editor, supplier: e.target.value })} /></MappingField>
          <MappingField label="Invoice number"><input value={editor.invoice_no} onChange={(e) => setEditor({ ...editor, invoice_no: e.target.value })} /></MappingField>
          <MappingField label="Invoice date"><input type="date" value={editor.invoice_date} onChange={(e) => setEditor({ ...editor, invoice_date: e.target.value })} /></MappingField>
          <MappingField label="Rack number"><input value={editor.rack || ''} onChange={(e) => setEditor({ ...editor, rack: e.target.value })} /></MappingField>
          <div className="flex justify-end gap-2 md:col-span-2 lg:col-span-4">
            <button type="button" onClick={() => { setEditor(null); setEditingId(null) }} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition">Cancel</button>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 shadow-xs"><Save size={15} /> {saving ? 'Saving…' : 'Save mapping'}</button>
          </div>
        </form>
      )}

      {/* Toolbar & Chunk Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search product, supplier, batch, invoice or rack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Mode Toggle */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
            <button
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition cursor-pointer',
                chunkMode === 'paginated'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pages
            </button>
            <button
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1 cursor-pointer',
                chunkMode === 'continuous'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers size={12} /> Continuous
            </button>
          </div>

          {/* Chunk Size */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Chunk:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-background border border-input text-foreground rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
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
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div>
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> entries
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-foreground font-semibold whitespace-nowrap shrink-0">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-card border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground shadow-2xs cursor-pointer"
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
            <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
              <th className="text-left px-4 py-3 font-semibold">Product / Code</th>
              <th className="text-left px-4 py-3 font-semibold">Company</th>
              <th className="text-left px-4 py-3 font-semibold">HSN / GST</th>
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
          <tbody className="divide-y divide-border text-foreground">
            {loading && (
              <tr>
                <td colSpan={17} className="p-8 text-center text-muted-foreground text-sm animate-pulse">
                  Loading mappings…
                </td>
              </tr>
            )}
            {!loading &&
              displayedItems.map((m) => (
                <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <div>{m.product}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{m.code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-foreground font-medium">{m.company}</td>
                  <td className="px-4 py-2.5 font-mono text-primary whitespace-nowrap">
                    <span>{m.hsn || '3004'}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground font-sans">
                      ({m.gstRate ?? 5}%)
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-amber-700 dark:text-amber-300">
                    <div className="font-semibold">{m.batch}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.unit}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">{m.stock}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatCurrency(m.cost)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatCurrency(m.purchase)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">{formatCurrency(m.sale)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">{formatCurrency(m.mrp)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground font-bold">{formatCurrency(m.value)}</td>
                  <td className="px-4 py-2.5 text-center text-foreground font-mono">{m.sales_scheme}</td>
                  <td className="px-4 py-2.5 text-center text-foreground font-mono">{m.purchase_scheme}</td>
                  <td className="px-4 py-2.5 text-foreground font-mono whitespace-nowrap">{m.received}</td>
                  <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">
                    <div>{m.mfg}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.exp}</div>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{m.supplier}</td>
                  <td className="px-4 py-2.5 font-mono text-foreground">
                    <div>{m.invoice_no || '—'}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.invoice_date || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      aria-label={`Edit ${m.product}`}
                      onClick={() => editMapping(m)}
                      className="mr-1 p-1 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      aria-label={`Delete ${m.product}`}
                      onClick={() => removeMapping(m.id)}
                      className="p-1 hover:text-rose-600 dark:hover:text-rose-400 text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && displayedItems.length === 0 && (
              <tr>
                <td colSpan={16} className="p-8 text-center text-muted-foreground text-sm">
                  No mappings match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TopTableScroller>

      {/* Continuous Stream "Load Next Chunk" Button */}
      {chunkMode === 'continuous' && continuousCount < totalItems && (
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-muted-foreground">
            Loaded <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
            <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> mappings (
            {Math.round((endIdx / totalItems) * 100)}%)
          </div>
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <ArrowDownCircle size={15} /> Load Next {Math.min(pageSize || 50, totalItems - endIdx)} Mappings
          </button>
        </div>
      )}

      {chunkMode === 'continuous' && continuousCount >= totalItems && totalItems > 0 && (
        <div className="p-3 bg-card border border-border rounded-xl flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium shadow-xs">
          <CheckCircle2 size={14} /> All {totalItems.toLocaleString()} mappings loaded
        </div>
      )}

      {/* Bottom Pagination Footer */}
      {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
        <div className="p-3 bg-card border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground shadow-xs">
          <div>
            Showing page <span className="font-medium text-foreground">{currentPage}</span> of{' '}
            <span className="font-medium text-foreground">{totalPages}</span> ({pageSize} per chunk)
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <ChevronsLeft size={13} /> First
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="px-3 py-1 font-mono font-semibold text-foreground">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              Next <ChevronRight size={13} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              Last <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MappingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:px-2.5 [&>input]:py-2 [&>input]:text-sm [&>input]:normal-case [&>input]:text-foreground [&>input]:outline-none [&>input]:focus:ring-1 [&>input]:focus:ring-primary [&>input]:focus:border-primary transition">
        {children}
      </div>
    </label>
  )
}

function MappingNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <MappingField label={label}><input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} /></MappingField>
}
