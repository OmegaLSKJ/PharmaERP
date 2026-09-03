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
  phone: '03712-260654',
  email: 'borgangdrugdistributors@gmail.com',
  fyStart: '2026-04-01',
  fyEnd: '2027-03-31',
  bankName: 'PUNJAB NATIONAL BANK',
  accountNo: '1125250029704',
  ifsc: 'PUNB0112520',
  jurisdiction: 'BISWANATH',
}


interface UIState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  theme: 'light' | 'dark'
  commandPaletteOpen: boolean
  toast: string | null
  company: CompanyProfile
  toggleSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleCommandPalette: () => void
  showToast: (message: string) => void
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  setCompanyProfile: (updates: Partial<CompanyProfile>) => void
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
        set((s) => ({ company: { ...s.company, ...updates } })),
    }),
    { name: 'erp-ui' }
  )
)
