import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Users, Package, Truck, Receipt, Landmark, Database, Settings, BarChart3 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

interface CommandItem { label: string; path: string; icon: React.ReactNode; category: string }

const COMMANDS: CommandItem[] = [
  { label: 'Dashboard', path: '/', icon: <BarChart3 size={16} />, category: 'Navigation' },
  { label: 'All Parties', path: '/masters/parties', icon: <Users size={16} />, category: 'Masters' },
  { label: 'All Items', path: '/masters/items', icon: <Package size={16} />, category: 'Masters' },
  { label: 'Manufacturers', path: '/masters/manufacturers', icon: <Users size={16} />, category: 'Masters' },
  { label: 'Ledgers', path: '/masters/ledgers', icon: <Landmark size={16} />, category: 'Masters' },
  { label: 'HSN/SAC', path: '/masters/hsn', icon: <Receipt size={16} />, category: 'Masters' },
  { label: 'New Sale Invoice', path: '/transactions/sale/new', icon: <FileText size={16} />, category: 'Transactions' },
  { label: 'Sale Register', path: '/transactions/sale', icon: <FileText size={16} />, category: 'Transactions' },
  { label: 'New Purchase Entry', path: '/transactions/purchase/new', icon: <Truck size={16} />, category: 'Transactions' },
  { label: 'Stock View', path: '/inventory/stock', icon: <Database size={16} />, category: 'Inventory' },
  { label: 'GST Reports', path: '/reports/gst', icon: <Receipt size={16} />, category: 'Reports' },
  { label: 'Settings', path: '/settings', icon: <Settings size={16} />, category: 'Settings' },
]

export default function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette } = useUIStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const filtered = COMMANDS.filter((cmd) => cmd.label.toLowerCase().includes(query.toLowerCase()) || cmd.category.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggleCommandPalette() }
      if (e.key === 'Escape' && commandPaletteOpen) toggleCommandPalette()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, toggleCommandPalette])

  useEffect(() => {
    if (commandPaletteOpen) { setQuery(''); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [commandPaletteOpen])

  useEffect(() => { setSelectedIndex(0) }, [query])

  const handleSelect = (path: string) => { navigate(path); toggleCommandPalette() }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && filtered[selectedIndex]) handleSelect(filtered[selectedIndex].path)
  }

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-3 sm:px-4" onClick={toggleCommandPalette}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="glass-surface relative w-full max-w-[92vw] sm:max-w-md rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground" />
          <input ref={inputRef} type="text" placeholder="Type a command..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
          <kbd className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</div>}
          {filtered.map((cmd, i) => (
            <button key={cmd.path} onClick={() => handleSelect(cmd.path)} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left', i === selectedIndex ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
              {cmd.icon}<span className="flex-1">{cmd.label}</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{cmd.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
