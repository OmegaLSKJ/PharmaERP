import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'

export interface ActiveProductDetail {
  id?: string
  code?: string
  batchId?: string
  name: string
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  gstRate?: number
  batch?: string
  expiry?: string
  stock?: number
  saleRate?: number
  mrp?: number
  purchaseRate?: number
  costPrice?: number
  purchaseSchemeDeal?: number
  purchaseSchemeFree?: number
  salesSchemeDeal?: number
  salesSchemeFree?: number
  refNo?: string
  date?: string
  category?: string
  location?: string
  supplier?: string
  status?: string
}

export function calculateRateMargins({ mrp, saleRate, purchaseRate, costPrice }: Pick<ActiveProductDetail, 'mrp' | 'saleRate' | 'purchaseRate' | 'costPrice'>) {
  const percent = (numerator?: number, denominator?: number) => typeof numerator === 'number' && typeof denominator === 'number' && denominator > 0 ? ((numerator / denominator) * 100) : null
  return {
    mrpVsSale: percent(typeof mrp === 'number' && typeof saleRate === 'number' ? mrp - saleRate : undefined, mrp),
    mrpVsPurchase: percent(typeof mrp === 'number' && typeof purchaseRate === 'number' ? mrp - purchaseRate : undefined, mrp),
    saleVsCost: percent(typeof saleRate === 'number' && typeof costPrice === 'number' ? saleRate - costPrice : undefined, saleRate),
  }
}

export interface ActiveBillSummary {
  title?: string
  partyLabel?: string
  partyName?: string
  partyBalance?: number
  mrpValue?: number
  valueOfGoods?: number
  discount?: number
  discountValue?: number
  gstTotal?: number
  gstValue?: number
  grandTotal?: number
}

export interface ActiveProductDetailPanelProps {
  activeProduct?: ActiveProductDetail | null
  billSummary?: ActiveBillSummary | null
  totalRows?: number
  activeIndex?: number
  emptyMessage?: string
  className?: string
  open?: boolean
  onClose?: () => void
  autoOpenOnChange?: boolean
  onDetailLoaded?: (detail: ActiveProductDetail) => void
  showInline?: boolean
}

export function formatDisplayExpiry(val?: string): string {
  if (!val) return '—'
  const trimmed = val.trim()
  if (!trimmed) return '—'

  // If already formatted like "Mar, 2028" or "03/28"
  if (/^[A-Za-z]{3},\s*\d{4}$/.test(trimmed) || /^\d{2}\/\d{2,4}$/.test(trimmed)) {
    return trimmed
  }

  // Parse YYYY-MM or YYYY-MM-DD
  const parts = trimmed.split('-')
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11) {
      const date = new Date(year, month, 1)
      const monthName = date.toLocaleString('en-US', { month: 'short' })
      return `${monthName}, ${year}`
    }
  }

  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    const monthName = d.toLocaleString('en-US', { month: 'short' })
    return `${monthName}, ${d.getFullYear()}`
  }

  return trimmed
}

