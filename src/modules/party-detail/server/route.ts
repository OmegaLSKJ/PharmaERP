import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient, applyRefreshedSession, hasRealSupabase, verifyRequest } from '../../../../apps/web/lib/auth'
import { canAccess, userRole } from '../../../../apps/web/lib/permissions'
import { list } from '../../../../apps/web/lib/erp-store'

const isUuid = (value: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  const fail = (message: string, status: number) => NextResponse.json({ error: { message } }, { status, headers })

  const partyId = request.nextUrl.searchParams.get('partyId')
  const partyName = request.nextUrl.searchParams.get('partyName')

  if (!partyId && !partyName) return fail('A party identifier or name is required.', 400)

  try {
    const auth = await verifyRequest(request)
    if (!auth) return fail('Please sign in to view party details.', 401)

    const role = userRole(auth.user.app_metadata?.role, auth.user.user_metadata?.role)
    if (!canAccess(role, 'GET', 'parties')) return fail('You do not have permission to read party master details.', 403)

    if (!hasRealSupabase()) {
      // Mock / Offline fallback
      const storeParties = (await list('parties')) as any[]
      const norm = (s?: string | null) => (s || '').trim().toLowerCase()
      const searchTarget = norm(partyId || partyName)
      const found = storeParties.find(
        (p: any) => norm(p.id) === searchTarget || norm(p.code) === searchTarget || norm(p.name) === searchTarget
      )
      if (!found) return fail('Party not found.', 404)
      return applyRefreshedSession(NextResponse.json({ data: found }, { headers }), auth)
    }

    const client = adminClient()
    const orgName = process.env.ERP_ORGANIZATION_NAME ?? 'Borgang Drug Distributors'
    const { data: organization, error: organizationError } = await client
      .from('organizations')
      .select('id')
      .eq('name', orgName)
      .maybeSingle()

    if (organizationError || !organization) return fail('The configured organization could not be found.', 503)

    const assigned = auth.user.app_metadata?.organization_id
    if (assigned && assigned !== organization.id) return fail('This session belongs to another organization.', 403)

    const orgId = organization.id

    // 1. Resolve party record
    let partyRecord: any = null
    if (partyId && isUuid(partyId)) {
      const { data, error } = await client
        .from('parties')
        .select('*,party_addresses(line1,line2,city,state_code,postal_code,country,is_default),party_details(*),drug_licenses(license_number,license_type,expires_on,status)')
        .eq('organization_id', orgId)
        .eq('id', partyId)
        .maybeSingle()
      if (error) throw error
      partyRecord = data
    } else {
      const searchTerm = partyName?.trim() || partyId?.trim() || ''
      const { data, error } = await client
        .from('parties')
        .select('*,party_addresses(line1,line2,city,state_code,postal_code,country,is_default),party_details(*),drug_licenses(license_number,license_type,expires_on,status)')
        .eq('organization_id', orgId)
        .or(`legal_name.ilike.${searchTerm},code.eq.${searchTerm}`)
        .limit(1)
      if (error) throw error
      partyRecord = data?.[0]
    }

    if (!partyRecord) {
      // Check in-memory store before failing
      const storeParties = (await list('parties')) as any[]
      const norm = (s?: string | null) => (s || '').trim().toLowerCase()
      const searchTarget = norm(partyId || partyName)
      const found = storeParties.find(
        (p: any) => norm(p.id) === searchTarget || norm(p.code) === searchTarget || norm(p.name) === searchTarget
      )
      if (found) {
        return applyRefreshedSession(NextResponse.json({ data: found }, { headers }), auth)
      }
      return fail('Party record not found in system.', 404)
    }

    const resolvedId = partyRecord.id
    const resolvedName = partyRecord.legal_name || ''
    const isSupplier = (partyRecord.party_type || '').toLowerCase() === 'supplier'

    // 2. Fetch scoped transactions in parallel directly from Supabase
    const [accountsRes, salesRes, purchasesRes] = await Promise.all([
      client
        .from('chart_of_accounts')
        .select('id,code,name,opening_balance,account_group,voucher_lines(id,debit,credit,narration,vouchers(voucher_date,voucher_number,voucher_type,status))')
        .eq('organization_id', orgId)
        .or(`party_id.eq.${resolvedId},name.ilike.${resolvedName}`)
        .maybeSingle(),
      client
        .from('sales_invoices')
        .select('id,invoice_number,invoice_date,status,grand_total,sales_invoice_lines(id,quantity,free_quantity,rate,line_total,items(id,name,code,packing,sale_rate,mrp,manufacturers(name,code)),item_batches(batch_number,expiry_on,rack_number))')
        .eq('organization_id', orgId)
        .eq('party_id', resolvedId)
        .neq('status', 'cancelled')
        .order('invoice_date', { ascending: false })
        .limit(150),
      client
        .from('purchase_invoices')
        .select('id,invoice_number,supplier_invoice_number,invoice_date,status,grand_total,purchase_invoice_lines(id,quantity,free_quantity,rate,line_total,items(id,name,code,packing,purchase_rate,mrp,manufacturers(name,code)),item_batches(batch_number,expiry_on,rack_number))')
        .eq('organization_id', orgId)
        .eq('party_id', resolvedId)
        .neq('status', 'cancelled')
        .order('invoice_date', { ascending: false })
        .limit(150),
    ])

    const account = accountsRes.data
    const sales = salesRes.data || []
    const purchases = purchasesRes.data || []

    // 3. Format address and licenses
    const addr = partyRecord.party_addresses?.find((a: any) => a.is_default) ?? partyRecord.party_addresses?.[0]
    const details = Array.isArray(partyRecord.party_details) ? partyRecord.party_details[0] : partyRecord.party_details
    const licenses = partyRecord.drug_licenses || []
    const dl = licenses.find((l: any) => ['drug_license', 'drug', 'dl', 'retail_wholesale'].includes(String(l.license_type || '').toLowerCase()))
    const food = licenses.find((l: any) => ['food_license', 'food', 'fssai'].includes(String(l.license_type || '').toLowerCase()))

    const cleanGstin = String(partyRecord.gstin || '').trim().toUpperCase()
    const derivedPan = cleanGstin.length >= 12 ? cleanGstin.slice(2, 12) : ''
    const rawState = addr?.state_code || ''
    const formattedState = rawState ? (rawState.includes('-') ? rawState : `18-${rawState}`) : '18-ASSAM'

    // 4. Calculate opening balance
    const coaOp = Number(account?.opening_balance || 0)
    const partyOp = Number(partyRecord.opening_balance ?? (partyRecord.balance && !account ? partyRecord.balance : 0))
    const partyOpType = (partyRecord.opening_type ?? (partyOp < 0 ? 'Cr' : 'Dr')) as 'Dr' | 'Cr'

    let opBal = 0
    let opType: 'Dr' | 'Cr' = 'Dr'
    if (coaOp !== 0) {
      opBal = Math.abs(coaOp)
      opType = coaOp < 0 ? 'Cr' : 'Dr'
    } else if (partyOp !== 0) {
      opBal = Math.abs(partyOp)
      opType = partyOpType === 'Cr' ? 'Cr' : 'Dr'
    }

    // 5. Build Unified Transactions List
    const txnsMap = new Map<string, any>()

    // Vouchers from account lines
    for (const line of (account?.voucher_lines ?? [])) {
      const v = line.vouchers
      if (!v) continue
      const refNo = v.voucher_number || line.id
      const key = `vch_${refNo}`
      const deb = Number(line.debit || 0)
      const cred = Number(line.credit || 0)
      txnsMap.set(key, {
        id: line.id,
        ref: refNo,
        date: v.voucher_date,
        type: String(v.voucher_type || '').toLowerCase().includes('receipt') ? 'Receipt' : 'Payment',
        rawType: 'voucher',
        debit: deb,
        credit: cred,
        status: v.status || 'posted',
        narration: line.narration || `Voucher #${refNo}`,
        lines: [],
      })
    }

    // Sales invoices
    for (const s of sales) {
      const refNo = s.invoice_number || s.id
      const key = `sale_${refNo}`
      const tot = Number(s.grand_total || 0)
      txnsMap.set(key, {
        id: s.id,
        ref: refNo,
        date: s.invoice_date,
        type: 'Sale Invoice',
        rawType: 'sale',
        debit: tot,
        credit: 0,
        status: s.status || 'posted',
        narration: `Sales Invoice #${refNo}`,
        lines: (s.sales_invoice_lines ?? []).map((l: any) => ({
          name: l.items?.name || 'Item',
          code: l.items?.code || '',
          company: l.items?.manufacturers?.name || '',
          batch: l.item_batches?.batch_number || 'DEFAULT',
          expiry: l.item_batches?.expiry_on || '—',
          qty: Number(l.quantity || 0),
          rate: Number(l.rate || 0),
          amount: Number(l.line_total || 0),
        })),
      })
    }

    // Purchase invoices
    for (const p of purchases) {
      const refNo = p.supplier_invoice_number || p.invoice_number || p.id
      const key = `pur_${refNo}`
      const tot = Number(p.grand_total || 0)
      txnsMap.set(key, {
        id: p.id,
        ref: refNo,
        date: p.invoice_date,
        type: 'Purchase Bill',
        rawType: 'purchase',
        debit: 0,
        credit: tot,
        status: p.status || 'received',
        narration: `Purchase Bill #${refNo}`,
        lines: (p.purchase_invoice_lines ?? []).map((l: any) => ({
          name: l.items?.name || 'Item',
          code: l.items?.code || '',
          company: l.items?.manufacturers?.name || '',
          batch: l.item_batches?.batch_number || 'DEFAULT',
          expiry: l.item_batches?.expiry_on || '—',
          qty: Number(l.quantity || 0),
          rate: Number(l.rate || 0),
          amount: Number(l.line_total || 0),
        })),
      })
    }

    // Sort chronologically ascending to compute accurate running balance
    const sortedTxns = Array.from(txnsMap.values()).sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    )

    let runningBal = isSupplier
      ? (opType === 'Cr' ? -opBal : opBal)
      : (opType === 'Dr' ? opBal : -opBal)

    let totalDebitSum = 0
    let totalCreditSum = 0

    const formattedTxns = sortedTxns.map((t) => {
      const deb = Number(t.debit || 0)
      const cred = Number(t.credit || 0)
      totalDebitSum += deb
      totalCreditSum += cred

      runningBal += deb - cred
      const balAbs = Math.abs(runningBal)
      const balType = runningBal >= 0 ? 'Dr' : 'Cr'

      return {
        ...t,
        debit: deb,
        credit: cred,
        balance: balAbs,
        balType: balType,
      }
    })

    // Final outstanding
    let netBal = 0
    if (isSupplier) {
      const initialPayable = opType === 'Cr' ? opBal : -opBal
      netBal = initialPayable + (totalCreditSum - totalDebitSum)
    } else {
      const initialReceivable = opType === 'Dr' ? opBal : -opBal
      netBal = initialReceivable + (totalDebitSum - totalCreditSum)
    }

    const finalOutstanding = Math.abs(netBal)
    const finalBalType = isSupplier
      ? (netBal >= 0 ? 'Cr' : 'Dr')
      : (netBal >= 0 ? 'Dr' : 'Cr')

    // 6. Compute 6-Month Volume Trend
    const monthlyTotals = new Map<string, { month: string; value: number; count: number }>()
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = d.toLocaleString('en-US', { month: 'short' })
      monthlyTotals.set(monthKey, { month: monthKey, value: 0, count: 0 })
    }

    for (const t of formattedTxns) {
      if (!t.date) continue
      const tDate = new Date(t.date)
      if (isNaN(tDate.getTime())) continue
      const monthKey = tDate.toLocaleString('en-US', { month: 'short' })
      const val = Math.max(t.debit, t.credit)
      if (monthlyTotals.has(monthKey)) {
        const curr = monthlyTotals.get(monthKey)!
        curr.value += val
        curr.count += 1
      }
    }

    // 7. Aggregate Top Transacted Items
    const itemsMap = new Map<string, any>()
    for (const t of formattedTxns) {
      for (const line of (t.lines || [])) {
        const name = line.name
        if (!name) continue
        const key = `${name.toLowerCase()}_${line.batch || ''}`
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            name,
            company: line.company || resolvedName,
            batch: line.batch || '—',
            expiry: line.expiry || '—',
            qty: Number(line.qty || 0),
            rate: Number(line.rate || 0),
            amount: Number(line.amount || 0),
            lastDate: t.date,
            ref: t.ref,
          })
        } else {
          const itm = itemsMap.get(key)
          itm.qty += Number(line.qty || 0)
          itm.amount += Number(line.amount || 0)
        }
      }
    }

    const aggregatedItems = Array.from(itemsMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 50)
    const creditLimitNum = Number(partyRecord.credit_limit || 0)
    const totalVolume = totalDebitSum + totalCreditSum

    const partySummary = {
      id: partyRecord.id,
      code: partyRecord.code || '',
      name: resolvedName,
      legal_name: resolvedName,
      type: partyRecord.party_type || (isSupplier ? 'supplier' : 'customer'),
      station: details?.station ?? addr?.city ?? addr?.line1 ?? '',
      accountGroup: account?.account_group || (isSupplier ? 'Sundry Creditors' : 'Sundry Debtors'),
      balancingMethod: details?.balancing_method ?? 'On Account',
      phone: partyRecord.phone || details?.mobile || '—',
      mobile: details?.mobile || partyRecord.phone || '',
      city: addr?.city || '—',
      state: formattedState,
      address: addr?.line1 || '',
      addressLine2: addr?.line2 || '',
      pincode: addr?.postal_code || '',
      country: addr?.country || details?.country || '',
      contactPerson: details?.contact_person || '',
      designation: details?.designation || '',
      freezeUpto: details?.freeze_upto || '',
      narcoSchH: details?.narco_schedule_h ? 'Yes' : 'No',
      dlNo: dl?.license_number || '',
      dlExp: dl?.expires_on ? String(dl.expires_on).slice(0, 10) : '',
      foodLicenceNo: food?.license_number || '',
      foodLicenceExp: food?.expires_on ? String(food.expires_on).slice(0, 10) : '',
      gstHeading: details?.gst_heading || '',
      gstin: cleanGstin,
      gstinDate: details?.gst_registration_date || '',
      pan: details?.pan || derivedPan,
      creditLimit: creditLimitNum,
      creditDays: Number(details?.credit_days ?? 30),
      outstanding: finalOutstanding,
      balType: finalBalType,
      openingBalance: opBal,
      openingType: opType,
      totalDebit: totalDebitSum,
      totalCredit: totalCreditSum,
      billsCount: formattedTxns.length,
      totalVolume,
      avgSaleDays: 14,
      avgCollectionDays: 21,
      turnoverRatio: `${(totalVolume / Math.max(creditLimitNum, 10000)).toFixed(1)}x`,
      trendData: Array.from(monthlyTotals.values()),
      recentTxns: [...formattedTxns].reverse(), // Newest first
      topItems: aggregatedItems,
    }

    return applyRefreshedSession(NextResponse.json({ data: partySummary }, { headers }), auth)
  } catch (error) {
    console.error('Error fetching party detail:', error)
    return fail('Could not load party details.', 500)
  }
}
