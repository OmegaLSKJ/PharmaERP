import { useRef, useEffect, useState, ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TopTableScrollerProps {
  children: ReactNode
  className?: string
}

export default function TopTableScroller({ children, className }: TopTableScrollerProps) {
  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState<number>(0)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)

  // Measure content scroll width
  useEffect(() => {
    const bottomEl = bottomScrollRef.current
    if (!bottomEl) return

    const updateWidth = () => {
      if (bottomEl) {
        setScrollWidth(bottomEl.scrollWidth)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(bottomEl)
    if (bottomEl.firstElementChild) {
      observer.observe(bottomEl.firstElementChild)
    }

    return () => observer.disconnect()
  }, [])

  // Synchronize top -> bottom
  const handleTopScroll = () => {
    if (isScrolling) return
    setIsScrolling(true)
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => setIsScrolling(false))
  }

  // Synchronize bottom -> top
  const handleBottomScroll = () => {
    if (isScrolling) return
    setIsScrolling(true)
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => setIsScrolling(false))
  }

  const scrollBy = (offset: number) => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  return (
    <div className="space-y-0.5">
      {/* Top Fixed Scroller Toolbar */}
      <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-t-xl px-3 py-1.5 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1 select-none">
          ↔ Top Scroll:
        </span>
        <button
          type="button"
          onClick={() => scrollBy(-350)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
          title="Scroll Left"
        >
          <ChevronLeft size={14} />
        </button>
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden h-3.5 scrollbar-thin scrollbar-thumb-indigo-500/60 scrollbar-track-slate-950 rounded"
        >
          <div style={{ width: `${scrollWidth || 2000}px`, height: '1px' }} />
        </div>
        <button
          type="button"
          onClick={() => scrollBy(350)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
          title="Scroll Right"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Actual Table Container */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className={className || 'bg-slate-900/50 border border-slate-800 rounded-b-xl overflow-x-auto'}
      >
        {children}
      </div>
    </div>
  )
}
