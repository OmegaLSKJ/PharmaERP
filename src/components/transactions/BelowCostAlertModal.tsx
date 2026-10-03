import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, RotateCcw, X, ShieldAlert } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export interface BelowCostAlertModalProps {
  open: boolean
  itemName: string
  batch?: string
  sellPrice: number
  purchasePrice: number
  currentReason?: string
  onAuthorize: (reason: string) => void
  onRevert: () => void
  onClose: () => void
}

const PRESET_REASONS = [
  'Near Expiry Clearance',
  'Damaged / Broken Seal',
  'Special Institutional / Govt Rate',
  'Management Authorized Discount',
  'Price Match / Customer Retention',
  'Bulk Quantity Clearance',
]

export default function BelowCostAlertModal({
  open,
  itemName,
  batch,
  sellPrice,
  purchasePrice,
  currentReason = '',
  onAuthorize,
  onRevert,
  onClose,
}: BelowCostAlertModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [customReason, setCustomReason] = useState<string>(currentReason)
  const [validationError, setValidationError] = useState<string>('')

  useEffect(() => {
    if (open) {
      if (currentReason && PRESET_REASONS.includes(currentReason)) {
        setSelectedPreset(currentReason)
        setCustomReason('')
      } else {
        setSelectedPreset('')
        setCustomReason(currentReason || '')
      }
      setValidationError('')
    }
  }, [open, currentReason])

  if (!open) return null

  const unitLoss = Math.max(0, purchasePrice - sellPrice)
  const lossPercentage = purchasePrice > 0 ? Math.round((unitLoss / purchasePrice) * 100) : 0

  const handleConfirm = () => {
    const finalReason = (selectedPreset || customReason).trim()
    if (!finalReason) {
      setValidationError('Please select or provide a reason to authorize selling below cost.')
      return
    }
    onAuthorize(finalReason)
    onClose()
  }

  const handleRevert = () => {
    onRevert()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-rose-500/30 dark:border-rose-500/40 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-transparent p-4 sm:p-5 border-b border-rose-500/20 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Sell Price Below Cost Alert
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Universal Rule: Sell price cannot be lower than purchase cost without explicit reason.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Medicine & Batch info */}
          <div className="bg-secondary/40 border border-border rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item:</span>
              <span className="text-sm font-bold text-foreground truncate max-w-[260px]">{itemName}</span>
            </div>
            {batch && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Batch:</span>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {batch}
                </span>
              </div>
            )}
          </div>

          {/* Pricing Comparison Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background border border-border rounded-xl p-2.5 text-center space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Entered Sell</div>
              <div className="text-sm sm:text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(sellPrice)}
              </div>
            </div>

            <div className="bg-background border border-border rounded-xl p-2.5 text-center space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Purchase Cost</div>
              <div className="text-sm sm:text-base font-mono font-bold text-foreground">
                {formatCurrency(purchasePrice)}
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-center space-y-1">
              <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Unit Loss</div>
              <div className="text-sm sm:text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                -{formatCurrency(unitLoss)} ({lossPercentage}%)
              </div>
            </div>
          </div>

          {/* Reason selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Select or Enter Authorization Reason *</span>
              <span className="text-[11px] text-muted-foreground font-normal">Required for audit trail</span>
            </label>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset) => {
                const isSelected = selectedPreset === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset)
                      setCustomReason('')
                      setValidationError('')
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-secondary/60 hover:bg-secondary text-foreground border-border'
                    }`}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>

            {/* Custom reason input */}
            <div>
              <input
                type="text"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value)
                  setSelectedPreset('')
                  setValidationError('')
                }}
                placeholder="Or type a custom reason..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
              />
            </div>

            {validationError && (
              <p className="text-xs text-rose-500 flex items-center gap-1 font-medium">
                <AlertTriangle size={13} /> {validationError}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-secondary/30 p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleRevert}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-foreground bg-card hover:bg-secondary border border-border shadow-xs transition active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Revert to Cost ({formatCurrency(purchasePrice)})</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-1/2 sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 active:scale-[0.98] transition cursor-pointer"
            >
              <CheckCircle size={14} />
              <span>Authorize Sell Price</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
