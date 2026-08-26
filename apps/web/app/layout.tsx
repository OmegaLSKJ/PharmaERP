import type { Metadata } from 'next'
import '../../../src/index.css'

export const metadata: Metadata = {
  title: 'Borgang Drug Distributors',
  description: 'Borgang Drug Distributors operations',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>
}
