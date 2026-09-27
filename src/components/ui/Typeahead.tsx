import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  filterAndRankRecommendations,
  ScoredOption,
} from '../../lib/similarity'

export interface TOption {
  label: string
  sub?: string
  right?: string
  [key: string]: any
}

interface Props {
  value: string
  onValueChange?: (v: string) => void
  /** Backward-compatible alias used by existing ERP entry forms. */
  onChange?: (v: string) => void
  options: TOption[]
  onSelect?: (o: TOption) => void
  placeholder?: string
  label?: string
  autoFocus?: boolean
  className?: string
  /** Maximum number of recommendations to display in the dropdown (default: 50) */
  maxRecommendations?: number
}

function HighlightMatch({ text, ranges }: { text: string; ranges?: [number, number][] }) {
  if (!ranges || ranges.length === 0) return <span>{text}</span>

  const parts: React.ReactNode[] = []
  let lastIdx = 0

  ranges.forEach(([start, end], idx) => {
    if (start > lastIdx) {
      parts.push(text.slice(lastIdx, start))
    }
    parts.push(
      <span
        key={idx}
        className="text-indigo-600 dark:text-indigo-400 font-semibold underline decoration-indigo-500/50 underline-offset-2"
      >
        {text.slice(start, end)}
      </span>
    )
    lastIdx = end
  })

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return <span>{parts}</span>
}

/**
 * Keyboard-first Typeahead with smart auto-recommendation & fuzzy similarity scoring.
 * Dropdown renders via React Portal (fixed to viewport) so it never overlaps sibling
 * cards or gets clipped by parent overflow / stacking contexts.
 */
