import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface TOption { label: string; sub?: string; right?: string }

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
}

/** Keyboard-first typeahead: type to filter, ↑↓ to move, Enter to pick, Esc to close. */
export default function Typeahead({ value, onValueChange, onChange, options, onSelect, placeholder, label, autoFocus, className }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter(o => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s))
  }, [q, options])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30)
  }, [autoFocus])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => { setQ(''); setActive(0); setOpen(true) }
  const close = () => setOpen(false)

  const updateValue = onValueChange ?? onChange
  const pick = (o: TOption) => { updateValue?.(o.label); onSelect?.(o); close(); inputRef.current?.blur() }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else setActive(a => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) pick(filtered[active])
      else { updateValue?.(q); close() }
    }
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') close()
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {label && <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? q : value}
          placeholder={placeholder}
          onFocus={openList}
          onChange={(e) => { if (!open) setOpen(true); setQ(e.target.value) }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className={cn(
            'w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 pr-11 text-sm text-white outline-none truncate',
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
          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer rounded"
        >
          <ChevronDown
            size={15}
            className={cn('transition-transform duration-200 text-slate-400', open && 'rotate-180 text-indigo-400')}
          />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-40 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] bg-slate-950 shadow-dialog">
          {filtered.map((o, i) => (
            <button
              key={o.label}
              type="button"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                i === active ? 'bg-slate-200/80 dark:bg-slate-800 text-foreground font-semibold' : 'text-slate-300'
              )}
            >
              <span className="flex-1 truncate">
                {o.label}
                {o.sub && <span className="ml-2 text-xs text-slate-500">{o.sub}</span>}
              </span>
              {o.right && <span className="font-mono text-xs text-emerald-400">{o.right}</span>}
              {i === active && <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-medium">ENTER</span>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-40 top-full mt-1 w-full rounded-xl border border-white/[0.08] bg-slate-950 shadow-dialog px-3 py-3 text-xs text-slate-500">
          No match — press <b className="text-slate-300">Enter</b> to use "{q}"
        </div>
      )}
    </div>
  )
}
