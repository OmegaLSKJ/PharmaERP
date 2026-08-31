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
    <div className="space-y-1.5 w-full">
      {/* Prominent Fixed / Sticky Top Scroller Bar */}
      <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-xl p-2.5 shadow-lg space-y-2 sticky top-0 z-30 backdrop-blur-md">
        {/* Row 1: Header, Navigation Buttons, and Quick Jump Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold text-indigo-300 uppercase tracking-wide bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
              <MoveHorizontal size={13} className="text-indigo-400" /> Top Horizontal Scroller
            </span>
            <span className="font-mono text-slate-400 font-medium hidden sm:inline">
              Position: <span className="text-emerald-400 font-bold">{currentPercent}%</span>
            </span>
          </div>

          {/* Quick Jump Column Shortcuts */}
          <div className="hidden md:flex items-center gap-1">
            <span className="text-slate-500 text-[11px] mr-1">Quick Jump:</span>
            {shortcuts.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => scrollToPercent(sc.offsetPercent)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition text-[11px] font-medium"
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
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1 text-[11px]"
              title="Scroll to Start"
            >
              <ChevronsLeft size={14} /> Start
            </button>
            <button
              type="button"
              onClick={() => scrollBy(-350)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1 text-[11px]"
              title="Scroll Left"
            >
              <ChevronLeft size={14} /> Left
            </button>
            <button
              type="button"
              onClick={() => scrollBy(350)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1 text-[11px]"
              title="Scroll Right"
            >
              Right <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => scrollToPercent(1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1 text-[11px]"
              title="Scroll to End"
            >
              End <ChevronsRight size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Native Scrollbar Track (Guaranteed 18px height for full visibility on all browsers) */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          tabIndex={0}
          aria-label="Horizontal table scrollbar"
          className="w-full overflow-x-scroll overflow-y-hidden h-5 bg-slate-950 border border-slate-800 rounded-md cursor-ew-resize focus:ring-1 focus:ring-indigo-500"
          style={{
            scrollbarWidth: 'auto',
            scrollbarColor: '#6366f1 #0f172a'
          }}
        >
          {/* Dummy element that matches the full width of the underlying table */}
          <div
            style={{
              width: `${Math.max(scrollWidth, 2000)}px`,
              height: '1px'
            }}
          />
        </div>
      </div>

      {/* Actual Table Container */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className={className || 'bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm'}
      >
        {children}
      </div>
    </div>
  )
}
