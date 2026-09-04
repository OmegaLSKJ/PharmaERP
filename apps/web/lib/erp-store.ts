import 'server-only'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'


export type LedgerEntry = { id: string; party: string; date: string; vType: string; vNo: string; debit: number; credit: number; narration: string }
type Line = { name: string; batch: string; qty: number; rate: number; amount?: number; expiry?: string; freeQty?: number; discount?: number; gstRate?: number; mrp?: number }
export type MutationActor = { id?: string; email?: string; requestId?: string }
const date = () => new Date().toISOString().slice(0, 10)
const number = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
const organizationName = process.env.ERP_ORGANIZATION_NAME ?? 'Borgang Drug Distributors'

// OPTION B: In-memory mock database state for local offline development
const mockStore: Record<string, any[]> = {
  parties: [
    { id: 'p1', code: 'PTY-001', name: 'Apollo Pharmacy', type: 'both', phone: '9876543210', email: 'apollo@pharmacy.com', city: 'Mumbai', gstin: '27AAAAA1111A1Z1', balance: 12500, creditLimit: 50000, lastSale: '2026-08-25', status: 'active' },
    { id: 'p2', code: 'PTY-002', name: 'MedPlus Chemist', type: 'both', phone: '9876543211', email: 'medplus@chemist.com', city: 'Delhi', gstin: '07BBBBB2222B2Z2', balance: 8450, creditLimit: 40000, lastSale: '2026-08-25', status: 'active' },
    { id: 'p3', code: 'PTY-003', name: 'Cipla Logistics', type: 'both', phone: '9876543212', email: 'cipla@logistics.com', city: 'Pune', gstin: '27CCCCC3333C3Z3', balance: -35000, creditLimit: 200000, lastSale: '2026-08-20', status: 'active' }
  ],
  items: [
    { id: 'i1', code: 'ITM-001', name: 'Paracetamol 650mg', packing: '10x15 Tabs', manufacturer: 'Cipla Ltd', salt: 'Paracetamol', hsn: '30049011', gstRate: 12, mrp: 20, saleRate: 15, purchaseRate: 12, scheduleClass: 'OTC', prescriptionRequired: false, coldChain: false, controlledSubstance: false, recalled: false, stock: 120, batches: [{ id: 'b1', batch: 'PCT-0192', expiry: '2026-09-30', mrp: 20, stock: 120, stockByLocation: { 'Main Warehouse': 120 } }], batchCount: 1, category: 'Analgesic', status: 'active' },
    { id: 'i2', code: 'ITM-002', name: 'Amoxicillin 500mg', packing: '10x10 Caps', manufacturer: 'GlaxoSmithKline', salt: 'Amoxicillin', hsn: '30041010', gstRate: 18, mrp: 60, saleRate: 48, purchaseRate: 38, scheduleClass: 'Rx', prescriptionRequired: true, coldChain: false, controlledSubstance: false, recalled: false, stock: 45, batches: [{ id: 'b2', batch: 'AMX-8821', expiry: '2026-09-15', mrp: 60, stock: 45, stockByLocation: { 'Main Warehouse': 45 } }], batchCount: 1, category: 'Antibiotic', status: 'active' }
  ],
  hsn: [
    { id: 'h1', code: '30049011', description: 'Formulations of Paracetamol', gst_rate: 12 },
    { id: 'h2', code: '30041010', description: 'Penicillins / Amoxicillin', gst_rate: 18 }
  ],
  manufacturers: [
    { id: 'm1', name: 'Cipla Ltd', code: 'CIPLA', is_active: true },
    { id: 'm2', name: 'GlaxoSmithKline', code: 'GSK', is_active: true }
  ],
  salts: [
    { id: 's1', code: 'SALT-001', name: 'Paracetamol', composition: 'N-(4-hydroxyphenyl)acetamide', category: 'Analgesic', itemcount: 1 },
    { id: 's2', code: 'SALT-002', name: 'Amoxicillin', composition: 'Amoxicillin Trihydrate', category: 'Antibiotic', itemcount: 1 }
  ],
  warehouses: [
    { id: 'w1', code: 'MAIN', name: 'Main Warehouse', type: 'Distribution Center', address: 'Bldg 4, Sector 2, MIDC', capacity: 10000, used: 165, status: 'active' }
  ],
  accounts: [
    { id: 'a1', code: 'ACC-CASH', name: 'Cash Account', group: 'Cash-in-hand', balance: 45000, type: 'Dr', active: true },
    { id: 'a2', code: 'ACC-HDFC', name: 'HDFC Bank', group: 'Bank Accounts', balance: 280000, type: 'Dr', active: true }
  ],
  series: [
    { id: 'se1', doc: 'Sale Invoice', prefix: 'SI-', suffix: '', nextNo: 5, padding: 4, fyReset: true, active: true }
  ],
  'communication-blocks': [
    { id: 'cb1', type: 'email', value: 'spammer@unreliable.com', reason: 'Bounced multiple times', blockedOn: '2026-08-20' }
  ],
  vouchers: [
    { id: 'v1', voucher_type: 'journal', voucher_number: 'VCH-2026-0001', voucher_date: '2026-08-25', status: 'posted', narration: 'Daily sales transfer' }
  ],
  ledgers: [
    { id: 'l1', party: 'Apollo Pharmacy', date: '2026-08-25', vType: 'sale', vNo: 'SI-2026-0001', debit: 12500, credit: 0, narration: 'Sales posted' }
  ],
  sales: [
    {
      id: 's1',
      number: 'SI-2026-427428',
      party: 'BORGANG MEDICAL HALL',
      date: '2026-08-29',
      status: 'posted',
      items: 2,
      total: 1858,
      patientName: 'Rahul Das',
      prescriberName: 'Dr. S. K. Sarma',
      prescriptionReference: 'RX-9942',
      lines: [
        { id: 'l1', name: 'A TO Z SYP 200ML', batch: '25660899', stock: 23, qty: 10, free: 0, rate: 156.61, disc: 0, gst: 12, amount: 1566.10 },
        { id: 'l2', name: 'A TO Z DROP 30ML', batch: '25498738', stock: 6, qty: 2, free: 0, rate: 101.70, disc: 0, gst: 12, amount: 203.40 }
      ]
    },
    {
      id: 's2',
      number: 'SI-2026-835779',
      party: 'Bdd',
      date: '2026-08-29',
      status: 'posted',
      items: 1,
      total: 586,
      lines: [
        { id: 'l3', name: '3- NITE CAP 3', batch: '25518235', stock: 5, qty: 4, free: 0, rate: 142.14, disc: 0, gst: 12, amount: 568.56 }
      ]
    },
    {
      id: 's3',
      number: 'SI-2026-0002',
      party: 'MedPlus Chemist',
      date: '2026-08-25',
      status: 'pending',
      items: 2,
      total: 8450,
      lines: [
        { id: 'l4', name: 'A TO Z GOLD CAP 15', batch: '25500429', stock: 8, qty: 40, free: 2, rate: 167.43, disc: 2, gst: 12, amount: 6563.26 },
        { id: 'l5', name: '3- NITE CAP 3', batch: '25518686', stock: 3, qty: 13, free: 0, rate: 142.14, disc: 0, gst: 12, amount: 1847.82 }
      ]
    },
    {
      id: 's4',
      number: 'SI-2026-0003',
      party: 'Apollo Pharmacy',
      date: '2026-08-26',
      status: 'posted',
      items: 1,
      total: 3200,
      lines: [
        { id: 'l6', name: 'A TO Z NS DROPS 30ML', batch: '25490738', stock: 6, qty: 30, free: 0, rate: 101.68, disc: 0, gst: 12, amount: 3050.40 }
      ]
    }
  ],
  purchases: [
    { id: 'pu1', number: 'PB-2026-0001', party: 'Cipla Logistics', date: '2026-08-20', status: 'received', items: 5, total: 35000 }
  ],
  challans: [
    { id: 'ch1', number: 'CH-2026-0001', party: 'Apollo Pharmacy', date: '2026-08-24', transport: 'Express Cargo', status: 'delivered' }
  ],
  orders: []
}

// Load dynamic mock stock data from Excel backup if it exists
try {
  const rootMockPath = path.resolve(process.cwd(), 'apps/web/lib/mock-stock-data.json')
  const localMockPath = path.resolve(process.cwd(), 'lib/mock-stock-data.json')
  const finalPath = fs.existsSync(rootMockPath) ? rootMockPath : fs.existsSync(localMockPath) ? localMockPath : null
  
  if (finalPath) {
    const raw = fs.readFileSync(finalPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed.items) mockStore.items = parsed.items
    if (parsed.manufacturers) mockStore.manufacturers = parsed.manufacturers
    if (parsed.warehouses) mockStore.warehouses = parsed.warehouses
    if (parsed.item_mappings) mockStore['item-mappings'] = parsed.item_mappings
    if (parsed.hsn) mockStore.hsn = parsed.hsn
    if (parsed.account_groups) mockStore['account-groups'] = parsed.account_groups
    if (parsed.accounts) mockStore.accounts = parsed.accounts
    if (parsed.parties) mockStore.parties = parsed.parties
  }
} catch (e) {
  // Silent catch for production environments where this file won't exist
}

// Load dynamically added custom parties from persistent JSON backup if it exists
try {
  const rootCustom = path.resolve(process.cwd(), 'apps/web/lib/custom-parties.json')
  const localCustom = path.resolve(process.cwd(), 'lib/custom-parties.json')
  const customPath = fs.existsSync(rootCustom) ? rootCustom : fs.existsSync(localCustom) ? localCustom : null
  if (customPath) {
    const raw = fs.readFileSync(customPath, 'utf8')
    const custom = JSON.parse(raw)
    if (Array.isArray(custom) && custom.length > 0) {
      const existingIds = new Set(custom.map((c: any) => (c.code || c.name).toLowerCase()))
      mockStore.parties = [...custom, ...(mockStore.parties || []).filter((p: any) => !existingIds.has((p.code || p.name).toLowerCase()))]
    }
  }
} catch (e) {
  // Silent catch
}

// Load persisted transaction data (ledgers, vouchers, sales, purchases, challans)
try {
  const rootTx = path.resolve(process.cwd(), 'apps/web/lib/mock-transactions.json')
  const localTx = path.resolve(process.cwd(), 'lib/mock-transactions.json')
  const txPath = fs.existsSync(rootTx) ? rootTx : fs.existsSync(localTx) ? localTx : null
  if (txPath) {
    const parsed = JSON.parse(fs.readFileSync(txPath, 'utf8'))
    // Merge persisted records: persisted entries take priority (they are newer)
    if (Array.isArray(parsed.ledgers) && parsed.ledgers.length > 0) {
      const existingIds = new Set(parsed.ledgers.map((l: any) => l.id))
      mockStore.ledgers = [...parsed.ledgers, ...(mockStore.ledgers || []).filter((l: any) => !existingIds.has(l.id))]
    }
    if (Array.isArray(parsed.vouchers) && parsed.vouchers.length > 0) {
      const existingIds = new Set(parsed.vouchers.map((v: any) => v.id))
      mockStore.vouchers = [...parsed.vouchers, ...(mockStore.vouchers || []).filter((v: any) => !existingIds.has(v.id))]
    }
    if (Array.isArray(parsed.sales) && parsed.sales.length > 0) {
      const existingIds = new Set(parsed.sales.map((s: any) => s.id))
      mockStore.sales = [...parsed.sales, ...(mockStore.sales || []).filter((s: any) => !existingIds.has(s.id))]
    }
    if (Array.isArray(parsed.purchases) && parsed.purchases.length > 0) {
      const existingIds = new Set(parsed.purchases.map((p: any) => p.id))
      mockStore.purchases = [...parsed.purchases, ...(mockStore.purchases || []).filter((p: any) => !existingIds.has(p.id))]
    }
    if (Array.isArray(parsed.challans) && parsed.challans.length > 0) {
      const existingIds = new Set(parsed.challans.map((c: any) => c.id))
      mockStore.challans = [...parsed.challans, ...(mockStore.challans || []).filter((c: any) => !existingIds.has(c.id))]
    }
  }
} catch (e) {
  // Silent catch — first run or corrupted file
}

function persistCustomParty(party: any) {
  try {
    const rootCustom = path.resolve(process.cwd(), 'apps/web/lib/custom-parties.json')
    const localCustom = path.resolve(process.cwd(), 'lib/custom-parties.json')
    const targets = [rootCustom, localCustom]
    for (const target of targets) {
      let list: any[] = []
      if (fs.existsSync(target)) {
        try { list = JSON.parse(fs.readFileSync(target, 'utf8')) } catch {}
      }
      list = [party, ...list.filter((p: any) => p.id !== party.id && p.name.toLowerCase() !== party.name.toLowerCase())]
      const dir = path.dirname(target)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(target, JSON.stringify(list, null, 2), 'utf8')
    }
  } catch (err) {
    console.warn('Failed to persist custom party to disk:', err)
  }
}

/**
 * Persist transaction collections (ledgers, vouchers, sales, purchases, challans)
 * to a local JSON file so they survive Next.js worker restarts and cross-request reads.
 */
function persistTransactions() {
  try {
    const payload = {
      ledgers: mockStore.ledgers ?? [],
      vouchers: mockStore.vouchers ?? [],
      sales: mockStore.sales ?? [],
      purchases: mockStore.purchases ?? [],
      challans: mockStore.challans ?? [],
    }
    const rootPath = path.resolve(process.cwd(), 'apps/web/lib/mock-transactions.json')
    const localPath = path.resolve(process.cwd(), 'lib/mock-transactions.json')
    const targets = [rootPath, localPath]
    for (const target of targets) {
      const dir = path.dirname(target)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8')
    }
  } catch (err) {
    console.warn('Failed to persist transactions to disk:', err)
  }
}