export default function Typeahead({
  value,
  onValueChange,
  onChange,
  options,
  onSelect,
  placeholder,
  label,
  autoFocus,
  className,
  maxRecommendations = 50,
}: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  /** Viewport-relative rect of the trigger input */
  const [rect, setRect] = useState<DOMRect | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-recommendation & fuzzy ranking
  const scoredResults: ScoredOption<TOption>[] = useMemo(() => {
    return filterAndRankRecommendations(q, options, {
      maxResults: maxRecommendations,
      minSimilarityScore: 35,
    })
  }, [q, options, maxRecommendations])

  const hasDirectMatch = useMemo(() => {
    return scoredResults.some(
      (r) =>
        !r.isSimilarRecommendation &&
        ['exact', 'prefix', 'word_start', 'substring', 'token_match'].includes(r.matchType)
    )
  }, [scoredResults])

  /** Measure input position in the viewport (no scroll offsets — fixed positioning). */
  const measureRect = useCallback(() => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
  }, [])

  /* Close on outside click (includes portal list) */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !wrapRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* Keep position in sync while open */
  useEffect(() => {
    if (!open) return
    measureRect()
    window.addEventListener('scroll', measureRect, true)
    window.addEventListener('resize', measureRect)
    return () => {
      window.removeEventListener('scroll', measureRect, true)
      window.removeEventListener('resize', measureRect)
    }
  }, [open, measureRect])

  useEffect(() => { setActive(0) }, [q])

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30)
  }, [autoFocus])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setQ('')
    setActive(0)
    measureRect()
    setOpen(true)
  }
  const close = () => setOpen(false)

  const updateValue = onValueChange ?? onChange
  const pick = (o: TOption) => {
    const cleaned = o.label.replace(/\s+/g, ' ').trim()
    updateValue?.(cleaned)
    onSelect?.({ ...o, label: cleaned })
    close()
    inputRef.current?.blur()
  }

  const displayValue = useMemo(() => {
    if (open) return q
    return (value || '').replace(/\s+/g, ' ')
  }, [open, q, value])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else setActive((a) => Math.min(a + 1, scoredResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (scoredResults[active]) {
        pick(scoredResults[active].item)
      } else {
        updateValue?.(q.replace(/\s+/g, ' ').trim())
        close()
      }
    } else if (e.key === 'Escape') {
      close()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const isSearching = Boolean(q.trim())

  /* ── Dropdown geometry (viewport-relative / fixed) ─────────────────── */
  const dropdownTop = rect ? rect.bottom + 4 : 0
  const dropdownLeft = rect ? rect.left : 0
  const dropdownWidth = rect ? rect.width : 0
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const spaceBelow = rect ? viewportHeight - rect.bottom - 8 : 300
  const dropdownMaxHeight = Math.max(160, Math.min(spaceBelow, 320))

  /* ── Portal content ─────────────────────────────────────────────────── */
  const portalList = (
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: dropdownTop,
        left: dropdownLeft,
        width: dropdownWidth,
        maxHeight: dropdownMaxHeight,
        zIndex: 99999,
      }}
      className="overflow-y-auto rounded-xl border border-border bg-white dark:bg-zinc-900 text-foreground shadow-2xl divide-y divide-border"
    >
      {/* Sticky search-info header */}
      {isSearching && (
        <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            {hasDirectMatch ? (
              <>Recommendations for <b className="text-foreground">"{q}"</b></>
            ) : (
              <><span className="text-amber-500 font-medium">No exact match</span> — suggesting similar names:</>
            )}
          </span>
          <span className="font-mono text-[10px]">{scoredResults.length} suggested</span>
        </div>
      )}

      {scoredResults.map((scored, i) => {
        const o = scored.item
        const isSelected = i === active
        return (
          <button
            key={`${o.label}-${i}`}
            type="button"
            data-active={isSelected}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(o)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
              isSelected
                ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                : 'text-foreground hover:bg-muted/50'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate">
                  {isSearching
                    ? <HighlightMatch text={o.label} ranges={scored.matchedRanges} />
                    : o.label}
                </span>
                {isSearching && scored.isSimilarRecommendation && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    <Sparkles size={10} /> Similar
                  </span>
                )}
                {isSearching && scored.matchType === 'exact' && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                    Exact
                  </span>
                )}
              </div>
              {o.sub && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">{o.sub}</div>
              )}
            </div>
            {o.right && (
              <span className="shrink-0 font-mono text-xs text-emerald-600 dark:text-emerald-400">{o.right}</span>
            )}
            {isSelected && (
              <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                ENTER
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  const portalEmpty = (
    <div
      style={{
        position: 'fixed',
        top: dropdownTop,
        left: dropdownLeft,
        width: dropdownWidth,
        zIndex: 99999,
      }}
      className="rounded-xl border border-border bg-white dark:bg-zinc-900 shadow-2xl px-4 py-3.5 text-xs text-foreground space-y-1.5"
    >
      <div className="text-foreground font-medium">No matching or similar names found for "{q}"</div>
      <p className="text-[11px]">
        Press{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono border border-border text-[10px]">
          Enter
        </kbd>{' '}
        to accept "{q}" as a custom name.
      </p>
    </div>
  )

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onFocus={openList}
          onBlur={() => {
            if (inputRef.current) inputRef.current.scrollLeft = 0
          }}
          onChange={(e) => {
            if (!open) setOpen(true)
            setQ(e.target.value)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          style={{ paddingRight: '3.75rem' }}
          className={cn(
            'w-full bg-background border border-input rounded-lg pl-3 pr-16 py-2 text-sm text-foreground outline-none truncate',
            'placeholder:text-muted-foreground placeholder:truncate transition-colors',
            'focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/40'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            if (open) close()
            else { inputRef.current?.focus(); openList() }
          }}
          aria-label="Toggle options"
          className="absolute right-5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer rounded"
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform duration-200', open && 'rotate-180 text-primary')}
          />
        </button>
      </div>

      {/* Dropdowns via portal — rendered at document.body, always above everything */}
      {open && rect && scoredResults.length > 0 && createPortal(portalList, document.body)}
      {open && rect && scoredResults.length === 0 && isSearching && createPortal(portalEmpty, document.body)}
    </div>
  )
}
