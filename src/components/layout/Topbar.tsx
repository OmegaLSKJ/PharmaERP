import { Search, Moon, Sun, Bell, Command, Menu, LogOut, User as UserIcon, Shield, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

export default function Topbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme, toggleCommandPalette, setMobileSidebarOpen } = useUIStore()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const notifRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const notices = [
    { title: '3 batches expire within 30 days', detail: 'Review expiry stock', path: '/inventory/expiry' },
    { title: '14 invoices need follow-up', detail: 'Open sale register', path: '/transactions/sale' },
    { title: '5 deliveries are due today', detail: 'Open delivery desk', path: '/delivery' },
  ]

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="no-print glass-surface h-14 shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 sticky top-0 z-30 border-x-0 border-t-0 bg-slate-950/80 backdrop-blur-md border-b border-border shadow-xs">
      {/* Left: Mobile Hamburger & Brand Name */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 active:bg-slate-800 md:hidden transition"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-1.5 sm:hidden">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            +
          </div>
          <span className="font-bold text-sm text-white tracking-tight">Pharma<span className="text-blue-500">ERP</span></span>
        </div>
      </div>

      {/* Desktop / Tablet Command Search Bar */}
      <div className="hidden sm:flex flex-1 max-w-md">
        <button
          type="button"
          onClick={toggleCommandPalette}
          className="glass-action group flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800/80 text-sm transition-all w-full shadow-xs hover:border-slate-700"
        >
          <Search size={14} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
          <span className="flex-1 text-left text-xs text-slate-400 group-hover:text-slate-200">Search pages, items, parties...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-[10px] font-mono text-slate-400">
            <Command size={10} />K
          </kbd>
        </button>
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Mobile Search Icon Button */}
        <button
          type="button"
          aria-label="Search"
          onClick={toggleCommandPalette}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 sm:hidden transition"
          title="Search (⌘K)"
        >
          <Search size={18} />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition"
          title={theme === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-expanded={notificationsOpen}
            aria-label="Notifications"
            onClick={() => {
              setNotificationsOpen((open) => !open)
              setUserMenuOpen(false)
            }}
            className={cn(
              "relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition",
              notificationsOpen && "bg-slate-850 text-white"
            )}
            title="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 animate-ping opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 z-50 w-[calc(100vw-24px)] max-w-xs sm:w-80 rounded-2xl p-2 bg-slate-900 border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80">
                <span className="text-xs font-semibold text-white">Action Centre</span>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="py-1 space-y-1">
                {notices.map((notice) => (
                  <button
                    key={notice.title}
                    type="button"
                    onClick={() => {
                      navigate(notice.path)
                      setNotificationsOpen(false)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-800/80"
                  >
                    <span className="block text-xs font-semibold text-slate-200">{notice.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{notice.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-800 mx-0.5 sm:mx-1" />

        {/* User Profile & Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen((open) => !open)
              setNotificationsOpen(false)
            }}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-850 transition"
            aria-label="User profile"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs font-semibold text-white truncate max-w-[100px]">{user?.name || 'User'}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user?.role || 'Admin'}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden md:block" />
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl p-2 bg-slate-900 border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2.5 border-b border-slate-800/80">
                <div className="text-sm font-semibold text-white">{user?.name || 'User'}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Shield size={12} className="text-blue-400" />
                  <span className="capitalize">{user?.role || 'Admin'}</span>
                </div>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition"
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
