import { useRef, useEffect, useState, ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoveHorizontal
} from 'lucide-react'

interface ColumnShortcut {
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
  const [scrollWidth, setScrollWidth] = useState<number>(2000)
  const [clientWidth, setClientWidth] = useState<number>(1000)
  const [scrollLeft, setScrollLeft] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  // Measure content and container width dynamically
  useEffect(() => {
    const bottomEl = bottomScrollRef.current
    if (!bottomEl) return

    const updateMeasurements = () => {
      if (bottomEl) {
        setScrollWidth(bottomEl.scrollWidth)
        setClientWidth(bottomEl.clientWidth)
        setScrollLeft(bottomEl.scrollLeft)
      }
    }

    updateMeasurements()
    const observer = new ResizeObserver(updateMeasurements)
    observer.observe(bottomEl)
    if (bottomEl.firstElementChild) {
      observer.observe(bottomEl.firstElementChild)
    }

    window.addEventListener('resize', updateMeasurements)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [])

  // Sync Top Scrollbar -> Table Container
  const handleTopScroll = () => {
    if (isSyncing) return
    setIsSyncing(true)
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
      setScrollLeft(topScrollRef.current.scrollLeft)
    }
    requestAnimationFrame(() => setIsSyncing(false))
  }

  // Sync Table Container -> Top Scrollbar
  const handleBottomScroll = () => {
    if (isSyncing) return
    setIsSyncing(true)
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
      setScrollLeft(bottomScrollRef.current.scrollLeft)
    }
    requestAnimationFrame(() => setIsSyncing(false))
  }

  // Step scroll
  const scrollBy = (offset: number) => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  // Jump directly to percentage
  const scrollToPercent = (percent: number) => {
    if (bottomScrollRef.current) {
      const maxScroll = Math.max(0, scrollWidth - clientWidth)
      const target = maxScroll * percent
      bottomScrollRef.current.scrollTo({ left: target, behavior: 'smooth' })
    }
  }

  const maxScrollLeft = Math.max(1, scrollWidth - clientWidth)
  const currentPercent = Math.min(100, Math.max(0, Math.round((scrollLeft / maxScrollLeft) * 100)))

  return (
    <div className="space-y-1 w-full">
      {/* Subtle Fixed / Sticky Top Scroller Bar Matching the Theme */}
      <div className="bg-card/90 border border-border/80 rounded-t-xl px-3 py-1.5 shadow-xs sticky top-0 z-20 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-muted-foreground text-[11px] select-none">
              <MoveHorizontal size={13} className="text-muted-foreground" /> Top Scroller:
            </span>
            <span className="font-mono text-muted-foreground text-[11px] hidden sm:inline">
              <span className="font-medium text-foreground">{currentPercent}%</span>
            </span>
          </div>

          {/* Quick Jump Column Shortcuts */}
          <div className="hidden md:flex items-center gap-1">
            {shortcuts.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => scrollToPercent(sc.offsetPercent)}
                className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition text-[11px] font-medium"
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
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px]"
              title="Scroll to Start"
            >
              <ChevronsLeft size={13} /> Start
            </button>
            <button
              type="button"
              onClick={() => scrollBy(-350)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px]"
              title="Scroll Left"
            >
              <ChevronLeft size={13} /> Left
            </button>
            <button
              type="button"
              onClick={() => scrollBy(350)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px]"
              title="Scroll Right"
            >
              Right <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => scrollToPercent(1)}
              className="p-1 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-0.5 text-[11px]"
              title="Scroll to End"
            >
              End <ChevronsRight size={13} />
            </button>
          </div>
        </div>

        {/* Native Scrollbar Track with Subtle Colors */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          tabIndex={0}
          aria-label="Horizontal table scrollbar"
          className="w-full overflow-x-scroll overflow-y-hidden h-3.5 mt-1 bg-muted/20 border border-border/40 rounded cursor-ew-resize opacity-70 hover:opacity-100 transition-opacity"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--muted-foreground) / 0.4) transparent'
          }}
        >
          {/* Dummy element matching underlying table width */}
          <div
            style={{
              width: `${Math.max(scrollWidth, 2000)}px`,
              height: '1px'
            }}
          />
        </div>
      </div>

      {/* Table Container */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className={className || 'bg-card border border-border rounded-b-xl overflow-x-auto shadow-xs'}
      >
        {children}
      </div>
    </div>
  )
}
