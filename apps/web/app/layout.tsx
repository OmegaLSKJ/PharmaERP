import type { Metadata } from 'next'
import '../../../src/index.css'

export const metadata: Metadata = {
  title: 'PharmaERP',
  description: 'Pharmaceutical distribution operations',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>
}
