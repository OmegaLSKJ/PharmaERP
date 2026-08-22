import { NextResponse } from 'next/server'
export function GET() { return NextResponse.json({ status: 'ok', service: 'pharma-erp-web', timestamp: new Date().toISOString(), databaseConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) }) }
