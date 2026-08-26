import type { Metadata } from 'next'
import '../index.css'
export const metadata: Metadata = { title: 'Borgang Drug Distributors', description: 'Borgang Drug Distributors ERP' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
