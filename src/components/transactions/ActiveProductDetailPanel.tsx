import React from 'react'
import { cn, formatCurrency } from '../../lib/utils'

export interface ActiveProductDetail {
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
  refNo?: string
  date?: string
  category?: string
  location?: string
}

export interface ActiveBillSummary {
  title?: string
  partyLabel?: string
  partyName?: string
  partyBalance?: number
  mrpValue?: number
  valueOfGoods?: number
  discount?: number
  gstTotal?: number
  grandTotal?: number
}

export interface ActiveProductDetailPanelProps {
  activeProduct?: ActiveProductDetail | null
  billSummary?: ActiveBillSummary | null
  totalRows?: number
  activeIndex?: number
  emptyMessage?: string
  className?: string
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
}: ActiveProductDetailPanelProps) {
  const hasBillSummary = Boolean(billSummary)

  return (
    <div className={cn('border-t border-slate-300 dark:border-slate-800 pt-3', className)}>
      <div className={cn('grid gap-3.5', hasBillSummary ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1')}>
        {/* Left / Main: Active Product Live Inspection Box */}
        <div
          className={cn(
            'bg-slate-100/95 dark:bg-slate-950/90 border-2 border-slate-300 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2.5 font-mono shadow-xs text-xs transition-all',
            hasBillSummary ? 'lg:col-span-7' : 'w-full'
          )}
        >
          {/* Header Strip */}
          <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 pb-1.5 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                Product Description
              </span>
              {typeof totalRows === 'number' && totalRows > 0 && activeProduct && (
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Row #{activeIndex + 1} of {totalRows}
                </span>
              )}
            </div>
            {activeProduct?.hsn && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                HSN: <strong className="text-slate-800 dark:text-white font-mono">{activeProduct.hsn}</strong>
                {typeof activeProduct.gstRate === 'number' && (
                  <span> (GST {activeProduct.gstRate}%)</span>
                )}
              </span>
            )}
          </div>

          {activeProduct ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700 dark:text-slate-300">
              {/* Product Name & Brand */}
              <div className="sm:col-span-2 flex items-baseline flex-wrap gap-1.5">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Item:</span>
                <span className="text-slate-900 dark:text-white font-extrabold text-sm tracking-tight">
                  {activeProduct.name}
                </span>
                {activeProduct.packing && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-sans font-semibold">
                    {activeProduct.packing}
                  </span>
                )}
                {activeProduct.manufacturer && (
                  <span className="text-[10px] text-slate-500 italic">({activeProduct.manufacturer})</span>
                )}
              </div>

              {/* Composition / Salt */}
              {activeProduct.salt && (
                <div className="sm:col-span-2 text-[11px] text-indigo-700 dark:text-indigo-300/90 font-sans font-medium bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-1 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                  <span className="text-indigo-500 dark:text-indigo-400 font-bold uppercase text-[10px] font-mono mr-1">Salt:</span>
                  {activeProduct.salt}
                </div>
              )}

              {/* Batch */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">Batch: </span>
                <span className="text-amber-600 dark:text-amber-300 font-bold font-mono text-xs">
                  {activeProduct.batch || '—'}
                </span>
              </div>

              {/* Stock */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">Stock: </span>
                <span className={cn('font-bold font-mono text-xs', (activeProduct.stock ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                  {typeof activeProduct.stock === 'number' ? `${activeProduct.stock} Units` : '—'}
                </span>
              </div>

              {/* Expiry */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">Expiry: </span>
                <span className="text-slate-800 dark:text-white font-bold font-mono text-xs">
                  {formatDisplayExpiry(activeProduct.expiry)}
                </span>
              </div>

              {/* Sale Rate */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">SRate: </span>
                <span className="text-indigo-600 dark:text-indigo-300 font-bold font-mono text-xs">
                  ₹{Number(activeProduct.saleRate || 0).toFixed(2)}
                </span>
              </div>

              {/* MRP */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">M.R.P.: </span>
                <span className="text-slate-900 dark:text-white font-bold font-mono text-xs">
                  ₹{Number(activeProduct.mrp || 0).toFixed(2)}
                </span>
              </div>

              {/* Purchase Rate */}
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">P.Rate: </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs">
                  ₹{Number(activeProduct.purchaseRate || 0).toFixed(2)}
                </span>
              </div>

              {/* Optional Ref / Invoice */}
              {activeProduct.refNo && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Chall./Inv: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{activeProduct.refNo}</span>
                </div>
              )}

              {/* Optional Date */}
              {activeProduct.date && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Date: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{activeProduct.date}</span>
                </div>
              )}

              {/* Optional Category or Location */}
              {activeProduct.category && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Category: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{activeProduct.category}</span>
                </div>
              )}
              {activeProduct.location && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Location: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{activeProduct.location}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-7 text-center text-slate-400 text-xs">
              {emptyMessage}
            </div>
          )}
        </div>

        {/* Right: Bill Values & Account Summary (if in billing context) */}
        {billSummary && (
          <div className="lg:col-span-5 bg-slate-100/95 dark:bg-slate-950/90 border-2 border-slate-300 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2 font-mono shadow-xs text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 pb-1.5 gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider text-[10px]">
                {billSummary.title || 'Bill Values & Ledger'}
              </span>
              {billSummary.partyName && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[190px]" title={billSummary.partyName}>
                  {billSummary.partyLabel || 'Party'}: <strong className="text-slate-800 dark:text-white">{billSummary.partyName}</strong>
                </span>
              )}
            </div>

            <div className="space-y-1 text-slate-700 dark:text-slate-300 pt-0.5">
              {typeof billSummary.mrpValue === 'number' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">MRP Value :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(billSummary.mrpValue)}</span>
                </div>
              )}
              {typeof billSummary.valueOfGoods === 'number' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">VALUE OF GOODS :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(billSummary.valueOfGoods)}</span>
                </div>
              )}
              {typeof billSummary.discount === 'number' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">DISCOUNT :</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {billSummary.discount > 0 ? `-${formatCurrency(billSummary.discount)}` : '₹0.00'}
                  </span>
                </div>
              )}
              {typeof billSummary.gstTotal === 'number' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">GST% Total :</span>
                  <span className="font-bold text-primary">+{formatCurrency(billSummary.gstTotal)}</span>
                </div>
              )}
              {typeof billSummary.partyBalance === 'number' && (
                <div className="flex justify-between border-t border-slate-300 dark:border-slate-800/80 pt-1">
                  <span className="text-slate-500">Party Balance :</span>
                  <span
                    className={cn(
                      'font-bold',
                      billSummary.partyBalance < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                    )}
                  >
                    {formatCurrency(Math.abs(billSummary.partyBalance))} {billSummary.partyBalance >= 0 ? 'Cr' : 'Dr'}
                  </span>
                </div>
              )}
              {typeof billSummary.grandTotal === 'number' && (
                <div className="flex justify-between border-t border-slate-300 dark:border-slate-800/80 pt-1.5 text-sm">
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold uppercase">Bill Total :</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">
                    {formatCurrency(billSummary.grandTotal)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
