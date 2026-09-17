import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  filterAndRankRecommendations,
  findMatchRanges,
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
        className="text-indigo-300 dark:text-indigo-400 font-semibold underline decoration-indigo-400/50 underline-offset-2"
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
 * Type to filter, ↑↓ to move, Enter to pick, Esc to close.
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
      (r) => !r.isSimilarRecommendation && ['exact', 'prefix', 'word_start', 'substring', 'token_match'].includes(r.matchType)
    )
  }, [scoredResults])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30)
  }, [autoFocus])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setQ('')
    setActive(0)
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

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
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
            'w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-3 pr-16 py-2 text-sm text-white outline-none truncate',
            'placeholder:text-slate-500 placeholder:truncate transition-colors',
            'focus:border-indigo-500/60 focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500/40'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            if (open) {
              close()
            } else {
              inputRef.current?.focus()
              openList()
            }
          }}
          aria-label="Toggle options"
          className="absolute right-5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer rounded"
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform duration-200 text-slate-400', open && 'rotate-180 text-indigo-400')}
          />
        </button>
      </div>

      {/* Auto-Recommendation Dropdown Menu */}
      {open && scoredResults.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-40 top-full mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-slate-950 shadow-dialog divide-y divide-slate-900/60"
        >
          {/* Informative Header when user types */}
          {isSearching && (
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-400" />
                {hasDirectMatch ? (
                  <>
                    Recommendations for <b className="text-slate-200">"{q}"</b>
                  </>
                ) : (
                  <>
                    <span className="text-amber-400 font-medium">No exact match</span> — suggesting similar names:
                  </>
                )}
              </span>
              <span className="text-slate-500 font-mono text-[10px]">{scoredResults.length} suggested</span>
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
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors cursor-pointer group',
                  isSelected
                    ? 'bg-indigo-600/20 text-white font-medium border-l-2 border-indigo-500'
                    : 'text-slate-300 hover:bg-slate-900'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">
                      {isSearching ? (
                        <HighlightMatch text={o.label} ranges={scored.matchedRanges} />
                      ) : (
                        o.label
                      )}
                    </span>

                    {/* Auto-Recommendation Badge */}
                    {isSearching && scored.isSimilarRecommendation && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Sparkles size={10} className="text-amber-400" />
                        Similar
                      </span>
                    )}
                    {isSearching && scored.matchType === 'exact' && (
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Exact
                      </span>
                    )}
                  </div>

                  {o.sub && (
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {o.sub}
                    </div>
                  )}
                </div>

                {o.right && (
                  <span className="shrink-0 font-mono text-xs text-emerald-400">
                    {o.right}
                  </span>
                )}

                {isSelected && (
                  <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    ENTER
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Empty State with Fallback */}
      {open && scoredResults.length === 0 && (
        <div className="absolute z-40 top-full mt-1 w-full rounded-xl border border-white/[0.08] bg-slate-950 shadow-dialog px-4 py-3.5 text-xs text-slate-400 space-y-1.5">
          <div className="text-slate-300 font-medium">No matching or similar names found for "{q}"</div>
          <p className="text-[11px] text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700 text-[10px]">Enter</kbd> to accept "{q}" as a custom name.
          </p>
        </div>
      )}
    </div>
  )
}
