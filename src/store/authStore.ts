import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'operator'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, password) => {
        if (email && password.length >= 4) {
          set({
            user: {
              id: '1',
              name: email.split('@')[0].replace(/[._]/g, ' '),
              email,
              role: 'admin',
            },
            isAuthenticated: true,
          })
          return true
        }
        return false
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'erp-auth' }
  )
)
