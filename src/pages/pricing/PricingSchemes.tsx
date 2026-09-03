import { useState, useEffect, useMemo } from 'react'
import {
  Tag,
  Percent,
  Gift,
  FileText,
  Download,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  CheckCircle,
  X,
  TrendingUp,
  Package,
  Layers,
  Sparkles
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp, patchErp } from '../../lib/erpApi'

export interface PricingItem {
  id: string
  name: string
  packing: string
  manufacturer?: string
  salt?: string
  hsn?: string
  mrp: number
  purc: number
  sale: number
  margin: number
  mrpMargin: number
  profitUnit: number
  scheme: string
  dealQty?: number
  freeQty?: number
  disc: number
  schemeType: 'free_goods' | 'discount' | 'none'
}

const STORAGE_SCHEMES_KEY = 'pharma_erp_custom_schemes'

export default function PricingSchemes() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'rates' | 'schemes'>('rates')
  const [search, setSearch] = useState('')
  const [marginFilter, setMarginFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null)
  const addToast = useUIStore((s) => s.addToast)

  // Scheme modal state
  const [selectedItemId, setSelectedItemId] = useState('')
  const [modalDealQty, setModalDealQty] = useState(10)
  const [modalFreeQty, setModalFreeQty] = useState(1)
  const [modalDisc, setModalDisc] = useState(0)
  const [modalSchemeType, setModalSchemeType] = useState<'free_goods' | 'discount'>('free_goods')

  // Load database items
  const loadData = () => {
    setLoading(true)
    getErp<any[]>('items')
      .then((rawItems) => {
        const prods = rawItems || []

        // Load custom configured schemes from localStorage
        const savedSchemes: Record<string, { scheme: string; dealQty?: number; freeQty?: number; disc?: number; schemeType: 'free_goods' | 'discount' | 'none' }> = JSON.parse(
          localStorage.getItem(STORAGE_SCHEMES_KEY) || '{}'
        )

        const formatted: PricingItem[] = prods.map((item: any) => {
          const mrp = Number(item.mrp || 100)
          const purc = Number(item.purchaseRate || (item.saleRate ? item.saleRate * 0.8 : 75))
          const sale = Number(item.saleRate || mrp * 0.9 || 90)

          // Profit & Margins
          const profitUnit = Math.max(0, sale - purc)
          const margin = sale > 0 ? Math.round(((sale - purc) / sale) * 100) : 0
          const mrpMargin = mrp > 0 ? Math.round(((mrp - purc) / mrp) * 100) : 0

          // Check batches for schemes
          let schemeStr = '-'
          let deal = 0
          let free = 0
          let disc = 0
          let sType: 'free_goods' | 'discount' | 'none' = 'none'

          const firstBatch = item.batches?.[0]
          if (firstBatch && (firstBatch.salesSchemeDeal || firstBatch.salesSchemeFree)) {
            deal = Number(firstBatch.salesSchemeDeal || 10)
            free = Number(firstBatch.salesSchemeFree || 1)
            schemeStr = `${deal} + ${free} FREE`
            sType = 'free_goods'
          }

          // Check if custom saved scheme exists for this item
          if (savedSchemes[item.id]) {
            const cs = savedSchemes[item.id]
            schemeStr = cs.scheme
            deal = cs.dealQty || deal
            free = cs.freeQty || free
            disc = cs.disc || 0
            sType = cs.schemeType
          }

          return {
            id: item.id,
            name: item.name,
            packing: item.packing || '10T',
            manufacturer: item.manufacturer || 'Pharma Corp',
            salt: item.salt || '',
            hsn: item.hsn || '3004',
            mrp,
            purc,
            sale,
            margin,
            mrpMargin,
            profitUnit,
            scheme: schemeStr,
            dealQty: deal,
            freeQty: free,
            disc,
            schemeType: sType
          }
        })

        setItems(formatted)
        setLoading(false)
      })
      .catch((e) => {
        addToast(e.message, 'error')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered rows
  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.packing.toLowerCase().includes(q) ||
        (i.manufacturer && i.manufacturer.toLowerCase().includes(q)) ||
        (i.salt && i.salt.toLowerCase().includes(q))

      if (!matchSearch) return false

      if (marginFilter === 'high') return i.margin >= 25
      if (marginFilter === 'mid') return i.margin >= 15 && i.margin < 25
      if (marginFilter === 'low') return i.margin < 15
      return true
    })
  }, [items, search, marginFilter])

  // Key metrics
  const avgMargin = items.length
    ? Math.round(items.reduce((a, i) => a + i.margin, 0) / items.length)
    : 0
  const activeSchemesCount = items.filter((i) => i.scheme !== '-' || i.disc > 0).length
  const highMarginCount = items.filter((i) => i.margin >= 25).length

  // Open modal to configure scheme
  const handleOpenSchemeModal = (item?: PricingItem) => {
    if (item) {
      setEditingItem(item)
      setSelectedItemId(item.id)
      setModalDealQty(item.dealQty || 10)
      setModalFreeQty(item.freeQty || 1)
      setModalDisc(item.disc || 0)
      setModalSchemeType(item.schemeType === 'none' ? 'free_goods' : item.schemeType)
    } else {
      setEditingItem(null)
      setSelectedItemId(items[0]?.id || '')
      setModalDealQty(10)
      setModalFreeQty(1)
      setModalDisc(0)
      setModalSchemeType('free_goods')
    }
    setShowModal(true)
  }

  // Save scheme
  const handleSaveScheme = () => {
    const targetId = editingItem ? editingItem.id : selectedItemId
    const targetItem = items.find((i) => i.id === targetId)
    if (!targetItem) {
      addToast('Please select a valid medicine', 'error')
      return
    }

    const schemeStr =
      modalSchemeType === 'free_goods'
        ? `${modalDealQty} + ${modalFreeQty} FREE`
        : `${modalDisc}% Trade Discount`

    // Update in localStorage
    const savedSchemes = JSON.parse(localStorage.getItem(STORAGE_SCHEMES_KEY) || '{}')
    savedSchemes[targetId] = {
      scheme: schemeStr,
      dealQty: modalDealQty,
      freeQty: modalFreeQty,
      disc: modalDisc,
      schemeType: modalSchemeType
    }
    localStorage.setItem(STORAGE_SCHEMES_KEY, JSON.stringify(savedSchemes))

    // Update local state
    setItems((prev) =>
      prev.map((i) =>
        i.id === targetId
          ? {
              ...i,
              scheme: schemeStr,
              dealQty: modalDealQty,
              freeQty: modalFreeQty,
              disc: modalDisc,
              schemeType: modalSchemeType
            }
          : i
      )
    )

    addToast(`Scheme deal applied to ${targetItem.name}: ${schemeStr}`, 'success')
    setShowModal(false)
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader
        title="Pricing, Schemes & Margins Register"
        subtitle="Live catalog rate list, wholesale trade schemes, and margin analysis"
      />

      {/* Screen Header */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pricing / Schemes / Margins</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Database-backed rate lists, scheme deals &amp; trade margin analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 h-9 px-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-semibold shadow-xs transition border border-border cursor-pointer"
            title="Refresh database items"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            <span>Sync DB</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('pricing-schemes', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition border border-border cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => handleOpenSchemeModal()}
            className="flex items-center gap-2 h-9 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-purple-500/30 cursor-pointer"
          >
            <Plus size={16} /> Configure Scheme Deal
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Average Trade Margin</span>
            <Tag size={13} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
            {avgMargin}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Across all cataloged medicines</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>High Margin SKUs (&gt;25%)</span>
            <TrendingUp size={13} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-blue-600 dark:text-blue-400">
            {highMarginCount} items
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Top-tier profitability lines</div>
        </div>

        <div className="bg-card border border-purple-500/20 bg-purple-500/5 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold flex items-center justify-between">
            <span>Active Schemes &amp; Deals</span>
            <Gift size={13} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-purple-600 dark:text-purple-400">
            {activeSchemesCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Free goods &amp; discount deals</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Catalog Size</span>
            <Package size={13} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono mt-1">
            {items.length} Products
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Loaded from inventory DB</div>
        </div>
      </div>

      {/* Tabs, Search & Margin Filter Bar */}
      <div className="no-print flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab Selector */}
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit shadow-xs">
            <button
              onClick={() => setTab('rates')}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition cursor-pointer',
                tab === 'rates'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Percent size={13} /> Rate List &amp; Margins ({items.length})
            </button>
            <button
              onClick={() => setTab('schemes')}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition cursor-pointer',
                tab === 'schemes'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Gift size={13} /> Promotional Schemes ({activeSchemesCount})
            </button>
          </div>

          {/* Margin Filter Pill Group */}
          {tab === 'rates' && (
            <div className="flex gap-1 bg-secondary/40 border border-border rounded-lg p-1 text-xs">
              <button
                onClick={() => setMarginFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-semibold transition',
                  marginFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                )}
              >
                All Margins
              </button>
              <button
                onClick={() => setMarginFilter('high')}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-semibold transition',
                  marginFilter === 'high' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-muted-foreground'
                )}
              >
                &gt;25% High
              </button>
              <button
                onClick={() => setMarginFilter('mid')}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-semibold transition',
                  marginFilter === 'mid' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-muted-foreground'
                )}
              >
                15-25% Mid
              </button>
              <button
                onClick={() => setMarginFilter('low')}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-semibold transition',
                  marginFilter === 'low' ? 'bg-amber-600 text-white shadow-2xs' : 'text-muted-foreground'
                )}
              >
                &lt;15% Low
              </button>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full lg:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search medicine, salt, or manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-indigo-600 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
              <th className="text-left px-4 py-3 min-w-[220px]">Medicine / Item</th>
              <th className="text-left px-3 py-3 w-28">Packing</th>
              {tab === 'rates' ? (
                <>
                  <th className="text-right px-3 py-3 w-28">MRP (₹)</th>
                  <th className="text-right px-3 py-3 w-28">Purchase Rate (₹)</th>
                  <th className="text-right px-3 py-3 w-28">Sale Rate (₹)</th>
                  <th className="text-right px-3 py-3 w-28">Profit / Unit</th>
                  <th className="text-right px-4 py-3 w-28">Trade Margin %</th>
                </>
              ) : (
                <>
                  <th className="text-left px-4 py-3 min-w-[160px]">Active Scheme Deal</th>
                  <th className="text-right px-3 py-3 w-28">Discount %</th>
                  <th className="text-left px-3 py-3 w-36">Scheme Type</th>
                  <th className="text-right px-4 py-3 w-28">Action</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3 font-semibold text-foreground">
                  <div>{i.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-normal">
                    {i.manufacturer && <span>{i.manufacturer}</span>}
                    {i.salt && <span>&bull; {i.salt}</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground font-mono">{i.packing}</td>
                {tab === 'rates' ? (
                  <>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {formatCurrency(i.mrp)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-medium">
                      {formatCurrency(i.purc)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCurrency(i.sale)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                      +{formatCurrency(i.profitUnit)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-mono shadow-2xs inline-block',
                          i.margin >= 25
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : i.margin >= 15
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        )}
                      >
                        {i.margin}%
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                      {i.scheme !== '-' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs">
                          <Sparkles size={12} /> {i.scheme}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal text-xs">No active scheme</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                      {i.disc > 0 ? `${i.disc}%` : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                          i.schemeType === 'free_goods' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                          i.schemeType === 'discount' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          i.schemeType === 'none' && 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {i.schemeType === 'free_goods'
                          ? 'Free Goods Deal'
                          : i.schemeType === 'discount'
                          ? 'Trade Discount'
                          : 'Standard Rate'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenSchemeModal(i)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                        title="Configure scheme or deal for this medicine"
                      >
                        <Edit2 size={12} /> Edit Deal
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scheme Configuration Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto no-print"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Gift size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {editingItem ? `Configure Scheme for ${editingItem.name}` : 'Configure Promotional Scheme'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Set free goods deals or trade discounts for billing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Target Item Selection if not editing */}
              {!editingItem ? (
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Select Medicine *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none focus:border-indigo-600"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.packing}) - MRP: {formatCurrency(it.mrp)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Selected Medicine</div>
                  <div className="text-sm font-bold text-foreground">{editingItem.name}</div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span>MRP: <b className="text-foreground">{formatCurrency(editingItem.mrp)}</b></span>
                    <span>Purchase: <b className="text-foreground">{formatCurrency(editingItem.purc)}</b></span>
                    <span>Sale: <b className="text-foreground">{formatCurrency(editingItem.sale)}</b></span>
                  </div>
                </div>
              )}

              {/* Scheme Type */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Scheme Structure *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalSchemeType('free_goods')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition cursor-pointer',
                      modalSchemeType === 'free_goods'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                        : 'border-border bg-secondary/20 text-muted-foreground'
                    )}
                  >
                    <div className="text-xs">Free Goods Deal</div>
                    <div className="text-[10px] font-normal opacity-80">e.g. 10 + 1 Free or 20 + 2 Free</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalSchemeType('discount')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition cursor-pointer',
                      modalSchemeType === 'discount'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-border bg-secondary/20 text-muted-foreground'
                    )}
                  >
                    <div className="text-xs">Trade Discount %</div>
                    <div className="text-[10px] font-normal opacity-80">Flat percentage off billing rate</div>
                  </button>
                </div>
              </div>

              {/* Free Goods Deal Quantities */}
              {modalSchemeType === 'free_goods' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                      Buy / Deal Qty *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalDealQty}
                      onChange={(e) => setModalDealQty(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-foreground font-bold outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                      Free Qty Provided *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalFreeQty}
                      onChange={(e) => setModalFreeQty(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-foreground font-bold outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Trade Discount Percentage (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={modalDisc}
                    onChange={(e) => setModalDisc(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-foreground font-bold outline-none focus:border-indigo-600"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScheme}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle size={14} /> Apply Scheme to Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
