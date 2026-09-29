import { useRef, useEffect, ReactNode, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoveHorizontal
} from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ColumnShortcut {
  label: string
  offsetPercent: number
}

interface TopTableScrollerProps {
  children: ReactNode
  className?: string
  shortcuts?: ColumnShortcut[]
}

const DEFAULT_SHORTCUTS: ColumnShortcut[] = [
  { label: 'Start (Product)', offsetPercent: 0 },
  { label: 'Stock & Rates', offsetPercent: 0.25 },
  { label: 'Schemes', offsetPercent: 0.55 },
  { label: 'Supplier & Invoice', offsetPercent: 0.8 },
  { label: 'End (Rack/Actions)', offsetPercent: 1.0 }
]

export default function TopTableScroller({
  children,
  className,
  shortcuts = DEFAULT_SHORTCUTS
}: TopTableScrollerProps) {
  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const topDummyRef = useRef<HTMLDivElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)
  const isSyncingRef = useRef<boolean>(false)

  const updatePercentIndicator = useCallback((scrollLeft: number) => {
    const bottomEl = bottomScrollRef.current
    if (!bottomEl || !percentRef.current) return
    const maxScroll = Math.max(1, bottomEl.scrollWidth - bottomEl.clientWidth)
    const pct = Math.min(100, Math.max(0, Math.round((scrollLeft / maxScroll) * 100)))
    percentRef.current.textContent = `${pct}%`
  }, [])

  // Sync scroll positions without triggering React re-renders
  useEffect(() => {
    const topEl = topScrollRef.current
    const bottomEl = bottomScrollRef.current
    if (!topEl || !bottomEl) return

    const handleTopScroll = () => {
      if (isSyncingRef.current) return
      isSyncingRef.current = true
      bottomEl.scrollLeft = topEl.scrollLeft
      updatePercentIndicator(topEl.scrollLeft)
      // Release sync lock on next frame
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }

    const handleBottomScroll = () => {
      if (isSyncingRef.current) return
      isSyncingRef.current = true
      topEl.scrollLeft = bottomEl.scrollLeft
      updatePercentIndicator(bottomEl.scrollLeft)
      // Release sync lock on next frame
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }

    topEl.addEventListener('scroll', handleTopScroll, { passive: true })
    bottomEl.addEventListener('scroll', handleBottomScroll, { passive: true })

    const updateMeasurements = () => {
      if (!bottomEl || !topDummyRef.current) return
      const sw = bottomEl.scrollWidth
      topDummyRef.current.style.width = `${Math.max(sw, 1000)}px`
      updatePercentIndicator(bottomEl.scrollLeft)
    }

    updateMeasurements()
    const observer = new ResizeObserver(updateMeasurements)
    observer.observe(bottomEl)
    if (bottomEl.firstElementChild) {
      observer.observe(bottomEl.firstElementChild)
    }

    window.addEventListener('resize', updateMeasurements, { passive: true })

    return () => {
      topEl.removeEventListener('scroll', handleTopScroll)
      bottomEl.removeEventListener('scroll', handleBottomScroll)
      observer.disconnect()
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [updatePercentIndicator])

  // Step scroll
  const scrollBy = (offset: number) => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  // Jump directly to percentage
  const scrollToPercent = (percent: number) => {
    if (bottomScrollRef.current) {
      const maxScroll = Math.max(0, bottomScrollRef.current.scrollWidth - bottomScrollRef.current.clientWidth)
      const target = maxScroll * percent
      bottomScrollRef.current.scrollTo({ left: target, behavior: 'smooth' })
    }
  }

  return (
    <div className="space-y-1 w-full">
      {/* Fixed / Sticky Top Scroller Bar */}
      <div className="bg-card/95 border border-border/80 rounded-t-xl px-3 py-1.5 shadow-xs sticky top-0 z-20 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-muted-foreground text-[11px] select-none">
              <MoveHorizontal size={13} className="text-muted-foreground" /> Top Scroller:
            </span>
            <span className="font-mono text-muted-foreground text-[11px] hidden sm:inline">
              <span ref={percentRef} className="font-medium text-foreground">0%</span>
            </span>
          </div>

          {/* Quick Jump Column Shortcuts */}
          <div className="hidden md:flex items-center gap-1">
            {shortcuts.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => scrollToPercent(sc.offsetPercent)}
                className="px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition text-[11px] font-medium cursor-pointer active:scale-95"
              >
                {sc.label}
              </button>
            ))}
          </div>

          {/* Step Scroll Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToPercent(0)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px] cursor-pointer active:scale-95"
              title="Scroll to Start"
            >
              <ChevronsLeft size={13} /> Start
            </button>
            <button
              type="button"
              onClick={() => scrollBy(-350)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px] cursor-pointer active:scale-95"
              title="Scroll Left"
            >
              <ChevronLeft size={13} /> Left
            </button>
            <button
              type="button"
              onClick={() => scrollBy(350)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px] cursor-pointer active:scale-95"
              title="Scroll Right"
            >
              Right <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => scrollToPercent(1)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px] cursor-pointer active:scale-95"
              title="Scroll to End"
            >
              End <ChevronsRight size={13} />
            </button>
          </div>
        </div>

        {/* Native Scrollbar Track with Subtle Colors */}
        <div
          ref={topScrollRef}
          tabIndex={0}
          aria-label="Horizontal table scrollbar"
          className="w-full overflow-x-scroll overflow-y-hidden h-3.5 mt-1 bg-muted/20 border border-border/40 rounded cursor-ew-resize opacity-80 hover:opacity-100 transition-opacity"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--muted-foreground) / 0.4) transparent',
            willChange: 'scroll-position',
            overscrollBehaviorX: 'contain'
          }}
        >
          {/* Dummy element matching underlying table width */}
          <div
            ref={topDummyRef}
            style={{
              width: '2000px',
              height: '1px'
            }}
          />
        </div>
      </div>

      {/* Table Container */}
      <div
        ref={bottomScrollRef}
        className={cn('bg-card border border-border rounded-b-xl overflow-x-auto shadow-xs', className)}
        style={{
          willChange: 'scroll-position',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>
    </div>
  )
}
