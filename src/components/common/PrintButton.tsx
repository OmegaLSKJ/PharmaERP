import React, { useState } from 'react'
import { Printer, ChevronDown } from 'lucide-react'
import { smartPrint, PrintOrientation } from '../../lib/printUtils'
import { cn } from '../../lib/utils'

export { default as ModifyButton } from './ModifyButton'
export type { ModifyButtonProps } from './ModifyButton'

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
  variant = 'primary',
  disabled = false,
  kbd,
  title,
}: PrintButtonProps) {
  const [orientation, setOrientation] = useState<PrintOrientation>(defaultOrientation)

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

  const isPrimary = variant === 'primary'
  const isSecondary = variant === 'secondary'

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl shadow-xs overflow-hidden border transition-all duration-150 select-none group',
        size === 'sm' ? 'h-8' : 'h-9',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
        isPrimary
          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:via-indigo-500 hover:to-indigo-600 text-white border-indigo-400/30 shadow-sm shadow-indigo-500/15 hover:shadow-indigo-500/25 active:scale-[0.99]'
          : isSecondary
          ? 'bg-secondary hover:bg-secondary/80 text-foreground border-border shadow-2xs hover:shadow-xs active:scale-[0.99]'
          : 'bg-card hover:bg-muted text-card-foreground border-border shadow-2xs hover:shadow-xs active:scale-[0.99]',
        className
      )}
      title={
        title ||
        `${label} (Auto-formatted to fit perfectly onto the page)`
      }
    >
      {/* Main Print Trigger Button */}
      <button
        type="button"
        onClick={handlePrint}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 h-full transition-all cursor-pointer font-semibold tracking-tight',
          size === 'sm' ? 'px-2.5 text-xs' : 'px-3.5 text-xs sm:text-sm',
          isPrimary
            ? 'text-white hover:bg-white/10 active:bg-white/15'
            : isSecondary
            ? 'text-foreground hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10'
            : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10',
          buttonClassName
        )}
      >
        <Printer
          size={size === 'sm' ? 13 : 15}
          className={cn(
            'shrink-0 transition-transform duration-150 group-hover:scale-105',
            isPrimary ? 'text-white' : 'text-primary'
          )}
        />
        <span>{label}</span>
        {kbd && (
          <kbd
            className={cn(
              'hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium rounded tracking-wide shadow-2xs',
              isPrimary
                ? 'bg-black/20 text-white/90 border border-white/10'
                : 'bg-muted text-muted-foreground border border-border'
            )}
          >
            {kbd}
          </kbd>
        )}
      </button>

      {/* Sleek Vertical Divider */}
      <div
        className={cn(
          'w-px self-stretch my-1.5 shrink-0',
          isPrimary ? 'bg-white/20' : 'bg-border'
        )}
      />

      {/* Interactive Fit-to-Page Orientation Dropdown */}
      <div className="relative flex items-center h-full">
        <select
          value={orientation}
          disabled={disabled}
          onChange={(e) => setOrientation(e.target.value as PrintOrientation)}
          className={cn(
            'appearance-none pl-2.5 pr-6 py-1 bg-transparent text-[11px] font-semibold cursor-pointer outline-none transition-colors border-none focus:ring-0 h-full',
            isPrimary
              ? 'text-white/90 hover:text-white hover:bg-white/10'
              : isSecondary
              ? 'text-foreground/90 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              : 'text-foreground/90 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5',
            selectClassName
          )}
          title="Page fit layout: Auto optimizes between Portrait and Landscape for full single-page fit"
        >
          <option value="auto" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            Auto (Fit Page)
          </option>
          <option value="portrait" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            Portrait (A4)
          </option>
          <option value="landscape" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            Landscape (Wide)
          </option>
        </select>
        <ChevronDown
          size={12}
          className={cn(
            'pointer-events-none absolute right-2 opacity-75 shrink-0',
            isPrimary ? 'text-white' : 'text-foreground'
          )}
        />
      </div>
    </div>
  )
}
