import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export function GET() { return NextResponse.json({ status: 'ok', service: 'pharma-erp-web', timestamp: new Date().toISOString(), databaseConfigured: Boolean(process.env.DATABASE_URL) }) }
