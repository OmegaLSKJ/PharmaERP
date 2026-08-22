import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

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
            <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@pharmaerp.com"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter password"
                  autoComplete="current-password"
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

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">Authorized PharmaERP users only.</p>
        </div>
      </div>
    </div>
  )
}
