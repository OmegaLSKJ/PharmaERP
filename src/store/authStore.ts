import { create } from 'zustand'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'operator'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  initialized: boolean
  login: (email: string, password: string) => Promise<boolean>
  hydrate: () => Promise<void>
  logout: () => Promise<void>
}

async function userFrom(response: Response) {
  if (!response.ok) return null
  const payload = await response.json()
  return payload.data as User
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  initialized: false,
  login: async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const user = await userFrom(response)
      set({ user, isAuthenticated: Boolean(user), initialized: true })
      return Boolean(user)
    } catch {
      set({ user: null, isAuthenticated: false, initialized: true })
      return false
    }
  },
  hydrate: async () => {
    if (get().initialized) return
    try {
      const user = await userFrom(await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }))
      set({ user, isAuthenticated: Boolean(user), initialized: true })
    } catch {
      set({ user: null, isAuthenticated: false, initialized: true })
    }
  },
  logout: async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } finally {
      set({ user: null, isAuthenticated: false, initialized: true })
    }
  },
}))
