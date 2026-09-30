import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    try {
      if (typeof window !== 'undefined') {
        if (window.indexedDB) {
          try {
            window.indexedDB.deleteDatabase('pharma_erp_cache')
          } catch {}
        }
        if (window.caches) {
          window.caches.keys().then((keys) => {
            keys.forEach((k) => window.caches.delete(k))
          }).catch(() => {})
        }
        const url = new URL(window.location.href)
        url.searchParams.set('_t', Date.now().toString())
        window.location.href = url.toString()
        return
      }
    } catch {}
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-card border border-border rounded-2xl shadow-2xl text-center space-y-4">
          <div className="inline-flex p-3 bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            An unexpected error occurred. Please reload the page. If the issue persists, check the browser console for details or contact support.
          </p>
          <div className="pt-2 flex flex-col items-center gap-2">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition shadow-md"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
            <p className="text-xs text-muted-foreground/75">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">Ctrl + Shift + R</kbd> (or <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">⌘ + Shift + R</kbd>) to hard refresh if this persists.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
