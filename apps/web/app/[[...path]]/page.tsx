'use client'

import dynamic from 'next/dynamic'

const App = dynamic(() => import('../../../../src/App'), { ssr: false })

/** Hosts the proven ERP feature tree while the platform moves to Next.js. */
export default function ERPPage() {
  return <App />
}
