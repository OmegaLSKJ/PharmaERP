import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from '../ui/CommandPalette'
import Toast from '../ui/Toast'
import ErrorBoundary from '../common/ErrorBoundary'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useKeyboardFormNavigation } from '../../hooks/useKeyboardFormNavigation'
import { useEffect } from 'react'

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initialized = useAuthStore((s) => s.initialized)
  const hydrate = useAuthStore((s) => s.hydrate)
  const theme = useUIStore((s) => s.theme)
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen)
  const location = useLocation()
  useKeyboardShortcuts()
  useKeyboardFormNavigation()

  useEffect(() => { void hydrate() }, [hydrate])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname, setMobileSidebarOpen])

  if (!initialized) return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Checking your secure session…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="no-print print:hidden shrink-0" data-no-print>
        <Sidebar />
      </div>
      {mobileSidebarOpen && (
        <button type="button" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} className="no-print print:hidden fixed inset-0 z-10 bg-slate-950/60 backdrop-blur-[1px] md:hidden" />
      )}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Ambient background glow */}
        <div className="no-print print:hidden pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-40 right-[10%] w-[560px] h-[360px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
          <div className="absolute bottom-[-160px] left-[20%] w-[480px] h-[320px] rounded-full bg-emerald-600/[0.04] blur-[110px]" />
        </div>
        <div className="no-print print:hidden shrink-0" data-no-print>
          <Topbar />
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6 relative z-[1]" aria-label="ERP workspace">
          <ErrorBoundary>
            <div key={location.pathname} className="page-enter min-h-full">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
      <Toast />
    </div>
  )
}
