'use client'
import dynamic from 'next/dynamic'
const PharmaErpApp = dynamic(() => import('../../App'), { ssr: false })
export default function CatchAllPage() { return <PharmaErpApp /> }
