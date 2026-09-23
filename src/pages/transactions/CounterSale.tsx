import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ShoppingCart,
  Trash2,
  Banknote,
  Smartphone,
  CreditCard,
  Printer,
  Search,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Pill,
  Check,
  Zap,
  Tag,
  Package,
  X,
  Layers,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import Typeahead from '../../components/ui/Typeahead'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import PrintHeader from '../../components/layout/PrintHeader'
import TaxInvoicePrint from '../../components/transactions/TaxInvoicePrint'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import { getGstRateForHsn } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'

interface CounterItem {
  id?: string
  name: string
  rate: number
  batch: string
  stock: number
  gst: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
  category?: string
}

export default function CounterSale() {
  const [available, setAvailable] = useState<CounterItem[]>([])
  const [cart, setCart] = useState<Array<CounterItem & { qty: number }>>([])
  const [activeItem, setActiveItem] = useState<CounterItem | null>(null)
  const [pay, setPay] = useState<'cash' | 'upi' | 'card'>('cash')
  const [cashTendered, setCashTendered] = useState<number | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [saving, setSaving] = useState(false)
  const [showDetailPanel, setShowDetailPanel] = useState(true)
  const [completedSale, setCompletedSale] = useState<{
    invoiceNo: string
    date: string
    lines: Array<{
      name: string
      qty: number
      rate: number
      batch: string
      stock: number
      gst: number
      manufacturer?: string
      packing?: string
      hsn?: string
      mrp?: number
    }>
    total: number
    paymentMode: string
  } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  const loadItems = (force = false) => {
    getErp<any[]>('items', undefined, force ? { forceRefresh: true } : undefined)
      .then((items) => {
        const mapped: CounterItem[] = items.flatMap((item) =>
          (item.batches ?? [])
            .filter((b: any) => Number(b.stock ?? 0) > 0)
            .map((b: any) => {
              const batchMrp = Number(b.mrp || item.mrp || 0)
              const batchSaleRate = Number(b.salePrice ?? b.saleRate ?? b.rate ?? item.saleRate ?? 0)
              const autoRate = batchSaleRate > 0 ? batchSaleRate : batchMrp

              return {
                id: item.id,
                name: item.name,
                rate: autoRate,
                batch: String(b.batch || 'DEFAULT'),
                stock: Number(b.stock || 0),
                gst:
                  item.gstRate !== undefined && item.gstRate !== null
                    ? Number(item.gstRate)
                    : getGstRateForHsn(item.hsn),
                mrp: batchMrp,
                purchaseRate: Number(b.purchasePrice ?? b.purchaseRate ?? item.purchaseRate ?? 0),
                packing: item.packing || '',
                manufacturer: item.manufacturer || item.company || '',
                salt: item.salt || item.composition || '',
                hsn: item.hsn || '',
                expiry: b.expiry || '',
                category: item.category || 'General',
              }
            })
        )
        setAvailable(mapped)
        if (mapped.length > 0 && !activeItem) {
          setActiveItem(mapped[0])
        }
      })
      .catch((e) => showToast(e.message))
  }

  useEffect(() => {
    loadItems(false)
  }, [showToast])

  useErpAutoRefresh(['items', 'item-batches', 'stock', 'sales'], () => {
    loadItems(true)
  })

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'F9' && cart.length > 0 && !saving) {
        e.preventDefault()
        complete()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Extract unique categories for quick-filter tabs
  const categories = useMemo(() => {
    const cats = new Set<string>()
    cats.add('All')
    available.forEach((i) => {
      if (i.category && i.category.trim()) cats.add(i.category.trim())
    })
    return Array.from(cats).slice(0, 8)
  }, [available])

  // Filtered items based on search query and category
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return available.filter((i) => {
      const matchCat = selectedCategory === 'All' || i.category === selectedCategory
      if (!matchCat) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        i.batch.toLowerCase().includes(q) ||
        (i.salt && i.salt.toLowerCase().includes(q)) ||
        (i.manufacturer && i.manufacturer.toLowerCase().includes(q)) ||
        (i.packing && i.packing.toLowerCase().includes(q))
      )
    })
  }, [available, searchQuery, selectedCategory])

  const add = (i: CounterItem) => {
    setActiveItem(i)
    setCart((prev) => {
      const ex = prev.find((c) => c.name === i.name && c.batch === i.batch)
      if (ex) {
        return prev.map((c) =>
          c.name === i.name && c.batch === i.batch
            ? { ...c, qty: Math.min(c.qty + 1, c.stock) }
            : c
        )
      }
      const initialRate = Number(i.rate > 0 ? i.rate : (i.mrp || 0))
      return [{ ...i, rate: initialRate, qty: 1 }, ...prev]
    })
  }

  const updateQty = (name: string, batch: string, newQty: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.name === name && item.batch === batch) {
            const valid = Math.max(0, Math.min(newQty, item.stock))
            return { ...item, qty: valid }
          }
          return item
        })
        .filter((item) => item.qty > 0)
    )
  }

  const removeItem = (name: string, batch: string) => {
    setCart((prev) => prev.filter((item) => !(item.name === name && item.batch === batch)))
  }

  const clearCart = () => {
    if (cart.length === 0) return
    setCart([])
    setCashTendered('')
  }

  const subtotal = cart.reduce((a, c) => a + c.qty * c.rate, 0)
  const total = Math.round(subtotal)
  const rounding = Math.round((total - subtotal) * 100) / 100
  const cartItemCount = cart.reduce((a, c) => a + c.qty, 0)

  // Cash change calculation
  const numericTendered = typeof cashTendered === 'number' ? cashTendered : 0
  const changeDue = numericTendered > total ? numericTendered - total : 0

  const complete = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Please add items first.')
      return
    }
    setSaving(true)
    try {
      const invoice = await postErp<{ id: string }>('sales', {
        party: 'Walk-in Retail Customer',
        total,
        paymentMode: pay,
        lines: cart.map((line) => ({
          ...line,
          freeQty: 0,
          discount: 0,
          gstRate: line.gst,
          amount: line.qty * line.rate,
        })),
      })
      const saleData = {
        invoiceNo: invoice?.id || `CS-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        lines: [...cart],
        total,
        paymentMode: pay,
      }
      setCompletedSale(saleData)
      showToast(`Counter receipt ${saleData.invoiceNo} posted successfully!`)
      incrementLedgerVersion()
      setCart([])
      setCashTendered('')
      loadItems(true)
      setTimeout(() => window.print(), 150)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to complete counter sale.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="no-print p-4 sm:p-6 max-w-[1700px] mx-auto space-y-4">
        {/* Printable Fallback Header */}
        <div className="hidden">
          <PrintHeader title="Counter Sale Receipt" />
        </div>

        {/* Top App Header / Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap size={20} className="fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-white">
                  Counter Sale (POS)
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Billing
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Walk-in Retail Customer • Instant Barcode / Quick Add • Batch & Expiry Controlled
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openTransactionWindow(window.location.pathname)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-black dark:text-white border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition shadow-xs cursor-pointer active:scale-[0.98]"
              title="Open another instance in a popout window"
            >
              <ExternalLink size={14} className="text-zinc-800 dark:text-zinc-200" />
              <span>New Window</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDetailPanel((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition shadow-xs cursor-pointer active:scale-[0.98]',
                showDetailPanel
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'bg-white dark:bg-slate-800 border-zinc-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-black dark:text-white hover:border-zinc-400'
              )}
            >
              <Layers size={14} className={showDetailPanel ? 'text-white' : 'text-zinc-800 dark:text-zinc-200'} />
              <span>{showDetailPanel ? 'Margin & Salt Inspector (ON)' : 'Inspect Margin & Salt'}</span>
            </button>

            {completedSale && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 transition cursor-pointer shadow-xs"
              >
                <Printer size={14} />
                <span>Reprint #{completedSale.invoiceNo}</span>
              </button>
            )}
          </div>
        </div>

        {/* Main 2-Column POS Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Catalog Search, Filter Chips & Medicine Cards (7 or 8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Search & Category Filter Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search medicine name, composition, batch, or company... (F2)"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Autocomplete Quick-Add Typeahead */}
                <div className="w-full sm:w-64">
                  <Typeahead
                    options={available.map((i) => ({
                      label: i.name,
                      sub: `${i.packing ? i.packing + ' • ' : ''}Batch: ${i.batch} | Stock: ${i.stock}`,
                      right: formatCurrency(i.rate),
                    }))}
                    value=""
                    onSelect={(opt) => {
                      const matched = available.find(
                        (i) =>
                          i.name === opt.label &&
                          `${i.packing ? i.packing + ' • ' : ''}Batch: ${i.batch} | Stock: ${i.stock}` === opt.sub
                      )
                      if (matched) add(matched)
                    }}
                    placeholder="Direct Quick Add..."
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer',
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                  >
                    {cat}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap pl-2">
                  Showing {filteredItems.length} products
                </span>
              </div>
            </div>

            {/* Medicine Items Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Available Medicines ({filteredItems.length})
                </span>
                <span className="text-[11px] text-slate-400">Click any card to add to bill</span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Pill size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No medicines found</h3>
                    <p className="text-xs text-slate-500 mt-1">Try clearing the search query or category filter.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('All')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 transition"
                  >
                    <RotateCcw size={13} /> Reset Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {filteredItems.map((item) => {
                    const isSelected = activeItem?.name === item.name && activeItem?.batch === item.batch
                    const inCartItem = cart.find((c) => c.name === item.name && c.batch === item.batch)

                    return (
                      <div
                        key={`${item.name}-${item.batch}`}
                        onClick={() => add(item)}
                        className={cn(
                          'group relative bg-white dark:bg-slate-900 border rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md select-none',
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                        )}
                      >
                        {/* Top: Item Title & Badges */}
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="text-sm font-bold text-black dark:text-white line-clamp-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {item.name}
                            </h3>
                            {inCartItem && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-600 text-white shadow-xs">
                                ×{inCartItem.qty}
                              </span>
                            )}
                          </div>

                          {/* Packing & Manufacturer / Composition */}
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                            {item.packing && (
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {item.packing}
                              </span>
                            )}
                            {item.packing && (item.manufacturer || item.salt) && <span>•</span>}
                            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                              {item.manufacturer || item.salt || 'General'}
                            </span>
                          </div>

                          {/* Batch & Expiry Badges */}
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              B: {item.batch}
                            </span>
                            {item.expiry && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                Exp: {item.expiry}
                              </span>
                            )}
                            <span
                              className={cn(
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto',
                                item.stock > 10
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              )}
                            >
                              {item.stock} left
                            </span>
                          </div>
                        </div>

                        {/* Bottom: Price & Quick Add Button */}
                        <div className="flex items-end justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                              Retail Rate
                            </div>
                            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
                              {formatCurrency(item.rate)}
                            </div>
                          </div>

                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all duration-150 shadow-xs">
                            <Plus size={16} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Optional Marg ERP Active Product Description & Margin Panel */}
            {showDetailPanel && (
              <div className="mt-4">
                <ActiveProductDetailPanel
                  activeProduct={
                    activeItem
                      ? {
                          name: activeItem.name,
                          packing: activeItem.packing,
                          manufacturer: activeItem.manufacturer,
                          salt: activeItem.salt,
                          hsn: activeItem.hsn,
                          gstRate: activeItem.gst,
                          batch: activeItem.batch,
                          expiry: activeItem.expiry,
                          stock: activeItem.stock,
                          saleRate: activeItem.rate,
                          mrp: activeItem.mrp,
                          purchaseRate: activeItem.purchaseRate,
                          refNo: 'POS-COUNTER',
                          date: new Date().toISOString().split('T')[0],
                        }
                      : null
                  }
                  billSummary={{
                    title: 'Counter Total',
                    partyLabel: 'Customer',
                    partyName: 'Walk-in Retail Customer',
                    valueOfGoods: total,
                    grandTotal: total,
                  }}
                  emptyMessage="Select or tap any medicine card to inspect live batch, warehouse stock, rates, composition and margins."
                />
              </div>
            )}
          </div>

          {/* Right Column: High-Performance Retail Cart / Checkout Register (4 or 5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
              {/* Register Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-black dark:text-white">Current Order</h2>
                    <span className="text-[11px] text-slate-500">
                      {cartItemCount} items ({cart.length} distinct)
                    </span>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Empty Cart"
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60 min-h-[180px] max-h-[380px] lg:max-h-[calc(100vh-420px)]">
                {cart.length === 0 ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                      <ShoppingCart size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Your Cart is Empty</div>
                      <div className="text-xs text-slate-400 mt-0.5 max-w-[200px]">
                        Scan medicine or click items from the left to start billing.
                      </div>
                    </div>
                  </div>
                ) : (
                  cart.map((item) => {
                    const isSelected = activeItem?.name === item.name && activeItem?.batch === item.batch
                    const lineTotal = item.qty * item.rate

                    return (
                      <div
                        key={`${item.name}-${item.batch}`}
                        onClick={() => setActiveItem(item)}
                        className={cn(
                          'pt-2 first:pt-0 pb-1 rounded-xl p-2.5 transition-all cursor-pointer space-y-1.5',
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                        )}
                      >
                        {/* Title & Line Delete */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-black dark:text-white leading-tight">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                B: {item.batch}
                              </span>
                              {item.packing && (
                                <span className="text-[10px] text-slate-400">{item.packing}</span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeItem(item.name, item.batch)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Remove from cart"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Quantity Stepper & Price Total */}
                        <div className="flex items-center justify-between pt-1">
                          {/* Stepper */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQty(item.name, item.batch, item.qty - 1)
                              }}
                              className="w-7 h-7 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center transition shadow-2xs cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus size={13} />
                            </button>

                            <input
                              type="number"
                              min={1}
                              max={item.stock}
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (!isNaN(val)) updateQty(item.name, item.batch, val)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 text-center bg-transparent font-mono font-bold text-xs text-black dark:text-white outline-none"
                            />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQty(item.name, item.batch, item.qty + 1)
                              }}
                              disabled={item.qty >= item.stock}
                              className="w-7 h-7 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center transition shadow-2xs cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          {/* Line Rate & Amount */}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {formatCurrency(item.rate)} / u
                            </span>
                            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom Checkout & Payment Section */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-3">
                {/* Financial Summary */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  {rounding !== 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span>Round Off</span>
                      <span className="font-mono">{formatCurrency(rounding)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-sm font-bold text-black dark:text-white">Payable Total</span>
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                {/* Payment Mode Segmented Selector */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPay('cash')}
                    className={cn(
                      'py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer',
                      pay === 'cash'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    )}
                  >
                    <Banknote size={14} /> Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPay('upi')}
                    className={cn(
                      'py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer',
                      pay === 'upi'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    )}
                  >
                    <Smartphone size={14} /> UPI QR
                  </button>

                  <button
                    type="button"
                    onClick={() => setPay('card')}
                    className={cn(
                      'py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer',
                      pay === 'card'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    )}
                  >
                    <CreditCard size={14} /> Card
                  </button>
                </div>

                {/* Cash Quick Tender & Change Return Calculator */}
                {pay === 'cash' && total > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Cash Tendered:</span>
                      <div className="flex items-center gap-1">
                        {[total, 100, 200, 500].map((amt) => {
                          if (amt < total && amt !== total) return null
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashTendered(amt)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold transition"
                            >
                              ₹{amt}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          placeholder="Amount received..."
                          value={cashTendered}
                          onChange={(e) =>
                            setCashTendered(e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-full pl-6 pr-2.5 py-1.5 text-sm font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>

                      {changeDue > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg text-right">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block leading-tight">
                            Return Change:
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(changeDue)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* UPI QR Display Card */}
                {pay === 'upi' && total > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center space-y-2 shadow-xs">
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Scan with PhonePe / GPay / Paytm
                    </div>
                    <div className="p-2 bg-white rounded-xl inline-block border border-slate-200 shadow-2xs">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(
                          `upi://pay?pa=pay@borgang.upi&pn=Borgang%20Drug%20Distributors&am=${total.toFixed(2)}&cu=INR&tn=Retail-Counter`
                        )}`}
                        alt="UPI Payment QR Code"
                        className="w-[120px] h-[120px] object-contain mx-auto"
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Exact Amount: <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                {/* Primary CTA: Charge & Complete */}
                <button
                  type="button"
                  onClick={complete}
                  disabled={cart.length === 0 || saving}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>{saving ? 'Posting Invoice…' : `Charge ${formatCurrency(total)} & Print (F9)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Print Target (Rendered exclusively for window.print()) */}
      {completedSale && (
        <div className="hidden print:block w-full">
          <TaxInvoicePrint
            data={{
              title: 'RETAIL CASH MEMO',
              copyType: 'Original for Customer',
              invoiceNo: completedSale.invoiceNo,
              invoiceDate: completedSale.date,
              paymentMode: completedSale.paymentMode.toUpperCase(),
              buyer: {
                name: 'Walk-in Retail Customer',
                address: 'Local / Counter Sale',
              },
              items: completedSale.lines.map((l) => ({
                name: l.name,
                packing: l.packing || '1x10',
                mfr: l.manufacturer,
                hsn: l.hsn,
                batch: l.batch,
                qty: l.qty,
                rate: l.rate,
                gstRate: l.gst,
                amount: l.qty * l.rate,
              })),
              grandTotal: completedSale.total,
            }}
          />
        </div>
      )}
    </div>
  )
}
