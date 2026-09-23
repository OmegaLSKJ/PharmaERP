import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { adminClient, applyRefreshedSession, hasRealSupabase, verifyRequest } from '../../../../apps/web/lib/auth'
import { canAccess, userRole } from '../../../../apps/web/lib/permissions'
import { list } from '../../../../apps/web/lib/erp-store'
import { lookupCatalogManufacturer } from '../../../lib/catalogManufacturers'

const numberOrUndefined = (value: unknown) => value === null || value === undefined ? undefined : Number(value)
const isUuid = (value: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  const fail = (message: string, status: number) => NextResponse.json({ error: { message } }, { status, headers })
  const requestedItemId = request.nextUrl.searchParams.get('itemId'), itemId = isUuid(requestedItemId) ? requestedItemId : null
  const itemName = request.nextUrl.searchParams.get('itemName')
  const requestedBatchId = request.nextUrl.searchParams.get('batchId'), batchId = isUuid(requestedBatchId) ? requestedBatchId : null
  const batchNumber = request.nextUrl.searchParams.get('batchNumber')
  if (!itemId && !itemName) return fail('An item is required.', 400)
  if (!hasRealSupabase()) return fail('The live Supabase connection is not configured for this environment.', 503)
  try {
    const auth = await verifyRequest(request)
    if (!auth) return fail('Please sign in to view product details.', 401)
    if (!canAccess(userRole(auth.user.app_metadata?.role), 'GET', 'items')) return fail('You do not have permission to read products.', 403)
    const client = adminClient(), name = process.env.ERP_ORGANIZATION_NAME ?? 'Borgang Drug Distributors'
    const { data: organization, error: organizationError } = await client.from('organizations').select('id').eq('name', name).maybeSingle()
    if (organizationError || !organization) return fail('The configured organization could not be found.', 503)
    const assigned = auth.user.app_metadata?.organization_id
    if (assigned && assigned !== organization.id) return fail('This session belongs to another organization.', 403)
    let item: any
    if (itemId) {
      const { data, error } = await client.from('items').select('id,name,code,packing,mrp,sale_rate,purchase_rate,manufacturers(name),hsn_codes(code,gst_rate),salts(name,composition)').eq('id', itemId).eq('organization_id', organization.id).maybeSingle()
      if (error) throw error
      item = data
    } else if (itemName) {
      const cleanName = itemName.trim()
      const { data, error } = await client.from('items').select('id,name,code,packing,mrp,sale_rate,purchase_rate,manufacturers(name),hsn_codes(code,gst_rate),salts(name,composition)').eq('name', cleanName).eq('organization_id', organization.id).limit(2)
      if (error) throw error
      if (data && data.length > 0) {
        item = data[0]
      }
    }
    if (!item) {
      const storeItems = (await list('items')) as any[]
      const found = storeItems.find((i: any) =>
        (requestedItemId && (String(i.id) === requestedItemId || String(i.code) === requestedItemId)) ||
        (itemName && i.name && i.name.trim().toLowerCase() === itemName.trim().toLowerCase())
      )
      if (!found) return fail('Product not found.', 404)
      const batch = (found.batches && found.batches.length > 0)
        ? (batchId ? found.batches.find((b: any) => String(b.id) === batchId) : batchNumber ? found.batches.find((b: any) => String(b.batch).trim().toLowerCase() === batchNumber.trim().toLowerCase()) : found.batches[0])
        : null
      const detail = {
        id: found.id,
        code: found.code ?? undefined,
        category: found.category ?? undefined,
        batchId: batch?.id,
        name: found.name,
        packing: found.packing ?? undefined,
        manufacturer: found.manufacturer ?? undefined,
        salt: found.salt ?? undefined,
        hsn: found.hsn ?? undefined,
        gstRate: numberOrUndefined(found.gstRate),
        batch: batch?.batch ?? undefined,
        expiry: batch?.expiry ?? undefined,
        stock: typeof batch?.stock === 'number' ? batch.stock : typeof found.stock === 'number' ? found.stock : 0,
        location: batch?.location ?? batch?.rackNumber ?? batch?.rack_number ?? undefined,
        mrp: numberOrUndefined(batch?.mrp ?? found.mrp),
        saleRate: numberOrUndefined(batch?.saleRate ?? batch?.salePrice ?? batch?.sale_price ?? found.saleRate),
        purchaseRate: numberOrUndefined(batch?.purchaseRate ?? batch?.purchasePrice ?? batch?.purchase_price ?? found.purchaseRate),
        costPrice: numberOrUndefined(batch?.costPrice ?? batch?.cost_price ?? found.costPrice),
        purchaseSchemeDeal: numberOrUndefined(batch?.purchaseSchemeDeal ?? found.purchaseSchemeDeal),
        purchaseSchemeFree: numberOrUndefined(batch?.purchaseSchemeFree ?? found.purchaseSchemeFree),
        salesSchemeDeal: numberOrUndefined(batch?.salesSchemeDeal ?? found.salesSchemeDeal),
        salesSchemeFree: numberOrUndefined(batch?.salesSchemeFree ?? found.salesSchemeFree),
        refNo: batch?.refNo ?? batch?.invoiceNumber ?? batch?.supplier_invoice_number ?? undefined,
        date: batch?.date ?? batch?.invoiceDate ?? batch?.supplier_invoice_date ?? batch?.receivedOn ?? undefined,
        supplier: batch?.supplier ?? undefined,
      }
      return applyRefreshedSession(NextResponse.json({ data: detail }, { headers }), auth)
    }
    let batchQuery = client.from('item_batches').select('id,batch_number,expiry_on,mrp,cost_price,purchase_price,sale_price,sales_scheme_deal,sales_scheme_free,purchase_scheme_deal,purchase_scheme_free,supplier_invoice_number,supplier_invoice_date,rack_number,parties(legal_name),stock_movements(quantity)').eq('item_id', item.id)
    if (batchId) batchQuery = batchQuery.eq('id', batchId)
    else if (batchNumber) batchQuery = batchQuery.eq('batch_number', batchNumber.trim())
    const { data: batches, error: batchError } = await batchQuery.order('received_on', { ascending: false }).limit(1)
    if (batchError) throw batchError
    let batch = batches?.[0]
    if (!batch && !batchId && !batchNumber) {
      // Fallback to latest batch for this item
      const { data: latestBatches } = await client.from('item_batches').select('id,batch_number,expiry_on,mrp,cost_price,purchase_price,sale_price,sales_scheme_deal,sales_scheme_free,purchase_scheme_deal,purchase_scheme_free,supplier_invoice_number,supplier_invoice_date,rack_number,parties(legal_name),stock_movements(quantity)').eq('item_id', item.id).order('received_on', { ascending: false }).limit(1)
      batch = latestBatches?.[0]
    }

    let liveStock = batch ? (batch.stock_movements ?? []).reduce((sum: number, movement: { quantity: unknown }) => sum + Number(movement.quantity ?? 0), 0) : undefined
    if (liveStock === undefined) {
      // If batch has no direct stock movements or batch wasn't found, compute total item stock from all stock movements
      const { data: allMovements } = await client
        .from('stock_movements')
        .select('quantity,item_batches!inner(item_id)')
        .eq('item_batches.item_id', item.id)
      liveStock = (allMovements ?? []).reduce((sum: number, m: any) => sum + Number(m.quantity ?? 0), 0)
    }

    const detail = {
      id: item.id,
      code: item.code ?? undefined,
      batchId: batch?.id,
      name: item.name,
      packing: item.packing ?? undefined,
      manufacturer: item.manufacturers?.name ?? lookupCatalogManufacturer(item.name, item.code) ?? undefined,
      salt: item.salts?.name ?? item.salts?.composition ?? undefined,
      hsn: item.hsn_codes?.code ?? undefined,
      gstRate: numberOrUndefined(item.hsn_codes?.gst_rate),
      batch: batch?.batch_number ?? undefined,
      expiry: batch?.expiry_on ?? undefined,
      stock: typeof liveStock === 'number' ? liveStock : 0,
      location: batch?.rack_number ?? undefined,
      mrp: numberOrUndefined(batch?.mrp ?? item.mrp),
      saleRate: numberOrUndefined(batch?.sale_price ?? item.sale_rate),
      purchaseRate: numberOrUndefined(batch?.purchase_price ?? item.purchase_rate),
      costPrice: numberOrUndefined(batch?.cost_price ?? item.purchase_rate),
      purchaseSchemeDeal: numberOrUndefined(batch?.purchase_scheme_deal),
      purchaseSchemeFree: numberOrUndefined(batch?.purchase_scheme_free),
      salesSchemeDeal: numberOrUndefined(batch?.sales_scheme_deal),
      salesSchemeFree: numberOrUndefined(batch?.sales_scheme_free),
      refNo: batch?.supplier_invoice_number ?? undefined,
      date: batch?.supplier_invoice_date ?? undefined,
      supplier: (batch?.parties as any)?.legal_name ?? undefined,
    }
    return applyRefreshedSession(NextResponse.json({ data: detail }, { headers }), auth)
  } catch { return fail('Live product details could not be loaded. Please refresh or check the Supabase connection.', 503) }
}
