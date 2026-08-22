import { Search, Moon, Sun, Bell, Command, Menu } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Topbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme, toggleCommandPalette, setMobileSidebarOpen } = useUIStore()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const navigate = useNavigate()
  const notices = [
    { title: '3 batches expire within 30 days', detail: 'Review expiry stock', path: '/inventory/expiry' },
    { title: '14 invoices need follow-up', detail: 'Open sale register', path: '/transactions/sale' },
    { title: '5 deliveries are due today', detail: 'Open delivery desk', path: '/delivery' },
  ]

  return (
    <header className="glass-surface h-14 shrink-0 flex items-center px-4 gap-3 sticky top-0 z-10 border-x-0 border-t-0">
      <button type="button" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)} className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] md:hidden"><Menu size={19} /></button>
      {/* Command search */}
      <button onClick={toggleCommandPalette}
        className="glass-action group flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl hover:border-blue-500/40 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm transition-all duration-200 min-w-0 w-full sm:min-w-[260px] sm:max-w-md shadow-card">
        <Search size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
        <span className="flex-1 text-left">Search anything...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] text-[10px] font-mono text-slate-500">
          <Command size={9} />K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* FY chip */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        FY 2025-26 · Live
      </div>

      {/* Theme */}
      <button aria-label="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all duration-200">
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>

      {/* Notifications */}
      <div className="relative">
      <button aria-expanded={notificationsOpen} aria-label="Open notifications" onClick={() => setNotificationsOpen((open) => !open)} className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all duration-200 active:scale-95">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 flex">
          <span className="absolute w-2 h-2 rounded-full bg-rose-500 animate-ping opacity-60" />
          <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[hsl(var(--background))]" />
        </span>
      </button>
      {notificationsOpen && <div className="glass-surface absolute right-0 top-11 z-30 w-80 rounded-xl p-2">
        <div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-semibold">Action centre</span><button onClick={() => setNotificationsOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button></div>
        {notices.map((notice) => <button key={notice.title} onClick={() => { navigate(notice.path); setNotificationsOpen(false) }} className="w-full rounded-lg px-3 py-3 text-left transition hover:bg-blue-500/10 active:scale-[.99]"><span className="block text-sm font-medium">{notice.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{notice.detail}</span></button>)}
      </div>}
      </div>

      <div className="w-px h-6 bg-white/[0.07] mx-1" />

      {/* User */}
      <div className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-xl hover:bg-white/[0.04] transition-colors cursor-default">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-glow/50">
          <span className="text-white text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
        </div>
        <div className="hidden md:block leading-tight">
          <div className="text-[13px] font-semibold text-white">{user?.name || 'User'}</div>
          <div className="text-[10px] text-slate-500 capitalize">{user?.role || 'admin'}</div>
        </div>
        <button onClick={logout}
          className="ml-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
          Logout
        </button>
      </div>
    </header>
  )
}
