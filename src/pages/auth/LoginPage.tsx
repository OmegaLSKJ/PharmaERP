import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteTokens, setInviteTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    if (accessToken && refreshToken && (type === 'invite' || type === 'recovery')) {
      setInviteTokens({ accessToken, refreshToken })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email, password)
    setLoading(false)
    if (ok) {
      navigate('/')
    } else {
      setError('Invalid email or password')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!inviteTokens) return
    if (password.length < 12) return setError('Use a password with at least 12 characters')
    if (password !== confirmPassword) return setError('Passwords do not match')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteTokens, password }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Unable to set password')
      window.location.assign('/')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to set password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar text-sidebar-foreground flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <div>
              <div className="text-lg font-semibold">PharmaERP</div>
              <div className="text-xs text-muted-foreground">Distribution Management System</div>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Complete Pharma<br />Distribution ERP
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Batch tracking • Expiry management • GST compliance • Real-time inventory
          </p>
        </div>
        <div className="relative z-10 text-xs text-muted-foreground">
          Powered by MARG ERP architecture
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <div>
              <div className="text-lg font-semibold">PharmaERP</div>
              <div className="text-xs text-muted-foreground">Distribution Management System</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-2">{inviteTokens ? 'Set your password' : 'Welcome back'}</h2>
            <p className="text-sm text-muted-foreground">
              {inviteTokens ? 'Create a secure password to activate your ERP account.' : 'Sign in to your account to continue'}
            </p>
          </div>

          <form onSubmit={inviteTokens ? handleInvite : handleSubmit} className="space-y-4">
            {!inviteTokens && <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@company.com"
                autoComplete="username"
                autoFocus
                required
              />
            </div>}
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter password"
                  autoComplete={inviteTokens ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {inviteTokens && <div>
              <label className="block text-sm font-medium mb-1.5">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum 12 characters.</p>
            </div>}

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (inviteTokens ? 'Activating...' : 'Signing in...') : (inviteTokens ? 'Activate account' : 'Sign In')}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">Authorized PharmaERP users only.</p>
        </div>
      </div>
    </div>
  )
}
