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
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileSidebarOpen(true)}
        className="p-2 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary md:hidden"
      >
        <Menu size={19} />
      </button>

      {/* Command search */}
      <button
        onClick={toggleCommandPalette}
        className="glass-action group flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm transition-all duration-150 min-w-0 w-full sm:min-w-[260px] sm:max-w-md shadow-sm"
      >
        <Search size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left text-xs text-muted-foreground group-hover:text-foreground">Search anything...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[9px] font-mono text-muted-foreground">
          <Command size={8} />K
        </kbd>
      </button>

      <div className="flex-1" />



      {/* Theme */}
      <button
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150"
      >
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          aria-expanded={notificationsOpen}
          aria-label="Open notifications"
          onClick={() => setNotificationsOpen((open) => !open)}
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150 active:scale-95"
        >
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 flex">
            <span className="absolute w-2 h-2 rounded-full bg-rose-500 animate-ping opacity-60" />
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-background" />
          </span>
        </button>
        {notificationsOpen && (
          <div className="glass-surface absolute right-0 top-11 z-30 w-80 rounded-lg p-2 border border-border">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-xs font-semibold">Action centre</span>
              <button onClick={() => setNotificationsOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            {notices.map((notice) => (
              <button
                key={notice.title}
                onClick={() => {
                  navigate(notice.path)
                  setNotificationsOpen(false)
                }}
                className="w-full rounded-md px-3 py-2 text-left transition hover:bg-secondary active:scale-[.99]"
              >
                <span className="block text-xs font-semibold text-foreground">{notice.title}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{notice.detail}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* User */}
      <div className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-md hover:bg-secondary transition-colors cursor-default">
        <div className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
        </div>
        <div className="hidden md:block leading-tight">
          <div className="text-[12px] font-semibold text-foreground">{user?.name || 'User'}</div>
          <div className="text-[9px] text-muted-foreground capitalize">{user?.role || 'admin'}</div>
        </div>
        <button
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
          className="ml-1 px-2 py-1 rounded border border-border bg-card text-[10px] font-semibold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all duration-150"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
