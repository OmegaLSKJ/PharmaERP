import React, { useState } from 'react'
import { Printer } from 'lucide-react'
import { smartPrint, PrintOrientation } from '../../lib/printUtils'
import { cn } from '../../lib/utils'

export interface PrintButtonProps {
  /**
   * Button label, e.g. "Print Invoice", "Print Register", "Print Statement"
   */
  label?: string

  /**
   * Target element selector or HTMLElement to print
   */
  target?: string | HTMLElement | null

  /**
   * Default orientation if user has not changed selector: 'auto' | 'portrait' | 'landscape'
   */
  defaultOrientation?: PrintOrientation

  /**
   * Hint for auto orientation: 'portrait' | 'landscape'
   */
  autoOrientationHint?: 'portrait' | 'landscape'

  /**
   * Callback fired before print dialog is opened (e.g. to set active document state)
   */
  onBeforePrint?: () => void | Promise<void>

  /**
   * Styling overrides
   */
  className?: string
  buttonClassName?: string
  selectClassName?: string
  size?: 'sm' | 'md'
  variant?: 'outline' | 'primary' | 'secondary'

  /**
   * Disabled state
   */
  disabled?: boolean

  /**
   * Optional shortcut key badge, e.g. "Ctrl+P"
   */
  kbd?: string

  /**
   * Tooltip / title text
   */
  title?: string
}

export default function PrintButton({
  label = 'Print',
  target,
  defaultOrientation = 'auto',
  autoOrientationHint,
  onBeforePrint,
  className,
  buttonClassName,
  selectClassName,
  size = 'md',
  variant = 'outline',
  disabled = false,
  kbd,
  title,
}: PrintButtonProps) {
  const [orientation, setOrientation] = useState<PrintOrientation>(defaultOrientation)

  // Compute effective orientation for the badge preview
  const resolvedAutoHint = autoOrientationHint || 'portrait'

  const handlePrint = async () => {
    if (disabled) return

    if (onBeforePrint) {
      await onBeforePrint()
    }

    // Pass the orientation to smartPrint
    smartPrint({
      orientation: orientation === 'auto' && autoOrientationHint ? autoOrientationHint : orientation,
      target,
    })
  }

  const badgeText =
    orientation === 'auto'
      ? `Auto (${resolvedAutoHint === 'landscape' ? 'Landscape' : 'Portrait'})`
      : orientation === 'landscape'
      ? 'Landscape'
      : 'Portrait'

  const isPrimary = variant === 'primary'
  const isSecondary = variant === 'secondary'

  return (
    <div
      className={cn(
        'inline-flex items-stretch rounded-lg shadow-xs overflow-hidden border transition-all select-none',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
        isPrimary
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : isSecondary
          ? 'border-border bg-secondary text-foreground'
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100',
        className
      )}
      title={
        title ||
        `${label} (Automatically formatted to fit into the page with optimal orientation)`
      }
    >
      {/* Main Print Trigger Button */}
      <button
        type="button"
        onClick={handlePrint}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 transition-colors cursor-pointer border-r font-semibold',
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm',
          isPrimary
            ? 'hover:bg-indigo-700 border-indigo-500/50 text-white'
            : isSecondary
            ? 'hover:bg-secondary/80 border-border text-foreground'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100',
          buttonClassName
        )}
      >
        <Printer
          size={size === 'sm' ? 13 : 15}
          className={cn(
            'shrink-0',
            isPrimary ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'
          )}
        />
        <span>{label}</span>
        {kbd && (
          <kbd className="hidden sm:inline-flex items-center px-1 py-0.2 text-[9px] font-mono font-medium opacity-70 bg-black/10 dark:bg-white/10 rounded">
            {kbd}
          </kbd>
        )}
        <span
          className={cn(
            'hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-none tracking-tight',
            isPrimary
              ? 'bg-white/20 text-white'
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
          )}
        >
          {badgeText}
        </span>
      </button>

      {/* Interactive Fit-to-Page Orientation Selector */}
      <select
        value={orientation}
        disabled={disabled}
        onChange={(e) => setOrientation(e.target.value as PrintOrientation)}
        className={cn(
          'px-2 py-1 bg-transparent text-[11px] font-semibold cursor-pointer outline-none transition-colors',
          isPrimary
            ? 'text-white hover:bg-indigo-700'
            : isSecondary
            ? 'text-foreground hover:bg-secondary/80'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700',
          selectClassName
        )}
        title="Page layout & fit: Auto chooses between Landscape and Portrait for best visibility and fit into page"
      >
        <option value="auto" className="bg-white dark:bg-slate-900 text-black dark:text-white">
          Auto (Fit Page)
        </option>
        <option value="portrait" className="bg-white dark:bg-slate-900 text-black dark:text-white">
          Portrait (Vertical)
        </option>
        <option value="landscape" className="bg-white dark:bg-slate-900 text-black dark:text-white">
          Landscape (Wide)
        </option>
      </select>
    </div>
  )
}
