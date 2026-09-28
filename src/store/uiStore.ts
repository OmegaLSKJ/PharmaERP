import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CompanyProfile {
  companyName: string
  address: string
  pincode: string
  city: string
  state: string
  country: string
  gstin: string
  pan: string
  dlNo: string
  phone: string
  email: string
  fyStart: string
  fyEnd: string
  // Banking & legal
  bankName: string
  accountNo: string
  ifsc: string
  jurisdiction: string
}

const DEFAULT_COMPANY: CompanyProfile = {
  companyName: 'BORGANG DRUG DISTRIBUTORS',
  address: 'BORGANG, BISWANATH, ASSAM',
  pincode: '784167',
  city: 'BORGANG',
  state: '18-ASSAM',
  country: 'INDIA',
  gstin: '18AKWPP4417G1ZN',
  pan: 'AKWPP4417G',
  dlNo: 'DNG/622/623',
  phone: '+91 6000763703',
  email: 'borgangdrugdistributors@gmail.com',
  fyStart: '2026-04-01',
  fyEnd: '2027-03-31',
  bankName: 'PUNJAB NATIONAL BANK',
  accountNo: '1125250029704',
  ifsc: 'PUNB0112520',
  jurisdiction: 'BISWANATH',
}

const companyChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('erp-company-profile')
    : null

interface UIState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  theme: 'light' | 'dark'
  commandPaletteOpen: boolean
  toast: string | null
  company: CompanyProfile
  /** Incremented every time a voucher/challan/walk-in sale is saved so that
   *  LedgerView (and other views) can re-fetch immediately. */
  ledgerVersion: number
  toggleSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleCommandPalette: () => void
  showToast: (message: string) => void
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  setCompanyProfile: (updates: Partial<CompanyProfile>) => void
  incrementLedgerVersion: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      theme: 'dark',
      commandPaletteOpen: false,
      toast: null,
      company: DEFAULT_COMPANY,
      ledgerVersion: 0,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      showToast: (toast) => set({ toast }),
      addToast: (toast) => set({ toast }),
      clearToast: () => set({ toast: null }),
      setCompanyProfile: (updates) =>
        set((s) => {
          const nextCompany = { ...s.company, ...updates }
          if (companyChannel) {
            try {
              companyChannel.postMessage({ company: nextCompany })
            } catch {
              // Ignore broadcast errors
            }
          }
          return { company: nextCompany }
        }),
      incrementLedgerVersion: () => set((s) => ({ ledgerVersion: s.ledgerVersion + 1 })),
    }),
    {
      name: 'erp-ui',
      merge: (persistedState: any, currentState) => {
        const persistedCompany = persistedState?.company || {}
        // Migrate old placeholder phone if present
        if (persistedCompany.phone === '03712-260654') {
          persistedCompany.phone = '+91 6000763703'
        }
        return {
          ...currentState,
          ...persistedState,
          company: {
            ...DEFAULT_COMPANY,
            ...(currentState.company || {}),
            ...persistedCompany,
          },
        }
      },
    }
  )
)

// Cross-window and cross-tab reactive synchronization
if (companyChannel) {
  companyChannel.onmessage = (event) => {
    if (event.data?.company) {
      useUIStore.setState((s) => ({
        company: { ...s.company, ...event.data.company },
      }))
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'erp-ui' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue)
        if (parsed?.state?.company) {
          useUIStore.setState((s) => ({
            company: { ...s.company, ...parsed.state.company },
          }))
        }
      } catch {
        // Ignore parse errors from concurrent writes
      }
    }
  })
}