function isValidUrl(urlString?: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false
  const trimmed = urlString.trim()
  if (trimmed.includes('SENSITIVE') || trimmed === '[SENSITIVE]') return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function hasValidDb(): boolean {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  return isValidUrl(url) && Boolean(key && !key.includes('SENSITIVE'))
}

function db() {
  if (!hasValidDb()) throw new Error('Supabase server credentials are not configured or invalid.')
  const url = process.env.SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function context() {
  const client = db()
  const { data: found, error } = await client.from('organizations').select('id').eq('name', organizationName).maybeSingle()
  if (error) throw error
  const organizationId = found?.id ?? (await client.from('organizations').insert({ name: organizationName }).select('id').single()).data?.id
  if (!organizationId) throw new Error(`Unable to initialize ${organizationName}.`)
  const year = new Date().getFullYear()
  const { data: fy, error: fyError } = await client.from('financial_years').upsert({ organization_id: organizationId, starts_on: `${year}-04-01`, ends_on: `${year + 1}-03-31` }, { onConflict: 'organization_id,starts_on' }).select('id').single()
  if (fyError) throw fyError
  const defaults = [ ['Sale Invoice', 'SI-', 4], ['Sale Return', 'SR-', 3], ['Purchase Bill', 'PB-', 4], ['Purchase Return', 'PR-', 3], ['Challan', 'CH-', 4], ['Credit Note', 'CN-', 3], ['Debit Note', 'DN-', 3], ['Sales Order', 'SO-', 3], ['Purchase Order', 'PO-', 3] ]
  const { error: seriesError } = await client.from('document_series').upsert(defaults.map(([document_type, prefix, padding]) => ({ organization_id: organizationId, document_type, prefix, padding, next_number: 1 })), { onConflict: 'organization_id,document_type', ignoreDuplicates: true })
  if (seriesError) throw seriesError
  return { client, organizationId, financialYearId: fy.id }
}

async function party(client: ReturnType<typeof db>, organizationId: string, name: string, partyType: 'customer' | 'supplier' = 'customer') {
  const { data } = await client.from('parties').select('id').eq('organization_id', organizationId).eq('legal_name', name).maybeSingle()
  if (data) return data.id
  const { data: created, error } = await client.from('parties').insert({ organization_id: organizationId, code: `PTY-${Date.now()}`, party_type: partyType, legal_name: name }).select('id').single()
  if (error) throw error
  return created.id
}

async function account(client: ReturnType<typeof db>, organizationId: string, name: string, partyId?: string) {
  const { data } = await client.from('chart_of_accounts').select('id').eq('organization_id', organizationId).eq('name', name).maybeSingle()
  if (data) return data.id
  const { data: created, error } = await client.from('chart_of_accounts').insert({ organization_id: organizationId, code: `ACC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name, account_type: partyId ? 'party' : 'general', party_id: partyId ?? null }).select('id').single()
  if (error) throw error
  return created.id
}

async function stock(client: ReturnType<typeof db>, organizationId: string, line: Line) {
  const { data: i } = await client.from('items').select('id').eq('organization_id', organizationId).eq('name', line.name).maybeSingle()
  const itemId = i?.id ?? (await client.from('items').insert({ organization_id: organizationId, code: `ITM-${Date.now()}`, name: line.name, mrp: +line.rate, sale_rate: +line.rate }).select('id').single()).data?.id
  const batchNumber = line.batch || 'UNSPECIFIED'
  const { data: b } = await client.from('item_batches').select('id').eq('item_id', itemId!).eq('batch_number', batchNumber).maybeSingle()
  const batchId = b?.id ?? (await client.from('item_batches').insert({ item_id: itemId!, batch_number: batchNumber, expiry_on: line.expiry || null, mrp: +(line.mrp ?? line.rate) }).select('id').single()).data?.id
  const { data: w } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('code', 'MAIN').maybeSingle()
  const warehouseId = w?.id ?? (await client.from('warehouses').insert({ organization_id: organizationId, code: 'MAIN', name: 'Main Warehouse' }).select('id').single()).data?.id
  if (!itemId || !batchId || !warehouseId) throw new Error('Unable to create inventory data.')
  return { itemId, batchId, warehouseId }
}

async function fetchAll<T = any>(fn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, pageSize = 1000): Promise<T[]> {
  let all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await fn(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

function listMock(resource: string, partyName?: string) {
  if (resource === 'dashboard') {
    const activeItems = mockStore.items.filter((x: any) => x.status === 'active').length
    const salesVal = mockStore.sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0) + 482000
    const purchasesVal = mockStore.purchases.reduce((sum: number, p: any) => sum + (p.total || 0), 0) + 320000
    const pendingInvoices = mockStore.sales.filter((s: any) => s.status === 'pending' || s.status === 'draft').length + 2

    const salesData = [
      { month: '2026-01', sale: 32000, purchase: 25000 },
      { month: '2026-02', sale: 45000, purchase: 28000 },
      { month: '2026-03', sale: 60000, purchase: 35000 },
      { month: '2026-04', sale: 55000, purchase: 30000 },
      { month: '2026-05', sale: 72000, purchase: 42000 },
      { month: '2026-06', sale: 90000, purchase: 50000 },
      { month: '2026-07', sale: 85000, purchase: 48000 },
      { month: '2026-08', sale: salesVal, purchase: purchasesVal }
    ]

    return {
      kpis: { sales: salesVal, purchases: purchasesVal, activeItems, pendingInvoices },
      salesData,
      topItems: [
        { name: 'Paracetamol 650mg', qty: 1200, amount: 24000 },
        { name: 'Amoxicillin 500mg', qty: 800, amount: 48000 }
      ],
      recentInvoices: (() => {
        const fromSales = mockStore.sales.map((s: any) => ({ id: s.number || s.id, party: s.party, amount: s.total, date: s.date, status: s.status }))
        const extras = [
          { id: 'SI-2026-0001', party: 'Apollo Pharmacy', amount: 12500, date: '2026-08-25', status: 'paid' },
          { id: 'SI-2026-0003', party: 'MedPlus Chemist', amount: 8450, date: '2026-08-25', status: 'pending' }
        ]
        const seen = new Set(fromSales.map((s: any) => s.id))
        return [...fromSales, ...extras.filter((e) => !seen.has(e.id))]
      })(),
      expiryAlerts: [
        { item: 'Amoxicillin 500mg', batch: 'AMX-8821', expiry: '2026-09-15', qty: 45 },
        { item: 'Paracetamol 650mg', batch: 'PCT-0192', expiry: '2026-09-30', qty: 120 }
      ]
    }
  }
  if (resource === 'report-financial') return mockStore.accounts.map((a: any) => ({ ledger: a.name, group: a.group, debit: a.type === 'Dr' ? a.balance : 0, credit: a.type === 'Cr' ? a.balance : 0, balance: a.type === 'Cr' ? -a.balance : a.balance }))
  if (resource === 'report-stock') return mockStore.items.flatMap((i: any) => (i.batches || []).map((b: any) => ({ name: i.name, batch: b.batch, expiry: b.expiry, qty: b.stock, reserved: 0, location: Object.keys(b.stockByLocation || {})[0] || 'Main Warehouse', schedule: i.scheduleClass, recalled: i.recalled, mrp: b.mrp, rate: i.purchaseRate })))
  if (resource === 'report-sales') {
    const salesList = mockStore.sales || []
    const months = new Map<string, number>()
    const parties = new Map<string, number>()
    const items = new Map<string, { name: string; qty: number; revenue: number; margin: number }>()
    const categories = new Map<string, number>()
    let totalUnits = 0

    for (const s of salesList) {
      const month = String(s.date || '').slice(0, 7) || new Date().toISOString().slice(0, 7)
      const total = Number(s.total || s.grand_total || 0)
      months.set(month, (months.get(month) || 0) + total)
      const party = s.party || 'Customer'
      parties.set(party, (parties.get(party) || 0) + total)

      for (const line of (s.lines || [])) {
        const name = line.name || 'Item'
        const qty = Number(line.qty || line.quantity || 0)
        const revenue = Number(line.amount || line.line_total || (qty * (line.rate || 0)))
        totalUnits += qty
        const current = items.get(name) || { name, qty: 0, revenue: 0, margin: 25 }
        current.qty += qty
        current.revenue += revenue
        items.set(name, current)

        const category = line.category || 'Pharmaceuticals'
        categories.set(category, (categories.get(category) || 0) + revenue)
      }
    }

    return {
      monthlySales: [...months].sort().map(([month, value]) => ({ month, value })),
      topParties: [...parties].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, sales]) => ({ name, sales, growth: 0 })),
      topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      categories: [...categories].map(([name, value]) => ({ name, value })),
      units: totalUnits
    }
  }

  if (resource === 'report-purchases') {
    const purchasesList = mockStore.purchases || []
    const months = new Map<string, number>()
    const suppliers = new Map<string, number>()

    for (const p of purchasesList) {
      const month = String(p.date || '').slice(0, 7) || new Date().toISOString().slice(0, 7)
      const total = Number(p.total || p.grand_total || 0)
      months.set(month, (months.get(month) || 0) + total)
      const sup = p.party || p.supplier || 'Supplier'
      suppliers.set(sup, (suppliers.get(sup) || 0) + total)
    }

    return {
      monthlyPurchases: [...months].sort().map(([month, value]) => ({ month, value })),
      topSuppliers: [...suppliers].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, purchases]) => ({ name, purchases, growth: 0 })),
      activeSuppliers: suppliers.size
    }
  }
  if (resource === 'item-mappings') return mockStore['item-mappings'] || []

  if (resource === 'ledgers') {
    const mappedVls = (mockStore.ledgers ?? []).map((v: any) => ({
      id: v.id,
      party: v.party,
      date: v.date,
      vType: v.vType,
      vNo: v.vNo,
      debit: +v.debit,
      credit: +v.credit,
      narration: v.narration ?? 'Voucher posted'
    }))

    const existingVNos = new Set(mappedVls.map((v: any) => (v.vNo || v.id || '').trim()))

    const mappedSales = (mockStore.sales ?? [])
      .filter((s: any) => !existingVNos.has((s.number || s.id || '').trim()))
      .map((s: any) => ({
        id: s.id || s.number,
        party: s.party,
        date: s.date,
        vType: 'sale',
        vNo: s.number || s.id,
        debit: Number(s.total || s.grand_total || 0),
        credit: 0,
        narration: s.narration || `Invoice ${s.number || s.id}`
      }))

    const mappedPurchases = (mockStore.purchases ?? [])
      .filter((p: any) => !existingVNos.has((p.number || p.id || '').trim()))
      .map((p: any) => ({
        id: p.id || p.number,
        party: p.party,
        date: p.date,
        vType: 'purchase',
        vNo: p.number || p.id,
        debit: 0,
        credit: Number(p.total || p.grand_total || 0),
        narration: p.narration || `Bill ${p.number || p.id}`
      }))

    const seen = new Set<string>()
    const uniqueEntries: any[] = []
    // Force remove all transactions which have no monetary value (debit <= 0 and credit <= 0)
    for (const row of [...mappedVls, ...mappedSales, ...mappedPurchases]) {
      const dr = Number(row.debit) || 0
      const cr = Number(row.credit) || 0
      if (dr <= 0 && cr <= 0) continue

      const key = `${(row.vNo || row.id || '').trim()}_${(row.party || '').trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueEntries.push(row)
      }
    }

    return uniqueEntries.filter((v) => !partyName || v.party === partyName)
  }

  if (mockStore[resource]) {
    return mockStore[resource]
  }

  const specialKeys: Record<string, string> = {
    'sale-returns': 'sales',
    'purchase-returns': 'purchases',
    'communication-blocks': 'communication-blocks'
  }
  if (specialKeys[resource] && mockStore[specialKeys[resource]]) {
    return mockStore[specialKeys[resource]]
  }
  return []
}

export async function list(resource: string, partyName?: string) {
  if (!hasValidDb()) {
    return listMock(resource, partyName)
  }

  try {
    const { client, organizationId } = await context()
  if (resource === 'dashboard') {
    const [{ data: sales, error: salesError }, { data: purchases, error: purchaseError }, { count: activeItemsCount, error: itemError }, { data: stock, error: stockError }] = await Promise.all([
      client.from('sales_invoices').select('id,invoice_number,invoice_date,status,grand_total,parties(legal_name),sales_invoice_lines(quantity,line_total,items(name))').eq('organization_id', organizationId).neq('status', 'cancelled').order('invoice_date', { ascending: false }),
      client.from('purchase_invoices').select('invoice_date,status,grand_total').eq('organization_id', organizationId).neq('status', 'cancelled'),
      client.from('items').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
      client.from('erp_stock_position').select('item_name,batch_number,expiry_on,quantity').eq('organization_id', organizationId).gt('quantity', 0),
    ])
    const error = salesError || purchaseError || itemError || stockError; if (error) throw error
    const monthly = new Map<string, { month: string; sale: number; purchase: number }>()
    const addMonth = (value: any, kind: 'sale' | 'purchase') => { const key = String(value.invoice_date).slice(0, 7); const row = monthly.get(key) ?? { month: key, sale: 0, purchase: 0 }; row[kind] += Number(value.grand_total); monthly.set(key, row) }
    ;(sales ?? []).forEach((row: any) => addMonth(row, 'sale')); (purchases ?? []).forEach((row: any) => addMonth(row, 'purchase'))
    const itemTotals = new Map<string, { name: string; qty: number; amount: number }>()
    ;(sales ?? []).flatMap((row: any) => row.sales_invoice_lines ?? []).forEach((line: any) => { const name = line.items?.name ?? 'Unknown'; const current = itemTotals.get(name) ?? { name, qty: 0, amount: 0 }; current.qty += Number(line.quantity); current.amount += Number(line.line_total); itemTotals.set(name, current) })
    return {
      kpis: { sales: (sales ?? []).reduce((n: number, x: any) => n + Number(x.grand_total), 0), purchases: (purchases ?? []).reduce((n: number, x: any) => n + Number(x.grand_total), 0), activeItems: activeItemsCount ?? 0, pendingInvoices: (sales ?? []).filter((x: any) => x.status === 'draft').length },
      salesData: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
      topItems: [...itemTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 6),
      recentInvoices: (sales ?? []).slice(0, 8).map((x: any) => ({ id: x.invoice_number, party: x.parties?.legal_name ?? '', amount: Number(x.grand_total), date: x.invoice_date, status: x.status })),
      expiryAlerts: (stock ?? []).filter((x: any) => x.expiry_on).sort((a: any, b: any) => String(a.expiry_on).localeCompare(String(b.expiry_on))).slice(0, 8).map((x: any) => ({ item: x.item_name, batch: x.batch_number, expiry: x.expiry_on, qty: Number(x.quantity) })),
    }
  }
  if (resource === 'report-financial') { const { data, error } = await client.from('erp_trial_balance').select('*').eq('organization_id', organizationId).order('name'); if (error) throw error; return (data ?? []).map((x: any) => ({ ledger: x.name, group: x.account_group, debit: Number(x.debit), credit: Number(x.credit), balance: Number(x.balance) })) }
  if (resource === 'report-stock') { const { data, error } = await client.from('erp_stock_position').select('*').eq('organization_id', organizationId).order('item_name'); if (error) throw error; return (data ?? []).map((x: any) => ({ name: x.item_name, batch: x.batch_number, expiry: x.expiry_on ?? '', qty: Number(x.quantity), reserved: Number(x.reserved_quantity), location: x.warehouse_name, schedule: x.schedule_class, recalled: x.is_recalled, mrp:Number(x.mrp), rate:Number(x.purchase_rate) })) }
  if (resource === 'report-sales') { const { data,error }=await client.from('sales_invoices').select('invoice_date,grand_total,parties(legal_name),sales_invoice_lines(quantity,line_total,items(name,salts(category)))').eq('organization_id',organizationId).neq('status','cancelled');if(error)throw error;const months=new Map<string,number>(),parties=new Map<string,number>(),items=new Map<string,{name:string;qty:number;revenue:number;margin:number}>(),categories=new Map<string,number>();for(const invoice of data??[]){const month=String(invoice.invoice_date).slice(0,7);months.set(month,(months.get(month)??0)+Number(invoice.grand_total));const party=(invoice.parties as any)?.legal_name??'Unknown';parties.set(party,(parties.get(party)??0)+Number(invoice.grand_total));for(const line of (invoice.sales_invoice_lines as any[])??[]){const name=line.items?.name??'Unknown',revenue=Number(line.line_total),current=items.get(name)??{name,qty:0,revenue:0,margin:0};current.qty+=Number(line.quantity);current.revenue+=revenue;items.set(name,current);const category=line.items?.salts?.category??'Uncategorised';categories.set(category,(categories.get(category)??0)+revenue)}}return{monthlySales:[...months].sort().map(([month,value])=>({month,value})),topParties:[...parties].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,sales])=>({name,sales,growth:0})),topItems:[...items.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,10),categories:[...categories].map(([name,value])=>({name,value})),units:[...items.values()].reduce((n,x)=>n+x.qty,0)} }
  if (resource === 'report-purchases') { const { data,error }=await client.from('purchase_invoices').select('invoice_date,grand_total,parties(legal_name)').eq('organization_id',organizationId).neq('status','cancelled');if(error)throw error;const months=new Map<string,number>(),suppliers=new Map<string,number>();for(const row of data??[]){const month=String(row.invoice_date).slice(0,7);months.set(month,(months.get(month)??0)+Number(row.grand_total));const name=(row.parties as any)?.legal_name??'Unknown';suppliers.set(name,(suppliers.get(name)??0)+Number(row.grand_total))}return{monthlyPurchases:[...months].sort().map(([month,value])=>({month,value})),topSuppliers:[...suppliers].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,purchases])=>({name,purchases,growth:0})),activeSuppliers:suppliers.size} }
  if (resource === 'parties') {
    const data = await fetchAll<any>((from, to) =>
      client.from('parties').select('id,code,party_type,legal_name,phone,email,gstin,credit_limit,is_blocked,created_at,party_addresses(city,is_default)').eq('organization_id', organizationId).order('legal_name').range(from, to)
    )
    const dbParties = (data ?? []).map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.legal_name,
      type: p.party_type || 'both',
      phone: p.phone ?? '',
      email: p.email ?? '',
      city: p.party_addresses?.find((a: any) => a.is_default)?.city ?? p.party_addresses?.[0]?.city ?? '',
      gstin: p.gstin ?? '',
      balance: 0,
      creditLimit: Number(p.credit_limit),
      lastSale: '',
      status: p.is_blocked ? 'blocked' : 'active'
    }))

    // Deduplicate DB parties by name, collecting redundant duplicate IDs
    const uniqueDbMap = new Map<string, any>()
    const redundantDbIds: string[] = []
    for (const p of dbParties) {
      const key = (p.name || '').trim().toLowerCase()
      if (!key) continue
      if (!uniqueDbMap.has(key)) {
        uniqueDbMap.set(key, { ...p })
      } else {
        const existing = uniqueDbMap.get(key)!
        if (!existing.phone && p.phone) existing.phone = p.phone
        if (!existing.city && p.city) existing.city = p.city
        if (!existing.gstin && p.gstin) existing.gstin = p.gstin
        if (p.type === 'both') existing.type = 'both'
        redundantDbIds.push(p.id)
      }
    }

    // Prune redundant duplicate rows from Supabase database
    if (redundantDbIds.length > 0) {
      try {
        await client.from('parties').delete().in('id', redundantDbIds).eq('organization_id', organizationId)
        await client.from('party_addresses').delete().in('party_id', redundantDbIds)
        await client.from('chart_of_accounts').delete().in('party_id', redundantDbIds)
      } catch {}
    }

    const cleanDbParties = Array.from(uniqueDbMap.values())
    const combinedMap = new Map<string, any>()
    for (const p of cleanDbParties) {
      combinedMap.set((p.name || '').trim().toLowerCase(), p)
    }
    for (const p of (mockStore.parties || [])) {
      const key = (p.name || '').trim().toLowerCase()
      if (!key) continue
      if (!combinedMap.has(key)) {
        combinedMap.set(key, p)
      }
    }

    return Array.from(combinedMap.values())
  }
  if (resource === 'items') {
    const data = await fetchAll<any>((from, to) =>
      client.from('items').select('id,code,name,packing,mrp,sale_rate,purchase_rate,is_active,schedule_class,prescription_required,cold_chain,controlled_substance,is_recalled,manufacturers(name),salts(name),hsn_codes(code,gst_rate),item_batches(id,batch_number,expiry_on,mrp,cost_price,purchase_price,sale_price,sales_scheme_deal,sales_scheme_free,purchase_scheme_deal,purchase_scheme_free,supplier_invoice_number,supplier_invoice_date,rack_number,source_report_value,parties(legal_name),stock_movements(quantity,warehouses(name)))').eq('organization_id', organizationId).order('name').range(from, to)
    )
    const dbItems = (data ?? []).map((i: any) => ({ id: i.id, code: i.code, name: i.name, packing: i.packing ?? '', manufacturer: i.manufacturers?.name ?? '', salt: i.salts?.name ?? '', hsn: i.hsn_codes?.code ?? '', gstRate: Number(i.hsn_codes?.gst_rate ?? 0), mrp: Number(i.mrp), saleRate: Number(i.sale_rate), purchaseRate: Number(i.purchase_rate), scheduleClass:i.schedule_class, prescriptionRequired:i.prescription_required, coldChain:i.cold_chain, controlledSubstance:i.controlled_substance, recalled:i.is_recalled, stock: (i.item_batches ?? []).flatMap((b: any) => b.stock_movements ?? []).reduce((sum: number, m: any) => sum + Number(m.quantity), 0), batches: (i.item_batches ?? []).map((b: any) => ({ id: b.id, batch: b.batch_number, expiry: b.expiry_on, mrp: Number(b.mrp), costPrice: Number(b.cost_price ?? 0), purchasePrice: Number(b.purchase_price ?? 0), salePrice: Number(b.sale_price ?? 0), salesSchemeDeal: Number(b.sales_scheme_deal ?? 0), salesSchemeFree: Number(b.sales_scheme_free ?? 0), purchaseSchemeDeal: Number(b.purchase_scheme_deal ?? 0), purchaseSchemeFree: Number(b.purchase_scheme_free ?? 0), receivedOn: b.received_on ?? '', manufacturedOn: b.manufactured_on ?? '', supplier: b.parties?.legal_name ?? '', invoiceNumber: b.supplier_invoice_number ?? '', invoiceDate: b.supplier_invoice_date ?? '', rackNumber: b.rack_number ?? '', reportedValue: Number(b.source_report_value ?? 0), stock: (b.stock_movements ?? []).reduce((sum: number, m: any) => sum + Number(m.quantity), 0), stockByLocation: (b.stock_movements ?? []).reduce((byLocation: Record<string, number>, m: any) => { const location = m.warehouses?.name ?? 'Main Warehouse'; byLocation[location] = (byLocation[location] ?? 0) + Number(m.quantity); return byLocation }, {}) })), batchCount: i.item_batches?.length ?? 0, category: 'Medicine', status: i.is_active ? 'active' : 'banned' }))
    if (dbItems.length >= (mockStore.items?.length || 0)) return dbItems
    return mockStore.items && mockStore.items.length > 0 ? mockStore.items : dbItems
  }
  if (resource === 'hsn') { return await fetchAll<any>((from, to) => client.from('hsn_codes').select('*').eq('organization_id', organizationId).order('code').range(from, to)) }
  if (resource === 'manufacturers') {
    const data = await fetchAll<any>((from, to) =>
      client.from('manufacturers').select('id,name,code,is_active,items(count)').eq('organization_id', organizationId).order('name').range(from, to)
    )
    const dbMfgs = (data ?? []).map((m: any) => ({
      ...m,
      productCount: Number(m.items?.[0]?.count ?? 0),
      itemcount: Number(m.items?.[0]?.count ?? 0),
      items: undefined
    }))
    if (dbMfgs.length >= (mockStore.manufacturers?.length || 0)) return dbMfgs
    return mockStore.manufacturers && mockStore.manufacturers.length > 0 ? mockStore.manufacturers : dbMfgs
  }
  if (resource === 'salts') { const data = await fetchAll<any>((from, to) => client.from('salts').select('id,code,name,composition,category,items(count)').eq('organization_id', organizationId).order('name').range(from, to)); return (data ?? []).map((s: any) => ({ ...s, itemcount: Number(s.items?.[0]?.count ?? 0), items: undefined })) }
  if (resource === 'warehouses') { const data = await fetchAll<any>((from, to) => client.from('warehouses').select('*').eq('organization_id', organizationId).order('name').range(from, to)); return (data ?? []).map((w: any) => ({ id: w.id, code: w.code, name: w.name, type: w.warehouse_type, address: w.address ?? '', capacity: Number(w.capacity), used: 0, status: w.is_active ? 'active' : 'inactive' })) }
  if (resource === 'item-mappings') {
    const [imported, manual] = await Promise.all([
      fetchAll<any>((from, to) => client.from('stock_import_rows').select('id,source_file,source_row,item_code,product_name,unit,current_stock,sales_scheme_deal,sales_scheme_free,purchase_scheme_deal,purchase_scheme_free,cost_price,reported_value,mrp,purchase_price,sale_price,company,manufacturer,received_on,batch_number,manufactured_on,expiry_on,supplier_name,invoice_number,invoice_date,rack_number').eq('organization_id', organizationId).order('product_name').order('source_row').range(from, to)),
      fetchAll<any>((from, to) => client.from('business_documents').select('id,status,details,parties(legal_name)').eq('organization_id', organizationId).eq('document_type', 'item_mapping').order('document_date', { ascending: false }).range(from, to)),
    ])
    const importedRows = (imported ?? []).map((row: any) => ({
      id: `import-${row.id}`,
      source: 'import',
      supplier: row.supplier_name ?? '',
      supplierItem: row.item_code ?? '',
      canonicalItem: row.product_name ?? '',
      company: row.company ?? row.manufacturer ?? '',
      unit: row.unit ?? '',
      batch: row.batch_number ?? '',
      stock: Number(row.current_stock ?? 0),
      mrp: Number(row.mrp ?? 0),
      costPrice: Number(row.cost_price ?? 0),
      purchasePrice: Number(row.purchase_price ?? 0),
      salePrice: Number(row.sale_price ?? 0),
      reportedValue: Number(row.reported_value ?? 0),
      salesSchemeDeal: Number(row.sales_scheme_deal ?? 0),
      salesSchemeFree: Number(row.sales_scheme_free ?? 0),
      purchaseSchemeDeal: Number(row.purchase_scheme_deal ?? 0),
      purchaseSchemeFree: Number(row.purchase_scheme_free ?? 0),
      receivedOn: row.received_on ?? '',
      manufacturedOn: row.manufactured_on ?? '',
      expiryOn: row.expiry_on ?? '',
      invoiceNumber: row.invoice_number ?? '',
      invoiceDate: row.invoice_date ?? '',
      rackNumber: row.rack_number ?? '',
      status: 'active',
    }))
    const manualRows = (manual ?? []).map((row: any) => ({
      id: row.id,
      source: 'manual',
      supplier: row.parties?.legal_name ?? row.details?.supplier ?? '',
      supplierItem: row.details?.supplierItem ?? '',
      canonicalItem: row.details?.canonicalItem ?? '',
      company: row.details?.company ?? '',
      unit: row.details?.unit ?? '',
      batch: row.details?.batch ?? '',
      stock: Number(row.details?.stock ?? 0),
      mrp: Number(row.details?.mrp ?? 0),
      costPrice: Number(row.details?.costPrice ?? 0),
      purchasePrice: Number(row.details?.purchasePrice ?? 0),
      salePrice: Number(row.details?.salePrice ?? 0),
      reportedValue: Number(row.details?.reportedValue ?? 0),
      salesSchemeDeal: Number(row.details?.salesSchemeDeal ?? 0),
      salesSchemeFree: Number(row.details?.salesSchemeFree ?? 0),
      purchaseSchemeDeal: Number(row.details?.purchaseSchemeDeal ?? 0),
      purchaseSchemeFree: Number(row.details?.purchaseSchemeFree ?? 0),
      receivedOn: row.details?.receivedOn ?? '',
      manufacturedOn: row.details?.manufacturedOn ?? '',
      expiryOn: row.details?.expiryOn ?? '',
      invoiceNumber: row.details?.invoiceNumber ?? '',
      invoiceDate: row.details?.invoiceDate ?? '',
      rackNumber: row.details?.rackNumber ?? '',
      status: row.status,
    }))
    const dbRows = [...importedRows, ...manualRows]
    if (dbRows.length >= (mockStore['item-mappings']?.length || 0)) return dbRows
    return mockStore['item-mappings'] && mockStore['item-mappings'].length > 0 ? mockStore['item-mappings'] : dbRows
  }
  if (resource === 'account-groups') {
    const data = await fetchAll<any>((from, to) => client.from('account_groups').select('*').eq('organization_id', organizationId).order('name').range(from, to))
    if (data && data.length > 0) return data
    return mockStore['account-groups'] || []
  }
  if (resource === 'accounts') { const data = await fetchAll<any>((from, to) => client.from('chart_of_accounts').select('id,code,name,account_type,account_group,opening_balance,is_active,voucher_lines(debit,credit)').eq('organization_id', organizationId).order('name').range(from, to)); return (data && data.length > 0) ? (data ?? []).map((a: any) => { const balance = Number(a.opening_balance) + (a.voucher_lines ?? []).reduce((sum: number, line: any) => sum + Number(line.debit) - Number(line.credit), 0); return { id: a.id, code: a.code, name: a.name, group: a.account_group, balance: Math.abs(balance), type: balance < 0 ? 'Cr' : 'Dr', active: a.is_active } }) : (mockStore.accounts || []) }
  if (resource === 'series') { const data = await fetchAll<any>((from, to) => client.from('document_series').select('*').eq('organization_id', organizationId).order('document_type').range(from, to)); return (data ?? []).map((s: any) => ({ id: s.id, doc: s.document_type, prefix: s.prefix, suffix: s.suffix, nextNo: Number(s.next_number), padding: s.padding, fyReset: s.financial_year_reset, active: s.is_active })) }
  if (resource === 'communication-blocks') { const data = await fetchAll<any>((from, to) => client.from('communication_blocks').select('*').eq('organization_id', organizationId).order('blocked_on', { ascending: false }).range(from, to)); return (data ?? []).map((b: any) => ({ id: b.id, type: b.channel, value: b.destination, reason: b.reason ?? '', blockedOn: b.blocked_on })) }
  const documentResources: Record<string, string> = { 'sale-returns': 'sale_return', 'purchase-returns': 'purchase_return', orders: 'order', breakages: 'breakage', replacements: 'replacement', 'counter-sales': 'counter_sale', pendings: 'pending', 'price-differences': 'price_difference' }
  if (documentResources[resource]) { const data = await fetchAll<any>((from, to) => client.from('business_documents').select('id,document_number,document_date,status,total,details,parties(legal_name)').eq('organization_id', organizationId).eq('document_type', documentResources[resource]).order('document_date', { ascending: false }).range(from, to)); return (data ?? []).map((row: any) => ({ id: row.id, number: row.document_number, date: row.document_date, status: row.status, total: Number(row.total), party: row.parties?.legal_name ?? '', ...row.details })) }
  if (resource === 'sales') {
    const data = await fetchAll<any>((from, to) =>
      client
        .from('sales_invoices')
        .select(
          'id,invoice_number,invoice_date,status,grand_total,parties(legal_name),sales_invoice_lines(id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total,items(id,name,code,sale_rate,mrp),item_batches(batch_number,expiry_on,mrp))'
        )
        .eq('organization_id', organizationId)
        .order('invoice_date', { ascending: false })
        .range(from, to)
    )
    return (data ?? []).map((v: any) => ({
      id: v.invoice_number,
      dbId: v.id,
      party: v.parties?.legal_name ?? '',
      date: v.invoice_date,
      status: v.status,
      items: Number(v.sales_invoice_lines?.length ?? 0),
      total: Number(v.grand_total),
      lines: (v.sales_invoice_lines ?? []).map((l: any) => ({
        id: l.id,
        name: l.items?.name ?? 'Item',
        code: l.items?.code ?? '',
        batch: l.item_batches?.batch_number ?? 'DEFAULT',
        expiry: l.item_batches?.expiry_on ?? '',
        qty: Number(l.quantity || 0),
        free: Number(l.free_quantity || 0),
        rate: Number(l.rate || 0),
        disc: Number(l.discount_percent || 0),
        gst: Number(l.gst_rate || 0),
        amount: Number(l.line_total || 0),
        stock: 100
      }))
    }))
  }
  if (resource === 'purchases') {
    const data = await fetchAll<any>((from, to) =>
      client
        .from('purchase_invoices')
        .select(
          'id,invoice_number,supplier_invoice_number,invoice_date,status,grand_total,parties(legal_name),purchase_invoice_lines(id,quantity,free_quantity,rate,discount_percent,gst_rate,line_total,items(id,name,code),item_batches(batch_number,expiry_on))'
        )
        .eq('organization_id', organizationId)
        .order('invoice_date', { ascending: false })
        .range(from, to)
    )
    return (data ?? []).map((v: any) => ({
      id: v.invoice_number,
      dbId: v.id,
      supplierInvoice: v.supplier_invoice_number ?? '',
      party: v.parties?.legal_name ?? '',
      date: v.invoice_date,
      status: v.status === 'posted' ? 'received' : v.status,
      items: Number(v.purchase_invoice_lines?.length ?? 0),
      total: Number(v.grand_total),
      lines: (v.purchase_invoice_lines ?? []).map((l: any) => ({
        id: l.id,
        name: l.items?.name ?? 'Item',
        code: l.items?.code ?? '',
        batch: l.item_batches?.batch_number ?? 'DEFAULT',
        expiry: l.item_batches?.expiry_on ?? '',
        qty: Number(l.quantity || 0),
        free: Number(l.free_quantity || 0),
        rate: Number(l.rate || 0),
        disc: Number(l.discount_percent || 0),
        gst: Number(l.gst_rate || 0),
        amount: Number(l.line_total || 0)
      }))
    }))
  }
  if (resource === 'challans') { const data = await fetchAll<any>((from, to) => client.from('delivery_challans').select('id,challan_number,challan_date,transport_name,status,parties(legal_name)').eq('organization_id', organizationId).order('challan_date', { ascending: false }).range(from, to)); return (data ?? []).map((v: any) => ({ id: v.challan_number, dbId: v.id, party: v.parties?.legal_name ?? '', date: v.challan_date, transport: v.transport_name ?? '', status: v.status })) }
  if (resource === 'vouchers') { return await fetchAll<any>((from, to) => client.from('vouchers').select('*').order('voucher_date', { ascending: false }).range(from, to)) }
  if (resource === 'ledgers') {
    const { data: voucherLines, error: vlError } = await client.from('voucher_lines').select('id,debit,credit,narration,vouchers!inner(voucher_date,voucher_number,voucher_type),chart_of_accounts!inner(name)')
    if (vlError) throw vlError

    const { data: sales, error: sError } = await client.from('sales_invoices').select('id,invoice_number,invoice_date,grand_total,status,parties(legal_name)').neq('status', 'cancelled')
    if (sError) throw sError

    const { data: purchases, error: pError } = await client.from('purchase_invoices').select('id,invoice_number,invoice_date,grand_total,status,parties(legal_name)').neq('status', 'cancelled')
    if (pError) throw pError

    const { data: challans, error: cError } = await client.from('delivery_challans').select('id,challan_number,challan_date,status,parties(legal_name)').neq('status', 'cancelled')
    if (cError) throw cError

    const mappedVls = (voucherLines ?? []).map((v: any) => ({
      id: v.id,
      party: v.chart_of_accounts.name,
      date: v.vouchers.voucher_date,
      vType: v.vouchers.voucher_type,
      vNo: v.vouchers.voucher_number,
      debit: +v.debit,
      credit: +v.credit,
      narration: v.narration ?? 'Voucher posted'
    }))

    const existingVNos = new Set(mappedVls.map((v: any) => (v.vNo || '').trim()))

    const mappedSales = (sales ?? [])
      .filter((s: any) => !existingVNos.has((s.invoice_number || '').trim()))
      .map((s: any) => ({
        id: s.id,
        party: s.parties?.legal_name ?? 'Unknown Customer',
        date: s.invoice_date,
        vType: 'sale',
        vNo: s.invoice_number,
        debit: +s.grand_total,
        credit: 0,
        narration: `Invoice ${s.invoice_number}`
      }))

    const mappedPurchases = (purchases ?? [])
      .filter((p: any) => !existingVNos.has((p.invoice_number || '').trim()))
      .map((p: any) => ({
        id: p.id,
        party: p.parties?.legal_name ?? 'Unknown Supplier',
        date: p.invoice_date,
        vType: 'purchase',
        vNo: p.invoice_number,
        debit: 0,
        credit: +p.grand_total,
        narration: `Bill ${p.invoice_number}`
      }))

    const seen = new Set<string>()
    const uniqueEntries: any[] = []
    // Force remove all transactions which have no monetary value (debit <= 0 and credit <= 0)
    for (const row of [...mappedVls, ...mappedSales, ...mappedPurchases]) {
      const dr = Number(row.debit) || 0
      const cr = Number(row.credit) || 0
      if (dr <= 0 && cr <= 0) continue

      const key = `${(row.vNo || row.id || '').trim()}_${(row.party || '').trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueEntries.push(row)
      }
    }

    return uniqueEntries.filter((v) => !partyName || v.party === partyName)
  }
  throw new Error('Unknown ERP resource.')
  } catch (error) {
    console.warn(`Database query for resource ${resource} failed, falling back to mock:`, error)
    return listMock(resource, partyName)
  }
}

type ImportRow = Record<string, unknown>

const importRequired: Record<string, string[]> = {
  parties: ['code', 'party_type', 'legal_name'],
  manufacturers: ['name'],
  salts: ['code', 'name'],
  hsn: ['code'],
  warehouses: ['code', 'name'],
  accounts: ['code', 'name'],
  items: ['code', 'name'],
  'opening-stock': ['item_code', 'batch', 'warehouse_code', 'quantity'],
  sales: ['invoice_number', 'invoice_date', 'customer', 'item_code', 'batch', 'quantity', 'rate'],
  purchases: ['invoice_number', 'invoice_date', 'supplier', 'item_code', 'batch', 'quantity', 'purchase_rate'],
}

const importText = (row: ImportRow, key: string) => String(row[key] ?? '').trim()
const importNumber = (row: ImportRow, key: string, fallback = 0) => {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : fallback
}

async function importDataset(type: string, rows: ImportRow[], actor: MutationActor = {}) {
  if (!importRequired[type]) throw new Error('Unsupported import type.')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('The import file has no data rows.')
  if (rows.length > 5000) throw new Error('Import files are limited to 5,000 rows per upload.')
  const invalid = rows.flatMap((row, index) => importRequired[type].filter((key) => !importText(row, key)).map((key) => `Row ${index + 2}: ${key} is required`))
  if (invalid.length) throw new Error(invalid.slice(0, 20).join('; '))

  const { client, organizationId, financialYearId } = await context()
  if (!['sales', 'purchases'].includes(type)) {
    try {
      const { data, error } = await client.rpc('erp_import_master', { p_type: type, p_organization_id: organizationId, p_rows: rows, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
      if (!error && data) return data
    } catch (rpcErr) {
      console.warn('erp_import_master fallback to direct table upsert:', rpcErr)
    }
  }
  if (type === 'parties') {
    const payload = rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), party_type: importText(row, 'party_type').toLowerCase(), legal_name: importText(row, 'legal_name'), phone: importText(row, 'phone') || null, email: importText(row, 'email') || null, gstin: importText(row, 'gstin') || null, credit_limit: importNumber(row, 'credit_limit'), is_blocked: importText(row, 'status').toLowerCase() === 'blocked' }))
    if (payload.some((row) => !['customer', 'supplier', 'both'].includes(row.party_type))) throw new Error('party_type must be customer, supplier, or both.')
    const { data, error } = await client.from('parties').upsert(payload, { onConflict: 'organization_id,code' }).select('id,code'); if (error) throw error
    for (const partyRow of data ?? []) { const source = rows.find((row) => importText(row, 'code') === partyRow.code); const city = source ? importText(source, 'city') : ''; if (!city) continue; const { data: existing } = await client.from('party_addresses').select('id').eq('party_id', partyRow.id).eq('is_default', true).maybeSingle(); const address = { party_id: partyRow.id, address_type: 'business', line1: importText(source!, 'address') || city, city, state_code: importText(source!, 'state') || null, postal_code: importText(source!, 'pincode') || null, is_default: true }; const { error: addressError } = existing ? await client.from('party_addresses').update(address).eq('id', existing.id) : await client.from('party_addresses').insert(address); if (addressError) throw addressError }
    return { type, importedRows: rows.length, records: data?.length ?? 0 }
  }
  if (type === 'manufacturers') { const { data, error } = await client.from('manufacturers').upsert(rows.map((row) => ({ organization_id: organizationId, name: importText(row, 'name'), code: importText(row, 'code') || null, is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,name' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'salts') { const { data, error } = await client.from('salts').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), composition: importText(row, 'composition') || null, category: importText(row, 'category') || null })), { onConflict: 'organization_id,name' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'hsn') { const { data, error } = await client.from('hsn_codes').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), description: importText(row, 'description') || null, gst_rate: importNumber(row, 'gst_rate') })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'warehouses') { const { data, error } = await client.from('warehouses').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), warehouse_type: importText(row, 'warehouse_type') || 'Store Room', address: importText(row, 'address') || null, capacity: importNumber(row, 'capacity'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'accounts') { const { data, error } = await client.from('chart_of_accounts').upsert(rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), account_type: importText(row, 'account_type') || 'general', account_group: importText(row, 'account_group') || 'General', opening_balance: importNumber(row, 'opening_balance'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' })), { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 } }
  if (type === 'items') {
    const [{ data: manufacturers }, { data: salts }, { data: hsnCodes }] = await Promise.all([client.from('manufacturers').select('id,name').eq('organization_id', organizationId), client.from('salts').select('id,name').eq('organization_id', organizationId), client.from('hsn_codes').select('id,code').eq('organization_id', organizationId)])
    const manufacturerMap = new Map((manufacturers ?? []).map((row) => [row.name.toLowerCase(), row.id])), saltMap = new Map((salts ?? []).map((row) => [row.name.toLowerCase(), row.id])), hsnMap = new Map((hsnCodes ?? []).map((row) => [row.code.toLowerCase(), row.id]))
    const missing = rows.flatMap((row, index) =>
      ([['manufacturer', manufacturerMap], ['salt', saltMap], ['hsn_code', hsnMap]] as const).flatMap(([key, map]) => {
        const value = importText(row, key)
        return value && !map.has(value.toLowerCase()) ? [`Row ${index + 2}: ${key} "${value}" is not in its master table`] : []
      }),
    )
    if (missing.length) throw new Error(missing.slice(0, 20).join('; '))
    const payload = rows.map((row) => ({ organization_id: organizationId, code: importText(row, 'code'), name: importText(row, 'name'), packing: importText(row, 'packing') || null, manufacturer_id: manufacturerMap.get(importText(row, 'manufacturer').toLowerCase()) ?? null, salt_id: saltMap.get(importText(row, 'salt').toLowerCase()) ?? null, hsn_id: hsnMap.get(importText(row, 'hsn_code').toLowerCase()) ?? null, mrp: importNumber(row, 'mrp'), sale_rate: importNumber(row, 'sale_rate'), purchase_rate: importNumber(row, 'purchase_rate'), is_active: importText(row, 'status').toLowerCase() !== 'inactive' }))
    const { data, error } = await client.from('items').upsert(payload, { onConflict: 'organization_id,code' }).select('id'); if (error) throw error; return { type, importedRows: rows.length, records: data?.length ?? 0 }
  }
  if (type === 'opening-stock') {
    const [{ data: items }, { data: warehouses }] = await Promise.all([client.from('items').select('id,code').eq('organization_id', organizationId), client.from('warehouses').select('id,code').eq('organization_id', organizationId)])
    const itemMap = new Map((items ?? []).map((row) => [row.code.toLowerCase(), row.id])), warehouseMap = new Map((warehouses ?? []).map((row) => [row.code.toLowerCase(), row.id]))
    for (const [index, row] of rows.entries()) { const itemId = itemMap.get(importText(row, 'item_code').toLowerCase()), warehouseId = warehouseMap.get(importText(row, 'warehouse_code').toLowerCase()), quantity = importNumber(row, 'quantity'); if (!itemId || !warehouseId || quantity < 0) throw new Error(`Row ${index + 2}: item, warehouse, or quantity is invalid.`); const { data: batch, error: batchError } = await client.from('item_batches').upsert({ item_id: itemId, batch_number: importText(row, 'batch'), expiry_on: importText(row, 'expiry') || null, mrp: importNumber(row, 'mrp') }, { onConflict: 'item_id,batch_number' }).select('id').single(); if (batchError) throw batchError; const { error: deleteError } = await client.from('stock_movements').delete().eq('organization_id', organizationId).eq('item_batch_id', batch.id).eq('warehouse_id', warehouseId).eq('movement_type', 'opening'); if (deleteError) throw deleteError; const { error: movementError } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: batch.id, warehouse_id: warehouseId, movement_type: 'opening', quantity, source_type: 'csv_import', remarks: importText(row, 'remarks') || 'Opening stock import' }); if (movementError) throw movementError }
    return { type, importedRows: rows.length, records: rows.length }
  }
  const partyKey = type === 'sales' ? 'customer' : 'supplier', rateKey = type === 'sales' ? 'rate' : 'purchase_rate'
  const [{ data: parties }, { data: items }] = await Promise.all([client.from('parties').select('legal_name,party_type').eq('organization_id', organizationId), client.from('items').select('code,name').eq('organization_id', organizationId)])
  const partyMap = new Map((parties ?? []).map((row) => [row.legal_name.toLowerCase(), row.party_type])), itemMap = new Map((items ?? []).map((row) => [row.code.toLowerCase(), row.name]) )
  const groups = new Map<string, ImportRow[]>()
  for (const [index, row] of rows.entries()) { const partyName = importText(row, partyKey), itemName = itemMap.get(importText(row, 'item_code').toLowerCase()); if (!partyMap.has(partyName.toLowerCase()) || !itemName) throw new Error(`Row ${index + 2}: party or item code does not exist in the master data.`); const invoice = importText(row, 'invoice_number'); groups.set(invoice, [...(groups.get(invoice) ?? []), row]) }
  const documents = [...groups].map(([invoiceNumber, invoiceRows]) => { const first = invoiceRows[0]; return { id: invoiceNumber, party: importText(first, partyKey), supplierInvoice: importText(first, 'supplier_invoice_number') || invoiceNumber, date: importText(first, 'invoice_date'), lines: invoiceRows.map((row) => ({ name: itemMap.get(importText(row, 'item_code').toLowerCase())!, itemCode: importText(row, 'item_code'), batch: importText(row, 'batch'), expiry: importText(row, 'expiry') || undefined, qty: importNumber(row, 'quantity'), freeQty: importNumber(row, 'free_quantity'), rate: importNumber(row, rateKey), discount: importNumber(row, 'discount_percent'), gstRate: importNumber(row, 'gst_rate'), mrp: importNumber(row, 'mrp') })) } })
  const { data, error } = await client.rpc('erp_import_invoices', { p_kind: type, p_organization_id: organizationId, p_financial_year_id: financialYearId, p_documents: documents, p_actor_auth_id: actor.id ?? null, p_actor_email: actor.email ?? null, p_request_id: actor.requestId ?? null })
  if (error) throw error
  return { ...data, importedRows: rows.length }
}

export async function create(resource: string, body: any, actor: MutationActor = {}) {
  // Option B: Fallback when Supabase credentials are not configured or invalid
  if (!hasValidDb()) {
    const id = `MOCK-${Date.now()}`
    const record = { ...body, id, code: body.code || `C-${Date.now()}`, status: 'active', balance: 0, created_at: date() }

    if (resource === 'purge-zero-transactions') {
      let removedCount = 0
      if (mockStore.ledgers) {
        const init = mockStore.ledgers.length
        mockStore.ledgers = mockStore.ledgers.filter((x: any) => (Number(x.debit) || 0) > 0 || (Number(x.credit) || 0) > 0)
        removedCount += init - mockStore.ledgers.length
      }
      if (mockStore.accounts) {
        const initAcc = mockStore.accounts.length
        mockStore.accounts = mockStore.accounts.filter((a: any) => (Number(a.balance) || 0) > 0)
        removedCount += initAcc - mockStore.accounts.length
      }
      return { success: true, removedCount }
    }

    if (resource === 'cancellations') {
      const kind = String(body.kind || 'sales')
      const targetId = String(body.id)
      const reason = String(body.reason || '')
      const storeKey = kind === 'sales' ? 'sales' : kind === 'purchases' ? 'purchases' : kind === 'challans' ? 'challans' : ''
      if (storeKey && mockStore[storeKey]) {
        const found = mockStore[storeKey].find((x: any) => x.id === targetId || x.number === targetId || x.dbId === targetId)
        if (found) {
          found.status = 'cancelled'
          found.narration = `Cancelled - Reason: ${reason}`
        }
      }
      persistTransactions()
      return { id: targetId, status: 'cancelled' }
    }

    if (resource === 'parties') {
      const opBal = Number(body.openingBalance || 0)
      const opType = body.openingType === 'Cr' ? 'Cr' : 'Dr'
      const netBal = opType === 'Cr' ? -Math.abs(opBal) : Math.abs(opBal)

      const partyType = 'both'
      const party = {
        id,
        code: body.code || `PTY-${Date.now()}`,
        name: body.name,
        type: partyType,
        station: body.station || '',
        accountGroup: body.accountGroup || 'BOTH',
        balancingMethod: body.balancingMethod || 'On Account',
        openingBalance: opBal,
        openingType: opType,
        mailTo: body.mailTo || body.name,
        address: body.address || '',
        addressLine2: body.addressLine2 || '',
        pincode: body.pincode || '',
        city: body.city || '',
        state: body.state || '18-ASSAM',
        country: body.country || 'INDIA',
        contactPerson: body.contactPerson || '',
        designation: body.designation || '',
        phone: body.phone || body.mobile || '',
        mobile: body.mobile || body.phone || '',
        phoneOff: body.phoneOff || '',
        phoneRes: body.phoneRes || '',
        fax: body.fax || '',
        email: body.email || '',
        website: body.website || '',
        freezeUpto: body.freezeUpto || '',
        narcoSchH: body.narcoSchH || 'No',
        dlNo: body.dlNo || body.dlNumber || '',
        dlNumber: body.dlNo || body.dlNumber || '',
        dlExp: body.dlExp || '',
        gstHeading: body.gstHeading || '',
        gstin: body.gstin || '',
        gstinDate: body.gstinDate || '',
        foodLicenceNo: body.foodLicenceNo || '',
        foodLicenceExp: body.foodLicenceExp || '',
        pan: body.pan || '',
        ledgerCategory: body.ledgerCategory || '',
        ledgerType: body.ledgerType || '',
        creditLimit: Number(body.creditLimit || 0),
        creditDays: Number(body.creditDays || 0),
        balance: netBal,
        totalDebit: opType === 'Dr' ? opBal : 0,
        totalCredit: opType === 'Cr' ? opBal : 0,
        lastSale: '',
        status: 'active'
      }
      mockStore.parties.unshift(party)
      persistCustomParty(party)
      return party
    }
    if (resource === 'items') {
      const code = body.code || `ITM-${Date.now().toString().slice(-6)}`
      const item = {
        id,
        code,
        name: body.name,
        packing: body.packing || '',
        manufacturer: body.manufacturer || '',
        salt: body.salt || '',
        hsn: body.hsn || '',
        gstRate: Number(body.gstRate || 0),
        mrp: Number(body.mrp || 0),
        saleRate: Number(body.saleRate || 0),
        purchaseRate: Number(body.purchaseRate || 0),
        scheduleClass: body.scheduleClass || 'OTC',
        prescriptionRequired: Boolean(body.prescriptionRequired),
        coldChain: Boolean(body.coldChain),
        controlledSubstance: Boolean(body.controlledSubstance),
        recalled: false,
        stock: 0,
        batches: [],
        batchCount: 0,
        category: body.category || 'Medicine',
        status: body.status || 'active'
      }
      mockStore.items.unshift(item)
      return item
    }
    if (resource === 'hsn') {
      const hsn = { id, code: body.code, description: body.description || '', gst_rate: Number(body.gstRate || 0) }
      mockStore.hsn.push(hsn)
      return hsn
    }
    if (resource === 'manufacturers') {
      const mfr = { id, name: body.name, code: body.code || '', is_active: body.status !== 'inactive' }
      mockStore.manufacturers.push(mfr)
      return mfr
    }
    if (resource === 'salts') {
      const salt = { id, code: body.code || `SALT-${Date.now()}`, name: body.name, composition: body.composition || '', category: body.category || '', itemcount: 0 }
      mockStore.salts.push(salt)
      return salt
    }
    if (resource === 'warehouses') {
      const wh = { id, code: body.code || `WH-${Date.now()}`, name: body.name, type: body.type || 'Store Room', address: body.address || '', capacity: Number(body.capacity || 0), used: 0, status: 'active' }
      mockStore.warehouses.push(wh)
      return wh
    }
    if (resource === 'accounts') {
      const acc = { id, code: body.code || `ACC-${Date.now()}`, name: body.name, group: body.group || 'General', balance: Number(body.openingBalance || 0), type: 'Dr', active: true }
      mockStore.accounts.push(acc)
      return acc
    }
    if (resource === 'series') {
      const s = { id, doc: body.doc, prefix: body.prefix || '', suffix: body.suffix || '', nextNo: Number(body.nextNo || 1), padding: Number(body.padding || 4), fyReset: body.fyReset !== false, active: body.active !== false }
      mockStore.series.push(s)
      return s
    }
    if (resource === 'communication-blocks') {
      const cb = { id, type: body.type, value: body.value, reason: body.reason || '', blockedOn: date() }
      mockStore['communication-blocks'].push(cb)
      return cb
    }
    if (resource === 'breakages') {
      const docTotal = Number(body.total || 0)
      const doc = { id, number: body.number || number('BRK'), date: body.date || date(), status: 'posted', total: docTotal, lines: body.lines || [] }
      if (!mockStore.breakages) mockStore.breakages = []
      mockStore.breakages.unshift(doc)
      return doc
    }
    if (resource === 'inventory-adjustments') {
      const doc = { id, date: body.date || date(), reason: body.reason || 'Physical Count Adjustment', lines: body.lines || [] }
      if (!mockStore.adjustments) mockStore.adjustments = []
      mockStore.adjustments.unshift(doc)
      return doc
    }
    if (resource === 'stock-transfers') {
      const doc = { id, number: body.number || number('TRF'), date: body.date || date(), lines: body.lines || [] }
      if (!mockStore['stock-transfers']) mockStore['stock-transfers'] = []
      mockStore['stock-transfers'].unshift(doc)
      return doc
    }

    if (resource === 'vouchers') {
      let vLines = Array.isArray(body.lines) ? [...body.lines] : []
      const rawAmt = Number(body.amount ?? body.total ?? 0)
      const targetParty = (body.party || body.customer || body.supplier || '').trim()

      // If lines are not provided but party and amount are, auto-construct balanced lines
      if (vLines.length === 0 && targetParty && rawAmt > 0) {
        const cashAcc = body.cashAccount || body.account || 'Cash Account'
        const vType = (body.type || body.voucher_type || 'Receipt').toLowerCase()
        const physNo = body.physicalVoucherNo || body.physical_voucher_no || ''
        const lineNarration = body.narration || `${body.type || 'Voucher'} - ${targetParty}`
        if (vType.includes('receipt')) {
          vLines = [
            { ledger: cashAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
            { ledger: targetParty, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
          ]
        } else if (vType.includes('payment')) {
          vLines = [
            { ledger: targetParty, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
            { ledger: cashAcc, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
          ]
        } else if (vType.includes('contra')) {
          const bankAcc = body.bankAccount || 'HDFC Bank'
          vLines = [
            { ledger: bankAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
            { ledger: cashAcc, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
          ]
        } else {
          vLines = [
            { ledger: cashAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
            { ledger: targetParty, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
          ]
        }
      }

      const docTotal = Number(body.total ?? rawAmt ?? vLines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0) ?? 0)
      const docParty = targetParty || body.party || 'General Voucher'
      const docNumber = body.number || body.id || number('VCH')
      const docDate = body.date || body.voucher_date || date()
      const doc = {
        ...body,
        id: body.id || id,
        number: docNumber,
        party: docParty,
        date: docDate,
        voucher_date: docDate,
        voucher_number: docNumber,
        voucher_type: (body.type || 'Journal').toLowerCase(),
        status: 'posted',
        total: docTotal,
        lines: vLines
      }
      mockStore.vouchers.unshift(doc)
      body.lines = vLines

      // Post each line to mockStore.ledgers so it appears in Ledger View, Master Ledger, DayBook, and Party 360
      if (Array.isArray(body.lines)) {
        body.lines.forEach((line: any, idx: number) => {
          if (!line.ledger) return
          const deb = Number(line.debit || 0)
          const cred = Number(line.credit || 0)
          if (deb <= 0 && cred <= 0) return
          const physNo = line.physicalVchNo || body.physicalVoucherNo || body.physical_voucher_no || ''
          mockStore.ledgers.unshift({
            id: `vch-line-${Date.now()}-${idx}`,
            party: line.ledger,
            date: docDate,
            vType: (body.type || 'journal').toLowerCase(),
            vNo: docNumber,
            physicalVchNo: physNo,
            debit: deb,
            credit: cred,
            narration: line.narration || body.narration || `${body.type || 'Voucher'} Entry - ${docNumber}${physNo ? ` (Phys: ${physNo})` : ''}`
          })

          // Update party balance if ledger matches party
          const pMatch = mockStore.parties.find(
            (p: any) => p.name.toLowerCase() === line.ledger.toLowerCase() || (p.code && p.code.toLowerCase() === line.ledger.toLowerCase())
          )
          if (pMatch) {
            pMatch.balance = (pMatch.balance || 0) + deb - cred
            pMatch.totalDebit = (pMatch.totalDebit || 0) + deb
            pMatch.totalCredit = (pMatch.totalCredit || 0) + cred
            pMatch.lastSale = docDate
          }

          // Update account balance if ledger matches account
          const aMatch = mockStore.accounts.find((a: any) => a.name.toLowerCase() === line.ledger.toLowerCase())
          if (aMatch) {
            aMatch.balance = (aMatch.balance || 0) + (aMatch.type === 'Dr' ? deb - cred : cred - deb)
          }
        })
      }

      persistTransactions()
      return doc
    }

    const specialKeys: Record<string, string> = {
      'sale-returns': 'sale-returns',
      'purchase-returns': 'purchase-returns',
      orders: 'orders',
      replacements: 'replacements',
      'counter-sales': 'counter-sales',
      pendings: 'pendings',
      'price-differences': 'price-differences',
      'item-mappings': 'item-mappings',
      'communication-blocks': 'communication-blocks',
      sales: 'sales',
      purchases: 'purchases',
      challans: 'challans'
    }
    const storeKey = specialKeys[resource] || resource
    if (mockStore[storeKey]) {
      const docTotal = Number(body.total ?? body.grandTotal ?? body.grand_total ?? 0)
      const docItems = Number(body.items ?? body.lines?.length ?? 1)
      const docParty = body.party || body.customer || body.supplier || 'Cash Customer'
      const docNumber = body.number || body.invoiceNo || body.id || (resource === 'sales' ? number('SI') : resource === 'purchases' ? number('PB') : number('MOCK'))
      const doc = {
        ...body,
        id,
        number: docNumber,
        party: docParty,
        date: body.date || date(),
        status: (body.status || 'posted').toLowerCase(),
        items: docItems,
        total: docTotal
      }
      const existingIdx = mockStore[storeKey].findIndex((x: any) => (body.id && (x.id === body.id || x.number === body.id)) || (body.number && x.number === body.number))
      if (existingIdx !== -1) {
        mockStore[storeKey][existingIdx] = {
          ...mockStore[storeKey][existingIdx],
          ...doc,
          id: mockStore[storeKey][existingIdx].id
        }
        return mockStore[storeKey][existingIdx]
      }
      mockStore[storeKey].unshift(doc)
      // Persist sales/purchases/challans so they survive across requests
      if (['sales', 'purchases', 'challans'].includes(storeKey)) persistTransactions()
      return doc
    }

    return record
  }

  const { client, organizationId, financialYearId } = await context()
  if (resource === 'purge-zero-transactions') {
    const { count, error } = await client
      .from('voucher_lines')
      .delete({ count: 'exact' })
      .or('and(debit.eq.0,credit.eq.0),and(debit.is.null,credit.is.null)')
    if (error) throw error

    const { data: emptyAccounts } = await client
      .from('chart_of_accounts')
      .select('id,opening_balance,voucher_lines(id)')
      .eq('organization_id', organizationId)
      .eq('opening_balance', 0)

    const idsToDelete = (emptyAccounts ?? [])
      .filter((a: any) => !a.voucher_lines || a.voucher_lines.length === 0)
      .map((a: any) => a.id)

    let accCount = 0
    if (idsToDelete.length > 0) {
      const { count: c } = await client.from('chart_of_accounts').delete({ count: 'exact' }).in('id', idsToDelete)
      accCount = c ?? 0
    }

    return { success: true, removedCount: (count ?? 0) + accCount }
  }
  if (resource === 'bulk-import') return importDataset(String(body.type ?? ''), body.rows, actor)
  if (resource === 'cancellations') {
    if (body.kind === 'challans') {
      const { error } = await client.from('delivery_challans').update({ status: 'cancelled' }).eq('id', body.id).eq('organization_id', organizationId)
      if (error) throw error
      return { id: body.id, status: 'cancelled' }
    }
    if (!['sales','purchases'].includes(body.kind) || !body.id) throw new Error('Invoice kind and database id are required.');
    const { error } = await client.rpc('erp_cancel_invoice',{ p_kind:body.kind,p_organization_id:organizationId,p_invoice_id:body.id,p_reason:body.reason ?? '',p_actor_auth_id:actor.id ?? null,p_actor_email:actor.email ?? null,p_request_id:actor.requestId ?? null });
    if(error) throw error;
    return { id:body.id,status:'cancelled' }
  }
  if (resource === 'inventory-adjustments') { const { data,error }=await client.rpc('erp_post_inventory_adjustment',{p_organization_id:organizationId,p_document:body,p_actor_auth_id:actor.id ?? null,p_actor_email:actor.email ?? null,p_request_id:actor.requestId ?? null}); if(error) throw error; return data }
  if (resource === 'parties') {
    if (!body.name) throw new Error('Party name is required.')
    const partyType = 'both'
    const { data, error } = await client.from('parties').insert({ organization_id: organizationId, code: body.code || `PTY-${Date.now()}`, party_type: partyType, legal_name: body.name, phone: body.phone || null, email: body.email || null, gstin: body.gstin || null, credit_limit: Number(body.creditLimit || 0) }).select('id,code').single()
    if (error) throw error
    if (body.city) { const { error: addressError } = await client.from('party_addresses').insert({ party_id: data.id, address_type: 'business', line1: body.address || body.city, city: body.city, is_default: true }); if (addressError) throw addressError }
    try {
      await client.from('chart_of_accounts').upsert({
        organization_id: organizationId,
        code: data.code,
        name: body.name,
        account_type: 'party',
        account_group: body.accountGroup || 'Sundry Debtors & Creditors',
        party_id: data.id,
        is_active: true
      }, { onConflict: 'party_id' })
    } catch (coaErr) {
      console.warn('Could not auto-create chart_of_accounts record for party:', coaErr)
    }
    return { ...body, id: data.id, code: data.code, type: partyType, balance: 0, status: 'active' }
  }
  if (resource === 'hsn') { const { data, error } = await client.from('hsn_codes').insert({ organization_id: organizationId, code: body.code, description: body.description ?? body.name ?? null, gst_rate: Number(body.gst_rate ?? body.gstRate ?? 0) }).select('*').single(); if (error) throw error; return data }
  if (resource === 'manufacturers') { const { data, error } = await client.from('manufacturers').insert({ organization_id: organizationId, name: body.name, code: body.code || null, is_active: body.status !== 'inactive' }).select('*').single(); if (error) throw error; return data }
  if (resource === 'salts') { const { data, error } = await client.from('salts').insert({ organization_id: organizationId, code: body.code || `S-${Date.now()}`, name: body.name, composition: body.composition || null, category: body.category || null }).select('*').single(); if (error) throw error; return { ...data, itemcount: 0 } }
  if (resource === 'warehouses') { const { data, error } = await client.from('warehouses').insert({ organization_id: organizationId, code: body.code || `WH-${Date.now()}`, name: body.name, warehouse_type: body.type || 'Store Room', address: body.address || null, capacity: Number(body.capacity || 0) }).select('*').single(); if (error) throw error; return { id: data.id, code: data.code, name: data.name, type: data.warehouse_type, address: data.address ?? '', capacity: Number(data.capacity), used: 0, status: 'active' } }
  if (resource === 'accounts') { const { data, error } = await client.from('chart_of_accounts').insert({ organization_id: organizationId, code: body.code || `ACC-${Date.now()}`, name: body.name, account_type: body.accountType || 'general', account_group: body.group || 'General', opening_balance: Number(body.openingBalance || 0) }).select('*').single(); if (error) throw error; return { id: data.id, name: data.name, group: data.account_group, balance: Math.abs(Number(data.opening_balance)), type: Number(data.opening_balance) < 0 ? 'Cr' : 'Dr' } }
  if (resource === 'series') { const { data, error } = await client.from('document_series').insert({ organization_id: organizationId, document_type: body.doc, prefix: body.prefix || '', suffix: body.suffix || '', next_number: Number(body.nextNo || 1), padding: Number(body.padding || 4), financial_year_reset: body.fyReset !== false, is_active: body.active !== false }).select('*').single(); if (error) throw error; return { ...body, id: data.id } }
  if (resource === 'communication-blocks') { const { data, error } = await client.from('communication_blocks').insert({ organization_id: organizationId, channel: body.type, destination: body.value, reason: body.reason || null }).select('*').single(); if (error) throw error; return { id: data.id, type: data.channel, value: data.destination, reason: data.reason ?? '', blockedOn: data.blocked_on } }
  if (resource === 'breakages') {
    const rawLines = Array.isArray(body.lines) && body.lines.length > 0 ? body.lines : (body.name || body.itemName) ? [{ name: body.name || body.itemName, batch: body.batch, qty: body.qty, rate: body.rate, mrp: body.mrp, expiry: body.expiry }] : []
    if (!rawLines.length) throw new Error('Add at least one expiry or breakage line.')
    const documentNumber = body.number || number(body.entryType === 'expiry' ? 'EXP' : 'BRK')
    const prepared: Array<{ batchId: string; warehouseId: string; qty: number; name: string }> = []
    for (const line of rawLines) { const resolved = await stock(client, organizationId, { ...line, rate: line.rate ?? 0 }); const { data: movements, error: movementError } = await client.from('stock_movements').select('quantity').eq('item_batch_id', resolved.batchId).eq('warehouse_id', resolved.warehouseId); if (movementError) throw movementError; const available = (movements ?? []).reduce((sum, movement) => sum + Number(movement.quantity), 0); if (available < Number(line.qty)) throw new Error(`Only ${available} units of ${line.name} are available.`); prepared.push({ batchId: resolved.batchId, warehouseId: resolved.warehouseId, qty: Number(line.qty), name: line.name }) }
    const { data: document, error: documentError } = await client.from('business_documents').insert({ organization_id: organizationId, document_type: 'breakage', document_number: documentNumber, document_date: body.date || date(), status: 'posted', total: Number(body.total || 0), details: { ...body, lines: rawLines } }).select('id').single(); if (documentError) throw documentError
    for (const row of prepared) { const { error } = await client.from('stock_movements').insert({ organization_id: organizationId, item_batch_id: row.batchId, warehouse_id: row.warehouseId, movement_type: body.entryType === 'expiry' ? 'expiry' : 'breakage', quantity: -Math.abs(row.qty), source_type: 'breakage', source_id: document.id }); if (error) throw error }
    return { ...body, id: document.id, number: documentNumber, date: body.date || date() }
  }
  const documentResources: Record<string, { type: string; prefix: string }> = {
    'sale-returns': { type: 'sale_return', prefix: 'SR' },
    'purchase-returns': { type: 'purchase_return', prefix: 'PR' },
    orders: { type: 'order', prefix: 'ORD' },
    replacements: { type: 'replacement', prefix: 'REP' },
    'counter-sales': { type: 'counter_sale', prefix: 'CS' },
    pendings: { type: 'pending', prefix: 'PND' },
    'price-differences': { type: 'price_difference', prefix: 'PD' },
    'item-mappings': { type: 'item_mapping', prefix: 'MAP' }
  }
  if (documentResources[resource]) {
    const config = documentResources[resource]
    const partyId = body.party ? await party(client, organizationId, body.party, body.partyType === 'supplier' ? 'supplier' : 'customer') : null
    const documentNumber = body.number || number(config.prefix)
    const { data, error } = await client
      .from('business_documents')
      .insert({
        organization_id: organizationId,
        document_type: config.type,
        document_number: documentNumber,
        document_date: body.date || date(),
        party_id: partyId,
        status: body.status || 'posted',
        total: Number(body.total || 0),
        details: body
      })
      .select('id')
      .single()
    if (error) throw error
    return { ...body, id: data.id, number: documentNumber, date: body.date || date() }
  }
  if (resource === 'items') {
    if (!body.name) throw new Error('Item name is required.')
    const manufacturerId = body.manufacturer ? (await client.from('manufacturers').select('id').eq('organization_id', organizationId).eq('name', body.manufacturer).maybeSingle()).data?.id : null
    const saltId = body.salt ? (await client.from('salts').select('id').eq('organization_id', organizationId).eq('name', body.salt).maybeSingle()).data?.id : null
    const hsnId = body.hsn ? (await client.from('hsn_codes').select('id').eq('organization_id', organizationId).eq('code', body.hsn).maybeSingle()).data?.id : null
    const { data, error } = await client.from('items').insert({ organization_id: organizationId, code: body.code || `ITM-${Date.now()}`, name: body.name, packing: body.packing || null, manufacturer_id: manufacturerId ?? null, salt_id: saltId ?? null, hsn_id: hsnId ?? null, mrp: Number(body.mrp || 0), sale_rate: Number(body.saleRate || 0), purchase_rate: Number(body.purchaseRate || 0), is_active: body.status !== 'banned', schedule_class:body.scheduleClass || 'OTC', prescription_required:Boolean(body.prescriptionRequired), cold_chain:Boolean(body.coldChain), controlled_substance:Boolean(body.controlledSubstance) }).select('id,code').single()
    if (error) throw error
    return { ...body, id: data.id, code: data.code, stock: 0, batchCount: 0, status: body.status ?? 'active' }
  }
  if (resource === 'stock-transfers') {
    if (!body.lines?.length) throw new Error('Add at least one stock transfer line.')
    const prepared: Array<{ line: any; batchId: string; fromId: string; toId: string }> = []
    for (const line of body.lines) {
      if (!line.from || !line.to || line.from === line.to || Number(line.qty) <= 0) throw new Error('Each transfer needs different locations and a positive quantity.')
      const { data: itemRow } = await client.from('items').select('id').eq('organization_id', organizationId).eq('name', line.itemName).maybeSingle()
      const { data: batchRow } = itemRow ? await client.from('item_batches').select('id').eq('item_id', itemRow.id).eq('batch_number', line.batch).maybeSingle() : { data: null }
      const { data: fromRow } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('name', line.from).maybeSingle()
      const { data: toRow } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('name', line.to).maybeSingle()
      if (!batchRow || !fromRow || !toRow) throw new Error(`Inventory references are incomplete for ${line.itemName}.`)
      const { data: movements, error: movementError } = await client.from('stock_movements').select('quantity').eq('item_batch_id', batchRow.id).eq('warehouse_id', fromRow.id); if (movementError) throw movementError
      const available = (movements ?? []).reduce((sum, movement) => sum + Number(movement.quantity), 0)
      if (available < Number(line.qty)) throw new Error(`Only ${available} units of ${line.itemName} are available in ${line.from}.`)
      prepared.push({ line, batchId: batchRow.id, fromId: fromRow.id, toId: toRow.id })
    }
    const documentNumber = body.id || number('TRF')
    const { data: document, error: documentError } = await client.from('business_documents').insert({ organization_id: organizationId, document_type: 'stock_transfer', document_number: documentNumber, document_date: body.date || date(), status: 'posted', details: { lines: body.lines } }).select('id').single(); if (documentError) throw documentError
    for (const row of prepared) { const common = { organization_id: organizationId, item_batch_id: row.batchId, source_type: 'stock_transfer', source_id: document.id, occurred_at: `${body.date || date()}T12:00:00Z` }; const { error } = await client.from('stock_movements').insert([{ ...common, warehouse_id: row.fromId, movement_type: 'transfer_out', quantity: -Math.abs(Number(row.line.qty)), remarks: `Transfer to ${row.line.to}` }, { ...common, warehouse_id: row.toId, movement_type: 'transfer_in', quantity: Math.abs(Number(row.line.qty)), remarks: `Transfer from ${row.line.from}` }]); if (error) throw error }
    return { id: documentNumber, date: body.date || date(), lines: body.lines }
  }

  const ensureInvoicePrerequisites = async (kind: 'sales' | 'purchases') => {
    try {
      // 1. Ensure MAIN warehouse exists
      const { data: wh } = await client.from('warehouses').select('id').eq('organization_id', organizationId).eq('code', 'MAIN').maybeSingle()
      if (!wh) {
        await client.from('warehouses').upsert({
          organization_id: organizationId,
          code: 'MAIN',
          name: 'Main Warehouse',
          warehouse_type: 'Store Room',
          capacity: 10000,
          is_active: true
        }, { onConflict: 'organization_id,code' })
      }

      // 2. Ensure party exists
      const partyName = (body.party || body.customer || body.supplier || '').trim()
      if (partyName) {
        const { data: existingParty } = await client.from('parties').select('id').eq('organization_id', organizationId).ilike('legal_name', partyName).maybeSingle()
        if (!existingParty) {
          const partyCode = `PTY-${Date.now()}`
          const { data: createdP } = await client.from('parties').insert({
            organization_id: organizationId,
            code: partyCode,
            party_type: 'both',
            legal_name: partyName,
            is_blocked: false
          }).select('id,code').maybeSingle()
          if (createdP) {
            await client.from('chart_of_accounts').upsert({
              organization_id: organizationId,
              code: createdP.code,
              name: partyName,
              account_type: 'party',
              account_group: kind === 'sales' ? 'Sundry Debtors' : 'Sundry Creditors',
              party_id: createdP.id,
              is_active: true
            }, { onConflict: 'party_id' })
          }
        }
      }

      // 3. Ensure items and batches exist in DB
      for (const line of (body.lines || [])) {
        const itemName = (line.name || line.item || line.itemName || line.itemCode || '').trim()
        if (!itemName) continue
        const { data: itemByName } = await client.from('items').select('id,mrp').eq('organization_id', organizationId).ilike('name', itemName).limit(1).maybeSingle()
        let itemFound = itemByName
        if (!itemFound && line.itemCode) {
          const { data: itemByCode } = await client.from('items').select('id,mrp').eq('organization_id', organizationId).eq('code', line.itemCode).limit(1).maybeSingle()
          itemFound = itemByCode
        }
        let itemId = itemFound?.id
        let itemMrp = itemFound ? Number(itemFound.mrp || 0) : Number(line.mrp || line.rate || 0)
        if (!itemId) {
          const { data: newItem } = await client.from('items').insert({
            organization_id: organizationId,
            code: line.itemCode || `ITM-${Date.now().toString().slice(-6)}`,
            name: itemName,
            mrp: Number(line.mrp || line.rate || 0),
            sale_rate: Number(line.rate || 0),
            purchase_rate: Number(line.purchaseRate || line.rate || 0),
            is_active: true
          }).select('id,mrp').maybeSingle()
          if (newItem) {
            itemId = newItem.id
            itemMrp = Number(newItem.mrp || 0)
          }
        }
        if (itemId) {
          const batchNum = (line.batch || 'UNSPECIFIED').trim()
          const { data: batchFound } = await client.from('item_batches').select('id').eq('item_id', itemId).eq('batch_number', batchNum).maybeSingle()
          if (!batchFound) {
            await client.from('item_batches').insert({
              item_id: itemId,
              batch_number: batchNum,
              expiry_on: line.expiry || null,
              mrp: Number(line.mrp || itemMrp || 0)
            })
          }
        }
      }
    } catch (prereqErr) {
      console.warn('ensureInvoicePrerequisites non-fatal warning:', prereqErr)
    }
  }

  if (resource === 'sales') {
    await ensureInvoicePrerequisites('sales')
    const invoiceDoc = {
      ...body,
      id: body.id || number('SI'),
      date: body.date || date(),
      patientName: body.patientName || body.party || 'General Patient',
      prescriberName: body.prescriberName || 'Attending Physician',
      prescriptionReference: body.prescriptionReference || `RX-${Date.now().toString().slice(-6)}`
    }
    try {
      const { data, error } = await client.rpc('erp_post_invoice', {
        p_kind: 'sales',
        p_organization_id: organizationId,
        p_financial_year_id: financialYearId,
        p_document: invoiceDoc,
        p_actor_auth_id: actor.id ?? null,
        p_actor_email: actor.email ?? null,
        p_request_id: actor.requestId ?? null
      })
      if (error) throw error
      return data
    } catch (rpcError: any) {
      console.warn('erp_post_invoice sales fallback to table insert:', rpcError)
      const docNumber = invoiceDoc.id
      const docTotal = Number(body.total ?? body.grandTotal ?? 0)
      const partyId = await party(client, organizationId, body.party, 'customer')
      const { data: inv, error: invError } = await client.from('sales_invoices').insert({
        organization_id: organizationId,
        financial_year_id: financialYearId,
        party_id: partyId,
        invoice_number: docNumber,
        invoice_date: invoiceDoc.date,
        status: 'posted',
        subtotal: docTotal,
        discount_total: 0,
        tax_total: 0,
        grand_total: docTotal
      }).select('id,invoice_number').single()
      if (invError) throw new Error(rpcError?.message || invError.message || 'Could not save sales invoice.')
      return { ...body, id: inv.invoice_number, dbId: inv.id }
    }
  }
  if (resource === 'purchases') {
    await ensureInvoicePrerequisites('purchases')
    const invoiceDoc = {
      ...body,
      id: body.id || number('PB'),
      date: body.date || date()
    }
    try {
      const { data, error } = await client.rpc('erp_post_invoice', {
        p_kind: 'purchases',
        p_organization_id: organizationId,
        p_financial_year_id: financialYearId,
        p_document: invoiceDoc,
        p_actor_auth_id: actor.id ?? null,
        p_actor_email: actor.email ?? null,
        p_request_id: actor.requestId ?? null
      })
      if (error) throw error
      return data
    } catch (rpcError: any) {
      console.warn('erp_post_invoice purchases fallback to table insert:', rpcError)
      const docNumber = invoiceDoc.id
      const docTotal = Number(body.total ?? body.grandTotal ?? 0)
      const partyId = await party(client, organizationId, body.party, 'supplier')
      const { data: inv, error: invError } = await client.from('purchase_invoices').insert({
        organization_id: organizationId,
        financial_year_id: financialYearId,
        party_id: partyId,
        invoice_number: docNumber,
        supplier_invoice_number: body.supplierInvoice || docNumber,
        invoice_date: invoiceDoc.date,
        status: 'posted',
        subtotal: docTotal,
        discount_total: 0,
        tax_total: 0,
        grand_total: docTotal
      }).select('id,invoice_number').single()
      if (invError) throw new Error(rpcError?.message || invError.message || 'Could not save purchase invoice.')
      return { ...body, id: inv.invoice_number, dbId: inv.id }
    }
  }
  if (resource === 'challans') {
    if (!body.party || !body.lines?.length) throw new Error('Party and at least one challan line are required.')
    const challanNumber = body.id || number('CH'), challanDate = body.date || date(), partyId = await party(client, organizationId, body.party)
    const { data: challan, error } = await client.from('delivery_challans').insert({ organization_id: organizationId, financial_year_id: financialYearId, party_id: partyId, challan_number: challanNumber, challan_date: challanDate, transport_name: body.transport ?? null, status: 'posted' }).select('id').single(); if (error) throw error
    for (const line of body.lines as Line[]) { const s = await stock(client, organizationId, line); const { error: lineError } = await client.from('delivery_challan_lines').insert({ challan_id: challan.id, item_batch_id: s.batchId, quantity: +line.qty }); if (lineError) throw lineError }
    return { id: challanNumber, party: body.party, transport: body.transport ?? '', date: challanDate, lines: body.lines }
  }
  if (resource === 'vouchers') {
    let vLines = Array.isArray(body.lines) ? [...body.lines] : []
    const rawAmt = Number(body.amount ?? body.total ?? 0)
    const targetParty = (body.party || body.customer || body.supplier || '').trim()

    // If lines are not provided but party and amount are, auto-construct balanced lines
    if (vLines.length === 0 && targetParty && rawAmt > 0) {
      const cashAcc = body.cashAccount || body.account || 'Cash Account'
      const vType = (body.type || body.voucher_type || 'Receipt').toLowerCase()
      const physNo = body.physicalVoucherNo || body.physical_voucher_no || ''
      const lineNarration = body.narration || `${body.type || 'Voucher'} - ${targetParty}`
      if (vType.includes('receipt')) {
        vLines = [
          { ledger: cashAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
          { ledger: targetParty, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
        ]
      } else if (vType.includes('payment')) {
        vLines = [
          { ledger: targetParty, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
          { ledger: cashAcc, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
        ]
      } else if (vType.includes('contra')) {
        const bankAcc = body.bankAccount || 'HDFC Bank'
        vLines = [
          { ledger: bankAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
          { ledger: cashAcc, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
        ]
      } else {
        vLines = [
          { ledger: cashAcc, debit: rawAmt, credit: 0, physicalVchNo: physNo, narration: lineNarration },
          { ledger: targetParty, debit: 0, credit: rawAmt, physicalVchNo: physNo, narration: lineNarration }
        ]
      }
    }
    body.lines = vLines

    const debit = body.lines?.reduce((sum: number, v: any) => sum + +(v.debit || 0), 0) ?? 0
    const credit = body.lines?.reduce((sum: number, v: any) => sum + +(v.credit || 0), 0) ?? 0
    if (!body.lines?.length || debit <= 0 || Math.abs(debit - credit) > 0.001) throw new Error('Voucher must contain balanced debit and credit lines.')
    let voucherNumber = String(body.number || body.id || number('VCH')).trim()
    const voucherDate = body.date || body.voucher_date || date()

    // Ensure voucher_number is unique for this organization and financial year
    let voucher: { id: string } | null = null
    let lastError: any = null

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: vch, error } = await client
        .from('vouchers')
        .insert({
          organization_id: organizationId,
          financial_year_id: financialYearId,
          voucher_type: (body.type || 'journal').toLowerCase(),
          voucher_number: voucherNumber,
          voucher_date: voucherDate,
          status: 'posted',
          narration: body.narration ?? null
        })
        .select('id')
        .single()

      if (!error && vch) {
        voucher = vch
        lastError = null
        break
      }

      lastError = error
      // If duplicate key violation, append a unique timestamp/entropy suffix and retry
      if (
        error?.code === '23505' ||
        error?.message?.includes('duplicate key') ||
        error?.message?.includes('vouchers_organization_id_financial_year_id_voucher_number_key')
      ) {
        voucherNumber = `VCH-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 90)}`
      } else {
        break
      }
    }

    if (lastError || !voucher) throw (lastError || new Error('Could not save voucher.'))
    for (const line of body.lines) {
      const accountId = await account(client, organizationId, line.ledger)
      const { error: lineError } = await client.from('voucher_lines').insert({
        voucher_id: voucher.id,
        account_id: accountId,
        debit: +(line.debit || 0),
        credit: +(line.credit || 0),
        narration: line.narration ?? body.narration ?? null
      })
      if (lineError) throw lineError
    }
    return { id: voucherNumber, type: body.type ?? 'Journal', date: voucherDate, narration: body.narration ?? '', lines: body.lines }
  }
  throw new Error('Unknown ERP resource.')
}

export async function update(resource: string, id: string, body: any) {
  // Option B: Fallback when Supabase credentials are not configured or invalid
  if (!hasValidDb()) {
    const specialKeys: Record<string, string> = {
      'sale-returns': 'sales',
      'purchase-returns': 'purchases',
      'communication-blocks': 'communication-blocks'
    }
    const storeKey = specialKeys[resource] || resource
    const list = mockStore[storeKey]
    if (list) {
      const idx = list.findIndex((x: any) => x.id === id || x.number === id || x.code === id || (x.name && x.name.toLowerCase() === id.toLowerCase()))
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...body }
        if (resource === 'parties') {
          persistCustomParty(list[idx])
        }
        return list[idx]
      }
    }
    return body
  }

  const { client, organizationId } = await context()
  if (resource === 'sales') {
    const { data, error } = await client.from('sales_invoices').update(body).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'purchases') {
    const { data, error } = await client.from('purchase_invoices').update(body).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'sale-returns' || resource === 'purchase-returns') {
    const docType = resource === 'sale-returns' ? 'sale_return' : 'purchase_return'
    const { data, error } = await client.from('business_documents').update({ status: body.status, details: body.details || {} }).eq('id', id).eq('organization_id', organizationId).eq('document_type', docType).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'parties') {
    const values: any = {}
    if ('name' in body) values.legal_name = body.name
    if ('type' in body) values.party_type = body.type
    if ('phone' in body) values.phone = body.phone
    if ('email' in body) values.email = body.email
    if ('gstin' in body) values.gstin = body.gstin
    if ('creditLimit' in body) values.credit_limit = Number(body.creditLimit)
    if ('status' in body) values.is_blocked = body.status === 'blocked'
    const { data, error } = await client.from('parties').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    if (body.city || body.address) {
      try {
        await client.from('party_addresses').upsert({
          party_id: id,
          address_type: 'business',
          line1: body.address || body.city,
          city: body.city || '',
          is_default: true
        }, { onConflict: 'party_id' })
      } catch {}
    }
    if (body.name) {
      try {
        await client.from('chart_of_accounts').update({ name: body.name }).eq('party_id', id).eq('organization_id', organizationId)
      } catch {}
    }
    return { ...body, id: data.id, code: data.code, ...data }
  }
  if (resource === 'series') { const values = { document_type: body.doc, prefix: body.prefix, suffix: body.suffix, next_number: Number(body.nextNo), padding: Number(body.padding), financial_year_reset: body.fyReset, is_active: body.active }; const { data, error } = await client.from('document_series').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'warehouses') { const values: any = {}; if ('name' in body) values.name = body.name; if ('type' in body) values.warehouse_type = body.type; if ('address' in body) values.address = body.address; if ('capacity' in body) values.capacity = Number(body.capacity); if ('status' in body) values.is_active = body.status === 'active'; const { data, error } = await client.from('warehouses').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'accounts') { const values: any = {}; if ('name' in body) values.name = body.name; if ('group' in body) values.account_group = body.group; if ('openingBalance' in body) values.opening_balance = Number(body.openingBalance); const { data, error } = await client.from('chart_of_accounts').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data }
  if (resource === 'items') {
    const values: any = {}
    if ('code' in body) values.code = body.code
    if ('name' in body) values.name = body.name
    if ('packing' in body) values.packing = body.packing
    if ('mrp' in body) values.mrp = Number(body.mrp)
    if ('saleRate' in body) values.sale_rate = Number(body.saleRate)
    if ('purchaseRate' in body) values.purchase_rate = Number(body.purchaseRate)
    if ('status' in body) values.is_active = body.status !== 'banned'
    if ('scheduleClass' in body) values.schedule_class = body.scheduleClass
    if ('prescriptionRequired' in body) values.prescription_required = Boolean(body.prescriptionRequired)
    if ('coldChain' in body) values.cold_chain = Boolean(body.coldChain)
    if ('controlledSubstance' in body) values.controlled_substance = Boolean(body.controlledSubstance)
    if ('salesSchemeDeal' in body) values.sales_scheme_deal = Number(body.salesSchemeDeal)
    if ('salesSchemeFree' in body) values.sales_scheme_free = Number(body.salesSchemeFree)
    if (body.manufacturer) {
      try {
        const { data: m } = await client.from('manufacturers').select('id').eq('organization_id', organizationId).ilike('name', body.manufacturer).maybeSingle()
        if (m) values.manufacturer_id = m.id
      } catch {}
    }
    if (body.salt) {
      try {
        const { data: s } = await client.from('salts').select('id').eq('organization_id', organizationId).ilike('name', body.salt).maybeSingle()
        if (s) values.salt_id = s.id
      } catch {}
    }
    if (body.hsn) {
      try {
        const { data: h } = await client.from('hsn_codes').select('id').eq('organization_id', organizationId).eq('code', body.hsn).maybeSingle()
        if (h) values.hsn_id = h.id
      } catch {}
    }
    const { data, error } = await client.from('items').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'manufacturers') {
    const values: any = {}
    if ('name' in body) values.name = body.name
    if ('code' in body) values.code = body.code
    if ('status' in body) values.is_active = body.status === 'Active' || body.status === true || body.status === 'active'
    if ('is_active' in body) values.is_active = Boolean(body.is_active)
    const { data, error } = await client.from('manufacturers').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'salts') {
    const values: any = {}
    if ('name' in body) values.name = body.name
    if ('code' in body) values.code = body.code
    if ('composition' in body) values.composition = body.composition
    if ('category' in body) values.category = body.category
    const { data, error } = await client.from('salts').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  if (resource === 'hsn') {
    const values: any = {}
    if ('code' in body) values.code = body.code
    if ('description' in body) values.description = body.description
    if ('gst_rate' in body) values.gst_rate = Number(body.gst_rate)
    if ('gstRate' in body) values.gst_rate = Number(body.gstRate)
    const { data, error } = await client.from('hsn_codes').update(values).eq('id', id).eq('organization_id', organizationId).select('*').single()
    if (error) throw error
    return data
  }
  const masterTables: Record<string, string> = { manufacturers: 'manufacturers', salts: 'salts', hsn: 'hsn_codes' }
  if (!masterTables[resource]) throw new Error('Unknown ERP resource.')
  const { data, error } = await client.from(masterTables[resource]).update(body).eq('id', id).eq('organization_id', organizationId).select('*').single(); if (error) throw error; return data
}

export async function remove(resource: string, id: string) {
  // Option B: Fallback when Supabase credentials are not configured or invalid
  if (!hasValidDb()) {
    const specialKeys: Record<string, string> = {
      'sale-returns': 'sales',
      'purchase-returns': 'purchases',
      'communication-blocks': 'communication-blocks'
    }
    const storeKey = specialKeys[resource] || resource
    const list = mockStore[storeKey]
    if (list) {
      if (id === 'zero-value' || id === 'all-zero') {
        mockStore[storeKey] = list.filter((x: any) => (Number(x.debit) || 0) > 0 || (Number(x.credit) || 0) > 0)
      } else if (id === 'purge-duplicates' || id === 'duplicates') {
        const seen = new Map<string, any>()
        let removed = 0
        for (const item of list) {
          const k = (item.name || item.legal_name || '').trim().toLowerCase()
          if (!seen.has(k)) seen.set(k, item)
          else removed++
        }
        mockStore[storeKey] = Array.from(seen.values())
        return { id, removedCount: removed }
      } else {
        const idx = list.findIndex((x: any) => x.id === id)
        if (idx !== -1) list.splice(idx, 1)
      }
    }
    return { id }
  }

  const { client, organizationId } = await context()
  if (resource === 'parties' && (id === 'purge-duplicates' || id === 'duplicates')) {
    const data = await fetchAll<any>((from, to) =>
      client.from('parties').select('id,legal_name,created_at').eq('organization_id', organizationId).order('created_at', { ascending: true }).range(from, to)
    )
    const seen = new Map<string, string>()
    const duplicateIds: string[] = []
    for (const p of (data ?? [])) {
      const key = (p.legal_name || '').trim().toLowerCase()
      if (!key) continue
      if (!seen.has(key)) {
        seen.set(key, p.id)
      } else {
        duplicateIds.push(p.id)
      }
    }
    if (duplicateIds.length > 0) {
      try {
        await client.from('parties').delete().in('id', duplicateIds).eq('organization_id', organizationId)
        await client.from('party_addresses').delete().in('party_id', duplicateIds)
        await client.from('chart_of_accounts').delete().in('party_id', duplicateIds)
      } catch {}
    }
    return { id, removedCount: duplicateIds.length }
  }
  if (resource === 'ledgers') {
    const { count, error } = await client
      .from('voucher_lines')
      .delete({ count: 'exact' })
      .or('and(debit.eq.0,credit.eq.0),and(debit.is.null,credit.is.null)')
    if (error) throw error
    return { id, removedCount: count ?? 0 }
  }
  if (resource === 'sale-returns' || resource === 'purchase-returns') {
    const docType = resource === 'sale-returns' ? 'sale_return' : 'purchase_return'
    const { error } = await client.from('business_documents').delete().eq('id', id).eq('organization_id', organizationId).eq('document_type', docType)
    if (error) throw error
    return { id }
  }
  if (resource === 'item-mappings') { const { error } = await client.from('business_documents').delete().eq('id', id).eq('organization_id', organizationId).eq('document_type', 'item_mapping'); if (error) throw error; return { id } }
  if (resource === 'manufacturers') {
    await client.from('items').update({ manufacturer_id: null }).eq('manufacturer_id', id).eq('organization_id', organizationId)
    await client.from('product_recalls').update({ manufacturer_id: null }).eq('manufacturer_id', id).eq('organization_id', organizationId)
    const { error } = await client.from('manufacturers').delete().eq('id', id).eq('organization_id', organizationId)
    if (error) throw error
    return { id }
  }
  if (resource === 'salts') {
    await client.from('items').update({ salt_id: null }).eq('salt_id', id).eq('organization_id', organizationId)
    const { error } = await client.from('salts').delete().eq('id', id).eq('organization_id', organizationId)
    if (error) throw error
    return { id }
  }
  if (resource === 'hsn') {
    await client.from('items').update({ hsn_id: null }).eq('hsn_id', id).eq('organization_id', organizationId)
    const { error } = await client.from('hsn_codes').delete().eq('id', id).eq('organization_id', organizationId)
    if (error) throw error
    return { id }
  }
  const masterTables: Record<string, string> = { parties: 'parties', warehouses: 'warehouses', accounts: 'chart_of_accounts', items: 'items', series: 'document_series', 'communication-blocks': 'communication_blocks' }
  if (!masterTables[resource]) throw new Error('Unknown ERP resource.')
  const { error } = await client.from(masterTables[resource]).delete().eq('id', id).eq('organization_id', organizationId); if (error) throw error
  return { id }
}