export default function ActiveProductDetailPanel({
  activeProduct,
  billSummary,
  totalRows,
  activeIndex = 0,
  emptyMessage = 'Select or focus on any product to inspect live batch, stock, rates, composition and margins.',
  className,
  open,
  onClose,
  autoOpenOnChange = false,
  onDetailLoaded,
  showInline = false,
}: ActiveProductDetailPanelProps) {
  const hasBillSummary = Boolean(billSummary)
  const [internalDetailOpen, setInternalDetailOpen] = useState(false)
  const detailOpen = open !== undefined ? open : internalDetailOpen

  const setDetailOpen = (val: boolean) => {
    setInternalDetailOpen(val)
    if (!val) onClose?.()
  }

  const [liveDetail, setLiveDetail] = useState<ActiveProductDetail | null>(null)
  const [liveError, setLiveError] = useState('')
  const initialized = useRef(false)
  const previousKey = useRef('')
  const productKey = activeProduct ? `${activeProduct.name}|${activeProduct.batch || ''}` : ''

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      previousKey.current = productKey
      return
    }
    if (autoOpenOnChange && productKey && productKey !== previousKey.current) {
      setDetailOpen(true)
    }
    previousKey.current = productKey
  }, [productKey, autoOpenOnChange])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    if (!detailOpen || typeof document === 'undefined') return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [detailOpen])

  useEffect(() => {
    if (!activeProduct || !activeProduct.name) {
      setLiveDetail(null)
      setLiveError('')
      return
    }
    // Don't query product detail if it's a non-medicine label (e.g. credit note or debit note headers)
    if (activeProduct.name.startsWith('Credit Note:') || activeProduct.name.startsWith('Debit Note:')) {
      setLiveDetail(null)
      setLiveError('')
      return
    }
    let current = true
    const refresh = async () => {
      try {
        const detail = await getErp<ActiveProductDetail>('product-detail', {
          ...(activeProduct.id ? { itemId: activeProduct.id } : {}),
          itemName: activeProduct.name,
          ...(activeProduct.batchId ? { batchId: activeProduct.batchId } : {}),
          ...(activeProduct.batch ? { batchNumber: activeProduct.batch } : {}),
        }, { forceRefresh: true })
        if (current) {
          setLiveDetail(detail)
          setLiveError('')
          onDetailLoaded?.(detail)
        }
      } catch {
        if (current) {
          setLiveError('')
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => { current = false; window.clearInterval(timer) }
  }, [activeProduct?.id, activeProduct?.name, activeProduct?.batchId, activeProduct?.batch])

  const displayedProduct = liveDetail
    ? {
        ...activeProduct,
        ...Object.fromEntries(
          Object.entries(liveDetail).filter(([_, v]) => v !== undefined && v !== null && v !== '')
        )
      }
    : activeProduct
  const money = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? `₹${value.toFixed(2)}` : '—'
  const margins = calculateRateMargins(displayedProduct || {})

  const renderModal = () => {
    if (!detailOpen) return null
    if (typeof document === 'undefined') return null

    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150"
        role="presentation"
        onMouseDown={() => setDetailOpen(false)}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`${displayedProduct?.name || 'Product'} batch details`}
          className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-4 shrink-0">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Live batch inventory
              </p>
              <div className="mt-1 flex items-baseline flex-wrap gap-2">
                <h2 className="font-mono text-lg font-black text-slate-900 dark:text-white">
                  {displayedProduct?.name || 'No Product Selected'}
                </h2>
                {displayedProduct?.packing && (
                  <span className="rounded bg-slate-200 dark:bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {displayedProduct.packing}
                  </span>
                )}
                {displayedProduct?.manufacturer && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold italic">
                    ({displayedProduct.manufacturer})
                  </span>
                )}
              </div>
              {displayedProduct?.salt && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-mono font-medium">
                  Composition: {displayedProduct.salt}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 font-mono text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-xs"
            >
              Close
            </button>
          </header>

          <div className="overflow-y-auto flex-1 p-0">
            {displayedProduct ? (
              <>
                <div className="grid gap-px bg-slate-200 dark:bg-slate-800/80 text-xs md:grid-cols-2">
                  <Detail label="Item Code / ID" value={displayedProduct.code || displayedProduct.id} />
                  <Detail label="Category" value={displayedProduct.category} />
                  <Detail label="HSN / SAC" value={displayedProduct.hsn} />
                  <Detail
                    label="GST"
                    value={
                      typeof displayedProduct.gstRate === 'number'
                        ? `${displayedProduct.gstRate}% (CGST ${(displayedProduct.gstRate / 2).toFixed(1)}% + SGST ${(displayedProduct.gstRate / 2).toFixed(1)}%)`
                        : undefined
                    }
                  />
                  <Detail label="Batch" value={displayedProduct.batch} />
                  <Detail label="Expiry" value={formatDisplayExpiry(displayedProduct.expiry)} />
                  <Detail
                    label="Stock"
                    value={typeof displayedProduct.stock === 'number' ? `${displayedProduct.stock} units` : undefined}
                  />
                  <Detail label="Rack / Location" value={displayedProduct.location} />
                  <Detail label="Purchase rate" value={money(displayedProduct.purchaseRate)} />
                  <Detail label="Cost price" value={money(displayedProduct.costPrice)} />
                  <Detail
                    label="Purchase scheme"
                    value={scheme(displayedProduct.purchaseSchemeDeal, displayedProduct.purchaseSchemeFree)}
                  />
                  <Detail
                    label="Sales scheme"
                    value={scheme(displayedProduct.salesSchemeDeal, displayedProduct.salesSchemeFree)}
                  />
                  <Detail label="MRP" value={money(displayedProduct.mrp)} />
                  <Detail label="Sale price" value={money(displayedProduct.saleRate)} />
                  <Detail label="Supplier" value={displayedProduct.supplier} />
                  <Detail label="Supplier invoice" value={displayedProduct.refNo} />
                  <Detail label="Invoice date" value={displayedProduct.date} />
                </div>

                {liveError && (
                  <p className="border-t border-amber-300 bg-amber-50 px-5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {liveError}
                  </p>
                )}

                <section className="border-t border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/30">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-slate-500 dark:text-slate-400">
                    Rate and margin comparison
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Margin label="MRP vs sale" value={margins.mrpVsSale} />
                    <Margin label="MRP vs purchase" value={margins.mrpVsPurchase} />
                    <Margin label="Sale vs cost" value={margins.saleVsCost} />
                  </div>
                </section>

                {billSummary && (
                  <section className="border-t border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-950">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-slate-500 dark:text-slate-400 mb-3">
                      {billSummary.title || 'Bill Values & Ledger'} {billSummary.partyName ? `(${billSummary.partyLabel || 'Party'}: ${billSummary.partyName})` : ''}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                      {typeof billSummary.mrpValue === 'number' && (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900/40">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">MRP Value</div>
                          <div className="font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(billSummary.mrpValue)}</div>
                        </div>
                      )}
                      {typeof billSummary.valueOfGoods === 'number' && (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900/40">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Value of Goods</div>
                          <div className="font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(billSummary.valueOfGoods)}</div>
                        </div>
                      )}
                      {typeof (billSummary.discount ?? billSummary.discountValue) === 'number' && (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900/40">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Discount</div>
                          <div className="font-black text-amber-600 dark:text-amber-400 mt-0.5">
                            {((billSummary.discount ?? billSummary.discountValue) || 0) > 0 ? `-${formatCurrency((billSummary.discount ?? billSummary.discountValue) || 0)}` : '₹0.00'}
                          </div>
                        </div>
                      )}
                      {typeof (billSummary.gstTotal ?? billSummary.gstValue) === 'number' && (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900/40">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">GST Total</div>
                          <div className="font-black text-blue-600 dark:text-blue-400 mt-0.5">+{formatCurrency((billSummary.gstTotal ?? billSummary.gstValue) || 0)}</div>
                        </div>
                      )}
                      {typeof billSummary.partyBalance === 'number' && (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900/40">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Party Balance</div>
                          <div className="font-black text-slate-900 dark:text-white mt-0.5">
                            {formatCurrency(Math.abs(billSummary.partyBalance))} {billSummary.partyBalance >= 0 ? 'Cr' : 'Dr'}
                          </div>
                        </div>
                      )}
                      {typeof billSummary.grandTotal === 'number' && (
                        <div className="border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5 sm:col-span-2 bg-emerald-50 dark:bg-emerald-950/30">
                          <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">Total Value</div>
                          <div className="font-black text-base text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(billSummary.grandTotal)}</div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                {emptyMessage}
              </div>
            )}
          </div>
        </section>
      </div>,
      document.body
    )
  }

  // If showInline is false (default), ONLY render the pop-up modal dialog and do NOT push down the page!
  if (!showInline) {
    return renderModal()
  }

  return (
    <div className={cn('border-t border-slate-300 dark:border-slate-800 pt-3', className)}>
      <div className={cn('grid gap-3.5', hasBillSummary ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1')}>
        {/* Left / Main: Active Product Live Inspection Box */}
        <div
          className={cn(
            'bg-white dark:bg-slate-950/90 border-2 border-slate-300 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2.5 font-mono shadow-xs text-xs transition-all text-black dark:text-slate-200',
            hasBillSummary ? 'lg:col-span-7' : 'w-full'
          )}
        >
          {/* Header Strip */}
          <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 pb-1.5 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => activeProduct && setDetailOpen(true)} disabled={!activeProduct} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-black uppercase tracking-wider text-[10px] disabled:opacity-50">
                Product Description
              </button>
              {typeof totalRows === 'number' && totalRows > 0 && activeProduct && (
                <span className="text-black dark:text-slate-400 font-bold text-[11px]">
                  Row #{activeIndex + 1} of {totalRows}
                </span>
              )}
            </div>
            {displayedProduct?.hsn && (
              <span className="text-[10px] text-black dark:text-slate-400 font-bold whitespace-nowrap">
                HSN: <strong className="text-black dark:text-white font-mono font-black">{displayedProduct.hsn}</strong>
                {typeof displayedProduct.gstRate === 'number' && (
                  <span> (GST {displayedProduct.gstRate}%)</span>
                )}
              </span>
            )}
          </div>

          {displayedProduct ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-black dark:text-slate-300">
              {/* Product Name & Brand */}
              <div className="sm:col-span-2 flex items-baseline flex-wrap gap-1.5">
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">Item:</span>
                <span className="text-black dark:text-white font-black text-sm tracking-tight">
                  {displayedProduct.name}
                </span>
                {displayedProduct.packing && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-black dark:text-slate-200 text-[10px] font-sans font-bold">
                    {displayedProduct.packing}
                  </span>
                )}
                {displayedProduct.manufacturer && (
                  <span className="text-[10px] text-black dark:text-slate-400 font-semibold italic">({displayedProduct.manufacturer})</span>
                )}
              </div>

              {/* Composition / Salt */}
              {displayedProduct.salt && (
                <div className="sm:col-span-2 text-[11px] text-black dark:text-indigo-300/90 font-sans font-semibold bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-1 rounded border border-indigo-200/80 dark:border-indigo-900/40">
                  <span className="text-indigo-950 dark:text-indigo-400 font-black uppercase text-[10px] font-mono mr-1">Salt:</span>
                  {displayedProduct.salt}
                </div>
              )}

              {/* Batch */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Batch: </span>
                <span className="text-amber-700 dark:text-amber-300 font-black font-mono text-xs">
                  {displayedProduct.batch || '—'}
                </span>
              </div>

              {/* Stock */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Stock: </span>
                <span className={cn('font-black font-mono text-xs', (displayedProduct.stock ?? 0) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500')}>
                  {typeof displayedProduct.stock === 'number' ? `${displayedProduct.stock} Units` : '—'}
                </span>
              </div>

              {/* Expiry */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Expiry: </span>
                <span className="text-black dark:text-white font-black font-mono text-xs">
                  {formatDisplayExpiry(displayedProduct.expiry)}
                </span>
              </div>

              {/* Sale Rate */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">SRate: </span>
                <span className="text-blue-700 dark:text-indigo-300 font-black font-mono text-xs">
                  {money(displayedProduct.saleRate)}
                </span>
              </div>

              {/* MRP */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">M.R.P.: </span>
                <span className="text-black dark:text-white font-black font-mono text-xs">
                  {money(displayedProduct.mrp)}
                </span>
              </div>

              {/* Purchase Rate */}
              <div>
                <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">P.Rate: </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-black font-mono text-xs">
                  {money(displayedProduct.purchaseRate)}
                </span>
              </div>

              {/* Optional Ref / Invoice */}
              {displayedProduct.refNo && (
                <div>
                  <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Chall./Inv: </span>
                  <span className="text-black dark:text-slate-200 font-mono text-xs font-bold">{displayedProduct.refNo}</span>
                </div>
              )}

              {/* Optional Date */}
              {displayedProduct.date && (
                <div>
                  <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Date: </span>
                  <span className="text-black dark:text-slate-200 font-mono text-xs font-bold">{displayedProduct.date}</span>
                </div>
              )}

              {/* Optional Category or Location */}
              {displayedProduct.category && (
                <div>
                  <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Category: </span>
                  <span className="text-black dark:text-slate-200 font-mono text-xs font-bold">{displayedProduct.category}</span>
                </div>
              )}
              {displayedProduct.location && (
                <div>
                  <span className="text-black dark:text-slate-400 font-extrabold uppercase text-[10px]">Location: </span>
                  <span className="text-black dark:text-slate-200 font-mono text-xs font-bold">{displayedProduct.location}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-7 text-center text-black dark:text-slate-400 text-xs font-medium">
              {emptyMessage}
            </div>
          )}
        </div>

        {/* Right: Bill Values & Account Summary (if in billing context) */}
        {billSummary && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-950/90 border-2 border-slate-300 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2 font-mono shadow-xs text-xs text-black dark:text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 pb-1.5 gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-900 dark:text-blue-300 font-black uppercase tracking-wider text-[10px]">
                {billSummary.title || 'Bill Values & Ledger'}
              </span>
              {billSummary.partyName && (
                <span className="text-[10px] text-black dark:text-slate-400 truncate max-w-[190px] font-bold" title={billSummary.partyName}>
                  {billSummary.partyLabel || 'Party'}: <strong className="text-black dark:text-white font-black">{billSummary.partyName}</strong>
                </span>
              )}
            </div>

            <div className="space-y-1 text-black dark:text-slate-300 pt-0.5">
              {typeof billSummary.mrpValue === 'number' && (
                <div className="flex justify-between">
                  <span className="text-black dark:text-slate-400 font-bold">MRP Value :</span>
                  <span className="font-black text-black dark:text-white">{formatCurrency(billSummary.mrpValue)}</span>
                </div>
              )}
              {typeof billSummary.valueOfGoods === 'number' && (
                <div className="flex justify-between">
                  <span className="text-black dark:text-slate-400 font-bold">VALUE OF GOODS :</span>
                  <span className="font-black text-black dark:text-white">{formatCurrency(billSummary.valueOfGoods)}</span>
                </div>
              )}
              {typeof (billSummary.discount ?? billSummary.discountValue) === 'number' && (
                <div className="flex justify-between">
                  <span className="text-black dark:text-slate-400 font-bold">DISCOUNT :</span>
                  <span className="font-black text-amber-700 dark:text-amber-400">
                    {((billSummary.discount ?? billSummary.discountValue) || 0) > 0 ? `-${formatCurrency((billSummary.discount ?? billSummary.discountValue) || 0)}` : '₹0.00'}
                  </span>
                </div>
              )}
              {typeof (billSummary.gstTotal ?? billSummary.gstValue) === 'number' && (
                <div className="flex justify-between">
                  <span className="text-black dark:text-slate-400 font-bold">GST% Total :</span>
                  <span className="font-black text-blue-700 dark:text-primary">+{formatCurrency((billSummary.gstTotal ?? billSummary.gstValue) || 0)}</span>
                </div>
              )}
              {typeof billSummary.partyBalance === 'number' && (
                <div className="flex justify-between border-t border-slate-300 dark:border-slate-800/80 pt-1">
                  <span className="text-black dark:text-slate-400 font-bold">Party Balance :</span>
                  <span
                    className={cn(
                      'font-black',
                      billSummary.partyBalance < 0 ? 'text-rose-600 dark:text-rose-500' : 'text-black dark:text-slate-200'
                    )}
                  >
                    {formatCurrency(Math.abs(billSummary.partyBalance))} {billSummary.partyBalance >= 0 ? 'Cr' : 'Dr'}
                  </span>
                </div>
              )}
              {typeof billSummary.grandTotal === 'number' && (
                <div className="flex justify-between border-t border-slate-300 dark:border-slate-800/80 pt-1.5 text-sm">
                  <span className="text-black dark:text-slate-200 font-black uppercase">Bill Total :</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono text-base">
                    {formatCurrency(billSummary.grandTotal)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {renderModal()}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  const hasValue = Boolean(value && value !== '—' && value.trim() !== '')
  return (
    <div className="bg-card px-5 py-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-black dark:text-muted-foreground">
        {label}
      </span>
      <strong
        className={cn(
          'mt-1 block font-mono text-sm tracking-tight',
          hasValue
            ? 'text-black dark:text-white font-bold'
            : 'text-black/60 dark:text-muted-foreground/60 font-normal'
        )}
      >
        {hasValue ? value : '—'}
      </strong>
    </div>
  )
}

function Margin({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-border bg-card p-3 shadow-2xs">
      <span className="font-mono text-[10px] uppercase font-bold text-black dark:text-muted-foreground">{label}</span>
      <strong
        className={cn(
          'mt-1 block font-mono text-base font-bold',
          value === null
            ? 'text-black/60 dark:text-muted-foreground/60 font-normal'
            : value < 0
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-emerald-700 dark:text-emerald-400 font-black'
        )}
      >
        {value === null ? '—' : `${value.toFixed(2)}%`}
      </strong>
    </div>
  )
}

function scheme(deal?: number, free?: number) {
  return typeof deal === 'number' || typeof free === 'number' ? `${deal ?? 0} + ${free ?? 0}` : undefined
}
