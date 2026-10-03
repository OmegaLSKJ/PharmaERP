import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Save, Printer, Trash2, X, Minus, Pill, ShoppingBag, ArrowLeft, Edit2, ExternalLink, Info, Sparkles } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import TaxInvoicePrint, { TaxInvoicePrintData } from '../../components/transactions/TaxInvoicePrint'
import PrintButton from '../../components/common/PrintButton'
import Typeahead, { TOption } from '../../components/ui/Typeahead'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { getCached } from '../../lib/erpCache'
import { useUIStore } from '../../store/uiStore'
import { calculateInvoice } from '../../lib/invoiceCalculations'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'
import { getGstRateForHsn } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'
import InvoiceOcrModal from '../../components/ocr/InvoiceOcrModal'
import { ExtractedInvoice } from '../../lib/ocr/types'
import BelowCostAlertModal from '../../components/transactions/BelowCostAlertModal'

interface LineItem {
  id: string
  name: string
  batch: string
  stock: number
  qty: number
  free: number
  rate: number
  disc: number
  gst: number
  amount: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
  itemId?: string
  batchId?: string
  code?: string
  category?: string
  costPrice?: number
  belowCostReason?: string
}
type CustomerOption = { label: string; value: string; sub?: string; right?: string }
type ItemOption = {
  id?: string
  itemId?: string
  code?: string
  category?: string
  costPrice?: number
  label: string
  batch: string
  stock: number
  rate: number
  gst: number
  mrp?: number
  purchaseRate?: number
  packing?: string
  manufacturer?: string
  salt?: string
  hsn?: string
  expiry?: string
}

function buildCustomerOptionsFromParties(parties: any[]): CustomerOption[] {
  let localSaved: any[] = []
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pharma_erp_custom_parties') : null
    if (raw) localSaved = JSON.parse(raw)
  } catch { }
  const safeParties = Array.isArray(parties) ? parties : []
  const partyMap = new Map<string, any>()
  for (const p of [...safeParties, ...(Array.isArray(localSaved) ? localSaved : [])]) {
    if (!p) continue
    const key = (p.name || '').trim().toLowerCase()
    if (key && !partyMap.has(key)) partyMap.set(key, p)
  }
  const allParties = Array.from(partyMap.values())
  const sortedParties = [...allParties].sort((a, b) => {
    const aIsCustomer = a.type === 'customer' || a.type === 'both' ? 1 : 0
    const bIsCustomer = b.type === 'customer' || b.type === 'both' ? 1 : 0
    if (aIsCustomer !== bIsCustomer) return bIsCustomer - aIsCustomer
    return (a.name || '').localeCompare(b.name || '')
  })
  return sortedParties
    .filter((p) => p && p.name && p.name.trim())
    .map((p) => {
      const cleanName = String(p.name || '').replace(/\s+/g, ' ').trim()
      const partyTypeLabel = (p.type || p.party_type || 'PARTY').toUpperCase()
      const locationPart = p.city || p.station || ''
      return {
        label: cleanName,
        value: cleanName,
        sub: locationPart ? `${locationPart} • ${partyTypeLabel}` : partyTypeLabel,
        right: p.phone || p.mobile || undefined,
      }
    })
}

function buildItemOptionsFromProducts(products: any[]): ItemOption[] {
  const safeProducts = Array.isArray(products) ? products : []
  return safeProducts.flatMap((p) =>
    (Array.isArray(p?.batches) ? p.batches : []).filter((b: any) => b && b.stock > 0).map((b: any) => {
      const batchMrp = Number(b.mrp || p.mrp || 0)
      const batchSaleRate = Number(b.salePrice ?? b.saleRate ?? b.rate ?? p.saleRate ?? 0)
      const autoRate = batchSaleRate > 0 ? batchSaleRate : batchMrp

      return {
        id: p.id,
        itemId: p.id,
        code: p.code,
        category: p.category,
        costPrice: Number(b.costPrice ?? b.cost_price ?? p.costPrice ?? p.purchaseRate ?? 0),
        label: p.name,
        batch: b.batch,
        stock: b.stock,
        rate: autoRate,
        gst: p.gstRate !== undefined && p.gstRate !== null && Number(p.gstRate) > 0 ? Number(p.gstRate) : getGstRateForHsn(p.hsn),
        mrp: batchMrp,
        purchaseRate: Number(b.purchasePrice ?? b.purchaseRate ?? p.purchaseRate ?? 0),
        packing: p.packing || '',
        manufacturer: p.manufacturer || p.company || '',
        salt: p.salt || p.composition || '',
        hsn: p.hsn || '',
        expiry: b.expiry || '',
      }
    })
  )
}

function findInvoiceInCachedSales(editInvoiceId?: string): any {
  if (!editInvoiceId) return null
  const salesList = getCached<any[]>('sales')
  if (!Array.isArray(salesList)) return null
  const decodedId = decodeURIComponent(editInvoiceId).trim().toLowerCase()
  return salesList.find((s) => {
    if (!s) return false
    const sid = String(s.id || '').trim().toLowerCase()
    const sinv = String(s.invoiceNo || s.number || '').trim().toLowerCase()
    const sdb = String(s.dbId || '').trim().toLowerCase()
    return sid === decodedId || sinv === decodedId || sdb === decodedId
  }) || null
}

function mapInvoiceLines(lines: any[], products: any[]): LineItem[] {
  if (!Array.isArray(lines) || lines.length === 0) return []
  const safeProducts = Array.isArray(products) ? products : []
  return lines.map((l: any, idx: number) => {
    if (!l) return null
    const q = Number(l.qty ?? l.quantity ?? 0)
    const d = Number(l.disc || l.discount || l.discount_percent || 0)
    const g = Number(l.gst || l.gstRate || l.gst_rate || 0)

    const cleanItemName = String(l.name || l.itemName || l.product || '').trim().toLowerCase()
    const matchedProd = safeProducts.find((p: any) =>
      p && ((l.code && p.code === l.code) ||
        (p.name && p.name.trim().toLowerCase() === cleanItemName))
    )
    const matchedBatch = (Array.isArray(matchedProd?.batches) ? matchedProd.batches : []).find((b: any) =>
      b && String(b.batch).trim().toLowerCase() === String(l.batch || l.batch_number || '').trim().toLowerCase()
    )
    const liveStock = typeof matchedBatch?.stock === 'number'
      ? matchedBatch.stock
      : (typeof l.stock === 'number' ? l.stock : (typeof matchedProd?.stock === 'number' ? matchedProd.stock : 0))
    const liveMrp = Number(l.mrp || matchedBatch?.mrp || matchedProd?.mrp || 0)
    const liveSaleRate = Number(l.saleRate || matchedBatch?.salePrice || matchedBatch?.saleRate || matchedBatch?.rate || matchedProd?.saleRate || 0)
    const livePurchaseRate = Number(l.purchaseRate || matchedBatch?.purchasePrice || matchedBatch?.purchaseRate || matchedProd?.purchaseRate || 0)
    const liveCostPrice = Number(l.costPrice || matchedBatch?.costPrice || matchedProd?.costPrice || livePurchaseRate)
    const rawRate = Number(l.rate || 0)
    const r = rawRate > 0 ? rawRate : (liveSaleRate > 0 ? liveSaleRate : liveMrp)
    const amt = calculateInvoice([{ qty: q, rate: r, discount: d, gstRate: g }]).lines[0]?.total ?? (q * r)

    return {
      id: String(l.id || `line-${Date.now()}-${idx}`),
      itemId: l.itemId || matchedProd?.id,
      code: l.code || matchedProd?.code || '',
      name: String(l.name || l.itemName || l.product || 'Item'),
      batch: String(l.batch || l.batch_number || 'DEFAULT'),
      batchId: l.batchId || matchedBatch?.id,
      stock: liveStock,
      qty: q,
      free: Number(l.free || l.freeQty || l.free_quantity || 0),
      rate: r,
      disc: d,
      gst: g || (matchedProd?.gstRate ? Number(matchedProd.gstRate) : 0),
      amount: amt,
      mrp: liveMrp,
      purchaseRate: livePurchaseRate,
      costPrice: liveCostPrice,
      packing: l.packing || matchedProd?.packing || '',
      manufacturer: l.manufacturer || matchedProd?.manufacturer || matchedProd?.company || '',
      salt: l.salt || matchedProd?.salt || matchedProd?.composition || '',
      hsn: l.hsn || matchedProd?.hsn || '',
      expiry: l.expiry || matchedBatch?.expiry || '',
    }
  }).filter(Boolean) as LineItem[]
}

export default function SaleEntry() {
  const { id: editInvoiceId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const initialInvoice = findInvoiceInCachedSales(editInvoiceId)
  const [existingInvoice, setExistingInvoice] = useState<any>(() => initialInvoice)
  const isEditMode = Boolean(editInvoiceId)

  useEffect(() => {
    const invTitle = isEditMode
      ? `Edit Invoice ${existingInvoice?.invoiceNo || editInvoiceId || ''} · Borgang ERP`
      : 'New Sale Invoice · Borgang ERP'
    document.title = invTitle
  }, [isEditMode, existingInvoice, editInvoiceId])

  const [partiesList, setPartiesList] = useState<any[]>(() => {
    const cached = getCached<any[]>('parties')
    return Array.isArray(cached) ? cached : []
  })
  const [productsList, setProductsList] = useState<any[]>(() => {
    const cached = getCached<any[]>('items')
    return Array.isArray(cached) ? cached : []
  })
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>(() => {
    const cached = getCached<any[]>('parties')
    return Array.isArray(cached) ? buildCustomerOptionsFromParties(cached) : []
  })
  const [itemOptions, setItemOptions] = useState<ItemOption[]>(() => {
    const cached = getCached<any[]>('items')
    return Array.isArray(cached) ? buildItemOptionsFromProducts(cached) : []
  })
  const [items, setItems] = useState<LineItem[]>(() => {
    if (initialInvoice && Array.isArray(initialInvoice.lines) && initialInvoice.lines.length > 0) {
      const cachedProducts = getCached<any[]>('items') || []
      return mapInvoiceLines(initialInvoice.lines, cachedProducts)
    }
    return []
  })
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [customer, setCustomer] = useState(() => {
    if (initialInvoice) {
      return String(initialInvoice.party || initialInvoice.customer || '').replace(/\s+/g, ' ').trim()
    }
    return ''
  })
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [patientName, setPatientName] = useState(() => initialInvoice?.patientName || '')
  const [prescriberName, setPrescriberName] = useState(() => initialInvoice?.prescriberName || '')
  const [prescriptionReference, setPrescriptionReference] = useState(() => initialInvoice?.prescriptionReference || '')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const handleApplyOcrData = useCallback((ocrData: ExtractedInvoice) => {
    if (ocrData.supplierName && !customer) {
      const match = customerOptions.find(
        (c) =>
          c.label.toLowerCase().includes(ocrData.supplierName.toLowerCase()) ||
          ocrData.supplierName.toLowerCase().includes(c.label.toLowerCase())
      )
      if (match) setCustomer(match.label)
    }

    if (ocrData.items && ocrData.items.length > 0) {
      const validItems: LineItem[] = []
      let skippedCount = 0

      ocrData.items.forEach((it, idx) => {
        // Strictly map only if present in All Items list (itemOptions)
        const matchedItem =
          (it.mappedItemId && itemOptions.find((opt) => opt.id === it.mappedItemId || opt.itemId === it.mappedItemId)) ||
          itemOptions.find(
            (opt) =>
              opt.label.toLowerCase().trim() === it.itemName.toLowerCase().trim() ||
              (opt as any).name?.toLowerCase().trim() === it.itemName.toLowerCase().trim()
          )

        if (!matchedItem) {
          skippedCount++
          return
        }

        const qty = it.qty > 0 ? it.qty : 1
        const rate = it.saleRate > 0 ? it.saleRate : (matchedItem.rate || Math.round(it.purchaseRate * 1.25 * 100) / 100)
        const gst = it.gstRate || matchedItem.gst || 12
        const amount = Math.round(qty * rate * 100) / 100

        validItems.push({
          id: `ocr-sale-${Date.now()}-${idx}`,
          name: matchedItem.label || (matchedItem as any).name || it.itemName,
          batch: it.batch || matchedItem.batch || 'BAT-01',
          stock: matchedItem.stock ?? 100,
          qty,
          free: it.freeQty || 0,
          rate,
          disc: it.discount || 0,
          gst,
          amount,
          mrp: it.mrp || matchedItem.mrp || Math.round(rate * 1.15 * 100) / 100,
          purchaseRate: it.purchaseRate || matchedItem.purchaseRate || Math.round(rate * 0.8 * 100) / 100,
          packing: it.packing || matchedItem.packing || '10x10',
          manufacturer: matchedItem.manufacturer,
          salt: matchedItem.salt,
          hsn: it.hsn || matchedItem.hsn || '30049099',
          expiry: it.expiry || matchedItem.expiry || '12/28',
          itemId: matchedItem.id || matchedItem.itemId,
          category: matchedItem.category
        })
      })

      if (validItems.length > 0) {
        setItems((prev) => [...prev, ...validItems])
      }

      if (skippedCount > 0 && validItems.length > 0) {
        showToast(
          `Added ${validItems.length} items. Skipped ${skippedCount} item(s) not found in All Items list (Sales strictly requires existing items).`
        )
      } else if (validItems.length > 0) {
        showToast(`Added ${validItems.length} confirmed medicine items from OCR scan`)
      } else {
        showToast(`No items added. Sales strictly requires items to be present in the All Items list.`)
      }
    }
  }, [customer, customerOptions, itemOptions, showToast])
  const recordedGrandTotal = Math.max(
    0,
    Number(
      existingInvoice?.total ??
      existingInvoice?.grandTotal ??
      existingInvoice?.grand_total ??
      existingInvoice?.net_amount ??
      existingInvoice?.amount ??
      0
    )
  )
  const rawSubtotal = Number(
    existingInvoice?.subtotal ??
    existingInvoice?.total ??
    existingInvoice?.grandTotal ??
    existingInvoice?.grand_total ??
    0
  )
  const recordedSubtotal = rawSubtotal > 0 ? rawSubtotal : recordedGrandTotal
  const recordedDiscount = Number(
    existingInvoice?.discountTotal ??
    existingInvoice?.discount_total ??
    existingInvoice?.discount ??
    0
  )
  const recordedTax = Number(
    existingInvoice?.taxTotal ??
    existingInvoice?.tax_total ??
    existingInvoice?.tax ??
    0
  )
  const recordedRounding = Number(
    existingInvoice?.roundingAdjustment ??
    existingInvoice?.rounding_adjustment ??
    existingInvoice?.rounding ??
    0
  )

  const totals = items.length
    ? calculateInvoice(
      items.map((item) => ({
        qty: Math.max(0, item.qty),
        rate: Math.max(0, item.rate),
        discount: item.disc,
        gstRate: item.gst,
      }))
    )
    : {
      subtotal: recordedSubtotal,
      discountTotal: recordedDiscount,
      taxTotal: recordedTax,
      roundingAdjustment: recordedRounding,
      grandTotal: recordedGrandTotal,
      lines: [],
    }

  const loadCatalog = useCallback((force = false) => {
    Promise.all([
      getErp<any[]>('parties', undefined, force ? { forceRefresh: true } : undefined),
      getErp<any[]>('items', undefined, force ? { forceRefresh: true } : undefined)
    ])
      .then(([parties, products]) => {
        let localSaved: any[] = []
        try {
          const raw = localStorage.getItem('pharma_erp_custom_parties')
          if (raw) localSaved = JSON.parse(raw)
        } catch { }
        const safeParties = Array.isArray(parties) ? parties : []
        const safeProducts = Array.isArray(products) ? products : []
        const partyMap = new Map<string, any>()
        for (const p of [...safeParties, ...(Array.isArray(localSaved) ? localSaved : [])]) {
          if (!p) continue
          const key = (p.name || '').trim().toLowerCase()
          if (key && !partyMap.has(key)) partyMap.set(key, p)
        }
        const allParties = Array.from(partyMap.values())
        setPartiesList(allParties)
        setProductsList(safeProducts)
        setItems((currentItems) =>
          (Array.isArray(currentItems) ? currentItems : []).map((cur) => {
            if (!cur) return cur
            const cleanName = String(cur.name || '').trim().toLowerCase()
            const matched = safeProducts.find((p: any) =>
              p && ((cur.code && p.code === cur.code) ||
                (p.name && p.name.trim().toLowerCase() === cleanName))
            )
            const matchedBatch = (Array.isArray(matched?.batches) ? matched.batches : []).find((b: any) =>
              b && String(b.batch).trim().toLowerCase() === String(cur.batch || '').trim().toLowerCase()
            )
            if (!matched && !matchedBatch) return cur
            const batchMrp = Number(matchedBatch?.mrp || matched?.mrp || cur.mrp || 0)
            const batchSaleRate = Number(matchedBatch?.salePrice ?? matchedBatch?.saleRate ?? matchedBatch?.rate ?? matched?.saleRate ?? 0)
            const resolvedRate = cur.rate > 0 ? cur.rate : (batchSaleRate > 0 ? batchSaleRate : batchMrp)
            const q = Number(cur.qty || 0)
            const d = Number(cur.disc || 0)
            const g = cur.gst !== undefined && cur.gst !== null ? Number(cur.gst) : getGstRateForHsn(matched?.hsn || cur.hsn)
            const resolvedAmount = resolvedRate > 0 && q > 0
              ? (calculateInvoice([{ qty: q, rate: resolvedRate, discount: d, gstRate: g }]).lines[0]?.total ?? (q * resolvedRate))
              : cur.amount

            return {
              ...cur,
              itemId: cur.itemId || matched?.id,
              batchId: cur.batchId || matchedBatch?.id,
              stock: typeof matchedBatch?.stock === 'number' ? matchedBatch.stock : (typeof matched?.stock === 'number' ? matched.stock : cur.stock),
              rate: resolvedRate,
              amount: resolvedAmount,
              mrp: batchMrp,
              purchaseRate: cur.purchaseRate || matchedBatch?.purchasePrice || matchedBatch?.purchaseRate || matched?.purchaseRate || 0,
              costPrice: cur.costPrice || matchedBatch?.costPrice || matched?.costPrice || cur.purchaseRate,
              salt: cur.salt || matched?.salt || matched?.composition || '',
              packing: cur.packing || matched?.packing || '',
              manufacturer: cur.manufacturer || matched?.manufacturer || matched?.company || '',
              hsn: cur.hsn || matched?.hsn || '',
            }
          })
        )
        setCustomerOptions(buildCustomerOptionsFromParties(allParties))
        setItemOptions(buildItemOptionsFromProducts(safeProducts))
      })
      .catch((error) => showToast(error.message))
  }, [showToast])

  useEffect(() => {
    loadCatalog(false)
  }, [loadCatalog])

  // Immediately receive item, party, and batch changes from backend live sync
  useEffect(() => {
    const refreshCatalog = (event?: Event) => {
      const mutation = (event as CustomEvent<{ resource?: string }> | undefined)?.detail
      if (!mutation || mutation.resource === 'items' || mutation.resource === 'item-batches' || mutation.resource === 'parties') {
        loadCatalog(false)
      }
    }
    const refreshOnFocus = () => loadCatalog(false)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshOnFocus()
    }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('erp-resource-mutations') : null

    window.addEventListener('erp-resource-mutated', refreshCatalog)
    window.addEventListener('erp-cache-revalidated', refreshCatalog)
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    if (channel) channel.onmessage = refreshCatalog

    return () => {
      window.removeEventListener('erp-resource-mutated', refreshCatalog)
      window.removeEventListener('erp-cache-revalidated', refreshCatalog)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      channel?.close()
    }
  }, [loadCatalog])

  const getPrintData = (): TaxInvoicePrintData => {
    const custClean = (customer || '').trim().toLowerCase()
    const safeParties = Array.isArray(partiesList) ? partiesList : []
    const safeProducts = Array.isArray(productsList) ? productsList : []
    const safeItems = Array.isArray(items) ? items : []
    const partyInfo = safeParties.find((p) => {
      if (!p) return false
      const pName = (p.name || '').trim().toLowerCase()
      return pName === custClean || (p.id && p.id === customer)
    }) || {}

    const buyerName = customer || partyInfo.name || 'CASH CUSTOMER / WALK-IN'
    const buyerAddress = partyInfo.address || partyInfo.address1 || partyInfo.station || existingInvoice?.partyAddress || 'Local'
    const buyerCity = partyInfo.city || partyInfo.station || existingInvoice?.partyCity || ''
    const buyerState = partyInfo.state || existingInvoice?.partyState || 'Assam'
    const buyerPincode = partyInfo.pincode || partyInfo.pin || existingInvoice?.partyPincode || ''
    const buyerPhone = partyInfo.phone || partyInfo.mobile || existingInvoice?.partyPhone || ''
    const buyerGstin = partyInfo.gstin || existingInvoice?.partyGstin || ''
    const buyerDlNo = partyInfo.dlNumber || partyInfo.dlNo || existingInvoice?.partyDlNo || ''
    const buyerPan = partyInfo.pan || existingInvoice?.partyPan || ''
    const stateCode = partyInfo.stateCode || (buyerState.toLowerCase().includes('assam') ? '18' : '')

    return {
      title: 'TAX INVOICE',
      copyType: 'Original for Recipient',
      invoiceNo:
        existingInvoice?.invoiceNo ||
        existingInvoice?.number ||
        `SI-${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`,
      invoiceDate: existingInvoice?.date || new Date().toISOString().split('T')[0],
      dueDate: existingInvoice?.dueDate || '',
      paymentMode: existingInvoice?.paymentMode || 'Credit',
      orderNo: existingInvoice?.orderNo || '',
      patientName,
      prescriberName,
      prescriptionReference,
      buyer: {
        name: buyerName,
        address: buyerAddress,
        city: buyerCity,
        state: buyerState,
        pincode: buyerPincode,
        phone: buyerPhone,
        gstin: buyerGstin,
        dlNo: buyerDlNo,
        pan: buyerPan,
        stateCode: stateCode,
      },
      items: safeItems.map((i) => {
        const prod = safeProducts.find((p) => p && p.name === i.name)
        const qty = Number(i.qty || 0)
        const rate = Number(i.rate || 0)
        const discount = Number(i.disc || 0)
        const lineTaxable = (qty * rate) - ((qty * rate) * (discount / 100))
        return {
          name: i.name,
          packing: prod?.packing || i.packing || '1x10',
          mfr: prod?.manufacturer || i.manufacturer || '',
          hsn: prod?.hsn || i.hsn || '3004',
          batch: i.batch,
          expiry: (Array.isArray(prod?.batches) ? prod.batches : []).find((b: any) => b && b.batch === i.batch)?.expiry || i.expiry || '',
          qty: i.qty,
          freeQty: i.free || 0,
          mrp: i.mrp || prod?.mrp || (i.rate > 0 ? i.rate * 1.2 : 0),
          rate: i.rate,
          discount: i.disc || 0,
          gstRate: i.gst !== undefined && i.gst !== null ? Number(i.gst) : getGstRateForHsn(i.hsn),
          amount: lineTaxable,
        }
      }),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      roundingAdjustment: totals.roundingAdjustment,
      grandTotal: totals.grandTotal,
    }
  }

  // Load existing invoice if editInvoiceId is provided
  useEffect(() => {
    if (!editInvoiceId) return
    getErp<any[]>('sales')
      .then((allSales) => {
        const salesList = Array.isArray(allSales) ? allSales : []
        const decodedId = decodeURIComponent(editInvoiceId).trim().toLowerCase()
        const found = salesList.find((s) => {
          if (!s) return false
          const sid = String(s.id || '').trim().toLowerCase()
          const sinv = String(s.invoiceNo || s.number || '').trim().toLowerCase()
          const sdb = String(s.dbId || '').trim().toLowerCase()
          return sid === decodedId || sinv === decodedId || sdb === decodedId
        })
        if (found) {
          setExistingInvoice(found)
          setCustomer(String(found.party || found.customer || '').replace(/\s+/g, ' ').trim())
          setPatientName(found.patientName || '')
          setPrescriberName(found.prescriberName || '')
          setPrescriptionReference(found.prescriptionReference || '')
          const safeProducts = (productsList && productsList.length > 0) ? productsList : (getCached<any[]>('items') || [])
          if (Array.isArray(found.lines) && found.lines.length > 0) {
            setItems(mapInvoiceLines(found.lines, safeProducts))
          } else {
            // Invoice has no explicit line items recorded in the database
            setItems([])
          }
        }
      })
      .catch((err) => showToast(err?.message || 'Failed to load invoice.'))
  }, [editInvoiceId, productsList, showToast])

  useEffect(() => {
    if (showItemSearch) {
      setItemSearchQuery('')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [showItemSearch])

  const addRow = (item: ItemOption) => {
    const existingIndex = items.findIndex((i) => i.name === item.label && i.batch === item.batch)
    if (existingIndex >= 0) {
      updateLine(items[existingIndex].id, 'qty', items[existingIndex].qty + 1)
      setActiveIndex(existingIndex)
    } else {
      const autoRate = Number(item.rate > 0 ? item.rate : (item.mrp || 0))
      const autoQty = 1
      const autoDisc = 0
      const autoGst = item.gst
      let autoAmount = autoRate
      try {
        autoAmount = calculateInvoice([{ qty: autoQty, rate: autoRate, discount: autoDisc, gstRate: autoGst }]).lines[0]?.total ?? autoRate
      } catch {
        autoAmount = autoRate
      }

      setItems((prev) => {
        const next = [
          ...prev,
          {
            id: Date.now().toString(),
            itemId: item.itemId || item.id || undefined,
            code: item.code,
            category: item.category,
            costPrice: item.costPrice,
            name: item.label,
            batch: item.batch,
            stock: item.stock,
            qty: autoQty,
            free: 0,
            rate: autoRate,
            disc: autoDisc,
            gst: autoGst,
            amount: autoAmount,
            mrp: item.mrp || autoRate || 0,
            purchaseRate: item.purchaseRate || 0,
            packing: item.packing,
            manufacturer: item.manufacturer,
            salt: item.salt,
            hsn: item.hsn,
            expiry: item.expiry,
          },
        ]
        setActiveIndex(next.length - 1)
        return next
      })
    }
    setShowItemSearch(false)
  }

  const removeRow = (id: string) => {
    setItems((rows) => {
      const next = rows.filter((r) => r.id !== id)
      if (activeIndex >= next.length) {
        setActiveIndex(Math.max(0, next.length - 1))
      }
      return next
    })
  }

  const [belowCostModal, setBelowCostModal] = useState<{
    open: boolean
    lineId: string
    itemName: string
    batch: string
    sellPrice: number
    purchasePrice: number
    currentReason?: string
  } | null>(null)

  const openBelowCostDialog = (item: LineItem) => {
    const cost = Number(item.purchaseRate || item.costPrice || 0)
    setBelowCostModal({
      open: true,
      lineId: item.id,
      itemName: item.name,
      batch: item.batch,
      sellPrice: Number(item.rate || 0),
      purchasePrice: cost,
      currentReason: item.belowCostReason || '',
    })
  }

  const handleRateBlur = (item: LineItem) => {
    const cost = Number(item.purchaseRate || item.costPrice || 0)
    const enteredRate = Number(item.rate || 0)
    if (enteredRate > 0 && cost > 0 && enteredRate < cost && !item.belowCostReason) {
      openBelowCostDialog(item)
    }
  }

  const handleAuthorizeBelowCost = (reason: string) => {
    if (!belowCostModal) return
    setItems((rows) =>
      rows.map((row) => (row.id === belowCostModal.lineId ? { ...row, belowCostReason: reason } : row))
    )
    showToast(`Authorized selling below purchase cost for "${belowCostModal.itemName}" (${reason}).`)
  }

  const handleRevertBelowCost = () => {
    if (!belowCostModal) return
    updateLine(belowCostModal.lineId, 'rate', belowCostModal.purchasePrice)
    showToast(`Reverted "${belowCostModal.itemName}" rate to purchase cost (${formatCurrency(belowCostModal.purchasePrice)}).`)
  }

  const handleKeyDown = (e: React.KeyboardEvent, row: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextField = field === 'qty' ? 'free' : field === 'free' ? 'rate' : field === 'rate' ? 'disc' : null
      if (nextField) document.getElementById(`row-${row}-${nextField}`)?.focus()
      else setShowItemSearch(true)
    }
    if (e.key === 'F2') setShowItemSearch(true)
  }

  const saveInvoice = async () => {
    try {
      if (!customer) {
        showToast('Please select a customer.')
        return
      }
      if (!items.length) {
        showToast('Please add at least one item.')
        return
      }
      const hasValidItems = items.some((i) => (Number(i.qty) || 0) > 0 || (Number(i.free) || 0) > 0)
      if (!hasValidItems) {
        showToast('Please enter quantity for at least one item before saving.')
        return
      }

      // Universal Law 1 Enforcement: sell price should never be lower than purchase price without authorized reason
      const unauthBelowCost = items.find((i) => {
        const cost = Number(i.purchaseRate || i.costPrice || 0)
        const enteredRate = Number(i.rate || 0)
        return enteredRate > 0 && cost > 0 && enteredRate < cost && !i.belowCostReason
      })

      if (unauthBelowCost) {
        openBelowCostDialog(unauthBelowCost)
        showToast(`Sell price for "${unauthBelowCost.name}" is lower than purchase price. Please provide a reason to authorize.`)
        return
      }

      setSaving(true)
      const lines = items.map((item) => ({ ...item, freeQty: item.free, discount: item.disc, gstRate: item.gst }))
      const invoiceIdentifier = existingInvoice?.invoiceNo || existingInvoice?.number || editInvoiceId
      const custClean = (customer || '').trim().toLowerCase()
      const safeParties = Array.isArray(partiesList) ? partiesList : []
      const partyInfo = safeParties.find((p) => p && (p.name || '').trim().toLowerCase() === custClean) || {}

      const partyPayload = {
        party: customer,
        partyAddress: partyInfo.address || partyInfo.address1 || '',
        partyCity: partyInfo.city || '',
        partyState: partyInfo.state || 'Assam',
        partyPincode: partyInfo.pincode || partyInfo.pin || '',
        partyPhone: partyInfo.phone || partyInfo.mobile || '',
        partyGstin: partyInfo.gstin || '',
        partyDlNo: partyInfo.dlNumber || partyInfo.dlNo || '',
        partyPan: partyInfo.pan || '',
      }

      if (isEditMode && invoiceIdentifier) {
        await patchErp('sales', String(existingInvoice?.dbId || existingInvoice?.id || invoiceIdentifier), {
          ...partyPayload,
          date: existingInvoice?.date || new Date().toISOString().split('T')[0],
          lines,
          total: totals.grandTotal,
          grandTotal: totals.grandTotal,
          patientName,
          prescriberName,
          prescriptionReference,
          reason: `Amended invoice ${invoiceIdentifier}`,
        })
        showToast(`Invoice ${invoiceIdentifier} was amended. The original was retained as cancelled for audit history.`)
        loadCatalog(true)   // refresh stock after edit
        navigate('/transactions/sale')
      } else {
        const saved = await postErp<{ id: string }>('sales', {
          ...partyPayload,
          lines,
          total: totals.grandTotal,
          grandTotal: totals.grandTotal,
          patientName,
          prescriberName,
          prescriptionReference,
        })
        showToast(`Invoice ${saved.id} saved and posted to the customer ledger.`)
        setItems([])
        setPatientName('')
        setPrescriberName('')
        setPrescriptionReference('')
        loadCatalog(true)  // refresh stock after save
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save invoice.')
    } finally {
      setSaving(false)
    }
  }

  const updateLine = (id: string, field: 'qty' | 'free' | 'rate' | 'disc', value: number) => {
    setItems((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row
        const val = isNaN(value) ? 0 : value
        let next = { ...row, [field]: val }
        // If rate is 0 or unassigned and MRP is given, auto take MRP as rate
        if (field !== 'rate' && (Number(next.rate) || 0) <= 0 && (Number(next.mrp) || 0) > 0) {
          next.rate = Number(next.mrp)
        }
        // If rate is updated to equal or greater than cost, clear the belowCostReason
        if (field === 'rate') {
          const cost = Number(next.purchaseRate || next.costPrice || 0)
          if (cost > 0 && val >= cost) {
            next.belowCostReason = undefined
          }
        }
        try {
          next.amount = calculateInvoice([
            {
              qty: Math.max(next.qty, 0),
              rate: Math.max(next.rate, 0),
              discount: Math.min(100, Math.max(next.disc, 0)),
              gstRate: next.gst,
            },
          ]).lines[0].total
        } catch {
          next.amount = 0
        }
        return next
      })
    )
  }

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (customer && items.length && !saving) void saveInvoice()
      }
      if (event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setShowPrintModal(true)
      }
      if (event.key === 'F2') {
        event.preventDefault()
        setShowItemSearch(true)
      }
      if (event.key === 'F3' || (event.altKey && event.key.toLowerCase() === 'i')) {
        event.preventDefault()
        setDetailModalOpen((v) => !v)
      }
      if (event.key === 'Escape') {
        setShowItemSearch(false)
        setDetailModalOpen(false)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  })

  const filteredItems = itemOptions.filter(
    (item) =>
      item.label.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      item.batch.toLowerCase().includes(itemSearchQuery.toLowerCase())
  )

  const quickTypeaheadOptions: TOption[] = itemOptions.map((item) => ({
    label: item.label,
    sub: `Batch: ${item.batch} | Stock: ${item.stock}`,
    right: formatCurrency(item.rate),
  }))

  const activeItem = items[activeIndex] || (items.length > 0 ? items[items.length - 1] : null)
  const safeParties = Array.isArray(partiesList) ? partiesList : []
  const currentParty = safeParties.find((p) => p && (p.name || '').trim().toLowerCase() === customer.trim().toLowerCase())
  const customerBalance = currentParty ? Number(currentParty.balance || currentParty.outstanding || 0) : 0
  const totalMrpValue = items.reduce((sum, i) => sum + (Number(i.mrp) || Number(i.rate) || 0) * (Number(i.qty) || 0), 0)

  return (
    <div className="p-2.5 sm:p-4 md:p-6 space-y-4 pb-28 md:pb-12 w-full max-w-7xl mx-auto">
      {/* Screen Form (Hidden when printing) */}
      <div className="no-print space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            {isEditMode && (
              <button
                onClick={() => navigate('/transactions/sale')}
                className="p-2 bg-card border border-border hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Back to Sale Register"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <span>Edit Sale Invoice:</span>
                    <span className="font-mono text-indigo-500 dark:text-indigo-400">{existingInvoice?.invoiceNo || existingInvoice?.number || editInvoiceId}</span>
                  </>
                ) : (
                  'Sale Invoice (Alt+N)'
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEditMode
                  ? 'Update items, quantities, rates, customer, and prescription metadata'
                  : 'Wholesale & retail billing with batch tracking'}
              </p>
              {isEditMode && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 rounded-lg">
                    <span className="text-xs text-emerald-800 dark:text-slate-300 font-medium">Invoice Total:</span>
                    <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                  {customer && (
                    <span className="text-xs text-foreground bg-secondary border border-border px-2.5 py-1 rounded-lg font-medium">
                      Party: <span className="font-semibold">{customer}</span>
                    </span>
                  )}
                  {items.length === 0 && (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Info size={13} />
                      <span>No item lines in DB (Header Total: {formatCurrency(totals.grandTotal)})</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2.5">
            {/* Pop Out to New Window */}
            {/* Scan Prescription or Bill with OCR */}
            <button
              type="button"
              onClick={() => setShowOcrModal(true)}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-lg text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 shadow-xs transition active:scale-[0.98] cursor-pointer"
              title="Scan prescription or bill photo/PDF using local free OCR"
            >
              <Sparkles size={14} className="text-indigo-500" />
              <span>Scan Bill / Rx (OCR)</span>
            </button>

            <button
              type="button"
              onClick={() => openTransactionWindow(window.location.pathname)}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs font-semibold text-foreground bg-card hover:bg-secondary border border-border shadow-xs transition cursor-pointer"
              title="Open another instance in a separate window"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">New Window</span>
            </button>

            {/* Professional Print Bill Button */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="group relative inline-flex items-center justify-center gap-2 h-10 px-3.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold text-foreground bg-card hover:bg-secondary border border-border shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-150 cursor-pointer"
              title="Print Preview & Tax Invoice Bill (Alt+P)"
            >
              <Printer size={15} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="tracking-tight font-semibold">Print Bill</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-muted rounded border border-border group-hover:text-foreground transition-colors">
                Alt+P
              </kbd>
            </button>

            {/* Primary Save / Update Invoice Button */}
            <button
              type="button"
              onClick={saveInvoice}
              disabled={saving || !customer || !items.length}
              className="group relative inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-4.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700 rounded-lg text-xs sm:text-sm text-white font-semibold shadow-md shadow-blue-900/30 hover:shadow-blue-900/50 active:scale-[0.98] border border-blue-500/60 transition-all duration-150 cursor-pointer"
            >
              <Save size={15} className="text-blue-100 group-hover:text-white transition-colors" />
              <span className="tracking-tight">{saving ? 'Saving…' : isEditMode ? 'Update Invoice' : 'Save Invoice'}</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-blue-200 bg-black/20 rounded border border-blue-300/20 group-hover:border-blue-300/40 transition-colors">
                Alt+S
              </kbd>
            </button>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Customer / Party *</label>
            {customer && (
              <Link
                to={`/masters/parties?search=${encodeURIComponent(customer)}`}
                target="_blank"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                <Edit2 size={11} /> Edit Customer Details
              </Link>
            )}
          </div>
          <Typeahead
            options={customerOptions}
            value={customer}
            onChange={setCustomer}
            placeholder="Search customer, supplier, or party..."
            autoFocus
          />
        </div>


        {/* Items Section */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Invoice Items ({items.length})</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowItemSearch(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow-sm border border-blue-500/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={14} /> Add Item (F2)
            </button>
          </div>

          {/* Auto-given Mobile / Quick Item Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary flex items-center gap-1">
              <Plus size={13} /> Quick Add Medicine
            </label>
            <Typeahead
              options={quickTypeaheadOptions}
              value=""
              onSelect={(selectedOption) => {
                const safeItems = Array.isArray(itemOptions) ? itemOptions : []
                const selectedItem = safeItems.find(
                  (it) => it && it.label === selectedOption.label && `Batch: ${it.batch} | Stock: ${it.stock}` === selectedOption.sub
                )
                if (selectedItem) addRow(selectedItem)
              }}
              placeholder="Search medicine or pick from stock..."
            />
          </div>

          {/* Empty State */}
          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-6 text-center space-y-3 bg-muted/20">
              <div className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center mx-auto">
                <Pill size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isEditMode && existingInvoice && (!existingInvoice.lines || existingInvoice.lines.length === 0)
                    ? 'This posted invoice has no item lines recorded in the database'
                    : 'No items added to invoice yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isEditMode && existingInvoice && (!existingInvoice.lines || existingInvoice.lines.length === 0) && totals.grandTotal > 0
                    ? `Recorded bill total is ${formatCurrency(totals.grandTotal)}. Search and add medicine items below if you wish to record detailed line items.`
                    : 'Select from the Quick Add bar above or tap the button below'}
                </p>
              </div>
              {isEditMode && totals.grandTotal > 0 && (
                <div className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-xs">
                  <span>Recorded Bill Total:</span>
                  <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totals.grandTotal)}</span>
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => setShowItemSearch(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Plus size={14} /> Browse All Available Items
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile View: Touch-friendly item cards */}
              <div className="space-y-3 block md:hidden">
                {items.map((item, idx) => {
                  const isActive = idx === activeIndex
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        'bg-card border rounded-xl p-3.5 space-y-3 cursor-pointer transition',
                        isActive
                          ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                          : 'border-border hover:border-border/80'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{item.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.manufacturer && (
                              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded shadow-2xs">
                                {item.manufacturer}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                              Batch: {item.batch}
                            </span>
                            <span className="text-[11px] text-muted-foreground">Stock: {item.stock}</span>
                            {item.hsn && (
                              <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                                HSN: {item.hsn} ({item.gst}% GST)
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeRow(item.id)
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                        {/* Qty */}
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Qty</label>
                          <input
                            type="number"
                            min="0"
                            max={item.stock}
                            value={item.qty}
                            onChange={(e) => updateLine(item.id, 'qty', Number(e.target.value) || 0)}
                            onFocus={(e) => {
                              e.target.select()
                              setActiveIndex(idx)
                            }}
                            className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-right font-mono text-foreground outline-none focus:border-primary"
                            inputMode="numeric"
                          />
                        </div>

                        {/* Free Qty */}
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Free Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={item.free}
                            onChange={(e) => updateLine(item.id, 'free', Number(e.target.value) || 0)}
                            onFocus={(e) => {
                              e.target.select()
                              setActiveIndex(idx)
                            }}
                            className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-right font-mono text-foreground outline-none focus:border-primary"
                            inputMode="numeric"
                          />
                        </div>

                        {/* Rate */}
                        <div>
                          {(() => {
                            const cost = Number(item.purchaseRate || item.costPrice || 0)
                            const isBelowCost = Number(item.rate || 0) > 0 && cost > 0 && Number(item.rate || 0) < cost
                            return (
                              <>
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between mb-1">
                                  <span>Rate (₹)</span>
                                  {cost > 0 && (
                                    <span className="text-[9px] text-muted-foreground font-mono">Cost: {formatCurrency(cost)}</span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.rate === 0 ? '' : item.rate}
                                  placeholder={item.mrp ? item.mrp.toFixed(2) : "0.00"}
                                  onChange={(e) => updateLine(item.id, 'rate', Number(e.target.value) || 0)}
                                  onBlur={() => handleRateBlur(item)}
                                  onFocus={() => setActiveIndex(idx)}
                                  className={cn(
                                    "w-full bg-background border rounded-lg px-2.5 py-2 text-sm text-right font-mono text-foreground outline-none focus:border-primary",
                                    isBelowCost
                                      ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold focus:border-rose-600"
                                      : "border-border"
                                  )}
                                  inputMode="decimal"
                                />
                                {isBelowCost && (
                                  <button
                                    type="button"
                                    onClick={() => openBelowCostDialog(item)}
                                    className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    {item.belowCostReason ? `Auth: ${item.belowCostReason}` : `⚠️ Below Cost (Reason Required)`}
                                  </button>
                                )}
                              </>
                            )
                          })()}
                        </div>

                        {/* Discount */}
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Disc %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.disc}
                            onChange={(e) => updateLine(item.id, 'disc', Number(e.target.value))}
                            onFocus={() => setActiveIndex(idx)}
                            className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-right font-mono text-foreground outline-none focus:border-primary"
                            inputMode="numeric"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                        <span className="text-muted-foreground font-medium">Item Total:</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-slate-700 dark:text-slate-300 min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 uppercase text-slate-500 dark:text-slate-400">
                      <th className="p-3 text-left min-w-[220px]">Item</th>
                      <th className="p-3 text-left w-32 min-w-[110px]">Batch</th>
                      <th className="p-3 text-right w-20 min-w-[70px]">Stock</th>
                      <th className="p-3 text-right w-24 min-w-[85px]">Qty</th>
                      <th className="p-3 text-right w-24 min-w-[85px]">Free</th>
                      <th className="p-3 text-right w-28 min-w-[100px]">Rate</th>
                      <th className="p-3 text-right w-24 min-w-[85px]">Disc%</th>
                      <th className="p-3 text-right w-32 min-w-[110px]">Amount</th>
                      <th className="p-3 text-center w-12 min-w-[48px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {items.map((item, i) => {
                      const isActive = i === activeIndex
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setActiveIndex(i)}
                          className={cn(
                            'transition cursor-pointer',
                            isActive
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-inset ring-indigo-400/60 dark:ring-indigo-500/40 border-l-4 border-l-indigo-500'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          )}
                        >
                          <td className="p-3 font-medium text-foreground dark:text-white min-w-[220px]">
                            {item.name}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.manufacturer && (
                                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded shadow-2xs">
                                  {item.manufacturer}
                                </span>
                              )}
                              {item.packing && (
                                <span className="text-[11px] text-slate-400 font-normal">{item.packing}</span>
                              )}
                              {item.hsn && (
                                <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                                  HSN: {item.hsn} ({item.gst}% GST)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-amber-600 dark:text-amber-400 font-semibold min-w-[110px]">{item.batch}</td>
                          <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400 min-w-[70px]">{item.stock}</td>
                          <td className="p-2 text-right min-w-[85px]">
                            <input
                              id={`row-${i}-qty`}
                              min="0"
                              max={item.stock}
                              type="number"
                              value={item.qty}
                              onChange={(e) => updateLine(item.id, 'qty', Number(e.target.value) || 0)}
                              onFocus={(e) => {
                                e.target.select()
                                setActiveIndex(i)
                              }}
                              placeholder="0"
                              className="w-full min-w-[75px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-right text-foreground dark:text-white font-mono font-semibold text-xs outline-none focus:border-indigo-500 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onKeyDown={(e) => handleKeyDown(e, i, 'qty')}
                            />
                          </td>
                          <td className="p-2 text-right min-w-[85px]">
                            <input
                              id={`row-${i}-free`}
                              min="0"
                              type="number"
                              value={item.free}
                              onChange={(e) => updateLine(item.id, 'free', Number(e.target.value) || 0)}
                              onFocus={(e) => {
                                e.target.select()
                                setActiveIndex(i)
                              }}
                              placeholder="0"
                              className="w-full min-w-[75px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-right text-foreground dark:text-white font-mono font-semibold text-xs outline-none focus:border-indigo-500 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onKeyDown={(e) => handleKeyDown(e, i, 'free')}
                            />
                          </td>
                          <td className="p-2 text-right min-w-[110px]">
                            {(() => {
                              const cost = Number(item.purchaseRate || item.costPrice || 0)
                              const isBelowCost = Number(item.rate || 0) > 0 && cost > 0 && Number(item.rate || 0) < cost
                              return (
                                <>
                                  <input
                                    id={`row-${i}-rate`}
                                    min="0"
                                    type="number"
                                    step="0.01"
                                    value={item.rate === 0 ? '' : item.rate}
                                    onChange={(e) => updateLine(item.id, 'rate', Number(e.target.value) || 0)}
                                    onBlur={() => handleRateBlur(item)}
                                    onFocus={() => setActiveIndex(i)}
                                    placeholder={item.mrp ? item.mrp.toFixed(2) : "0.00"}
                                    className={cn(
                                      "w-full min-w-[95px] bg-white dark:bg-slate-950 border rounded px-2.5 py-1.5 text-right font-mono font-semibold text-xs outline-none focus:border-indigo-500 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      isBelowCost
                                        ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold focus:border-rose-600"
                                        : "border-slate-300 dark:border-slate-800 text-foreground dark:text-white"
                                    )}
                                    onKeyDown={(e) => handleKeyDown(e, i, 'rate')}
                                  />
                                  {isBelowCost && (
                                    <button
                                      type="button"
                                      onClick={() => openBelowCostDialog(item)}
                                      className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline block text-right w-full truncate cursor-pointer"
                                      title={item.belowCostReason ? `Authorized: ${item.belowCostReason}` : `Cost: ₹${cost}. Click to provide reason.`}
                                    >
                                      {item.belowCostReason ? `Auth: ${item.belowCostReason}` : `⚠️ Below Cost (₹${cost})`}
                                    </button>
                                  )}
                                </>
                              )
                            })()}
                          </td>
                          <td className="p-2 text-right min-w-[85px]">
                            <input
                              id={`row-${i}-disc`}
                              min="0"
                              max="100"
                              type="number"
                              value={item.disc === 0 ? '' : item.disc}
                              onChange={(e) => updateLine(item.id, 'disc', Number(e.target.value) || 0)}
                              onFocus={() => setActiveIndex(i)}
                              placeholder="0"
                              className="w-full min-w-[75px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-right text-foreground dark:text-white font-mono font-semibold text-xs outline-none focus:border-indigo-500 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onKeyDown={(e) => handleKeyDown(e, i, 'disc')}
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap min-w-[110px]">{formatCurrency(item.amount)}</td>
                          <td className="p-3 text-center min-w-[70px] whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveIndex(i)
                                setDetailModalOpen(true)
                              }}
                              className="p-1 mr-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                              title="Inspect Product & Batch Details (F3 / Alt+I)"
                            >
                              <Info size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeRow(item.id)
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Marg ERP Style Pop-up Product Description & Inspection Panel */}
              <ActiveProductDetailPanel
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                activeProduct={
                  activeItem
                    ? {
                      id: activeItem.itemId || activeItem.id,
                      code: activeItem.code,
                      name: activeItem.name,
                      packing: activeItem.packing,
                      manufacturer: activeItem.manufacturer,
                      salt: activeItem.salt,
                      category: activeItem.category,
                      hsn: activeItem.hsn,
                      gstRate: activeItem.gst,
                      batch: activeItem.batch,
                      expiry: activeItem.expiry,
                      stock: activeItem.stock,
                      saleRate: activeItem.rate > 0 ? activeItem.rate : (activeItem.mrp || 0),
                      mrp: activeItem.mrp,
                      purchaseRate: activeItem.purchaseRate,
                      costPrice: activeItem.costPrice || activeItem.purchaseRate,
                      refNo: existingInvoice?.invoiceNo || existingInvoice?.number,
                      date: existingInvoice?.date || new Date().toISOString().split('T')[0],
                    }
                    : null
                }
                onDetailLoaded={(detail) => {
                  if (!activeItem) return
                  const detailSaleRate = Number(detail.saleRate || 0)
                  const detailMrp = Number(detail.mrp || 0)
                  const autoRate = detailSaleRate > 0 ? detailSaleRate : detailMrp
                  setItems((rows) =>
                    rows.map((row) => {
                      if (row.id !== activeItem.id) return row
                      const updatedMrp = detailMrp > 0 ? detailMrp : (row.mrp || 0)
                      const updatedPurchaseRate = Number(detail.purchaseRate || row.purchaseRate || 0)
                      const updatedCostPrice = Number(detail.costPrice || row.costPrice || updatedPurchaseRate)
                      const needsRate = (Number(row.rate) || 0) <= 0 && autoRate > 0
                      const updatedRate = needsRate ? autoRate : row.rate
                      const updatedAmount = needsRate
                        ? (calculateInvoice([{ qty: Math.max(row.qty, 0), rate: updatedRate, discount: row.disc, gstRate: row.gst }]).lines[0]?.total ?? (row.qty * updatedRate))
                        : row.amount
                      return {
                        ...row,
                        rate: updatedRate,
                        amount: updatedAmount,
                        mrp: updatedMrp,
                        purchaseRate: updatedPurchaseRate,
                        costPrice: updatedCostPrice,
                      }
                    })
                  )
                }}
                billSummary={{
                  title: 'Bill Values & Ledger',
                  partyLabel: 'Customer',
                  partyName: customer,
                  partyBalance: customerBalance,
                  mrpValue: totalMrpValue,
                  valueOfGoods: totals.subtotal,
                  discount: totals.discountTotal,
                  gstTotal: totals.taxTotal,
                  grandTotal: totals.grandTotal,
                }}
                totalRows={items.length}
                activeIndex={activeIndex}
                emptyMessage="Select or focus on any item row to inspect live batch, warehouse stock, rates, composition and margins."
              />
            </>
          )}
        </div>

        {/* Invoice Totals */}
        <div className="w-full sm:max-w-md sm:ml-auto grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900 p-4 text-sm shadow-sm text-black dark:text-white">
          <span className="text-black dark:text-slate-400 font-semibold">Subtotal</span>
          <span className="text-right font-mono font-bold text-black dark:text-white">{formatCurrency(totals.subtotal)}</span>
          <span className="text-black dark:text-slate-400 font-semibold">Discount</span>
          <span className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(totals.discountTotal)}</span>
          <span className="text-black dark:text-slate-400 font-semibold">GST</span>
          <span className="text-right font-mono font-bold text-black dark:text-white">{formatCurrency(totals.taxTotal)}</span>
          <span className="text-black dark:text-slate-400 font-semibold">Rounding</span>
          <span className="text-right font-mono font-bold text-black dark:text-white">{formatCurrency(totals.roundingAdjustment)}</span>
          <div className="col-span-2 border-t border-border dark:border-slate-800 my-1"></div>
          <span className="font-bold text-black dark:text-white text-base">Grand Total</span>
          <span className="text-right font-mono font-black text-emerald-700 dark:text-emerald-400 text-base">{formatCurrency(totals.grandTotal)}</span>
          {isEditMode && items.length === 0 && totals.grandTotal > 0 && (
            <div className="col-span-2 text-[11px] text-amber-600 dark:text-amber-400/90 text-right font-medium pt-1">
              * Amount preserved from posted invoice record (no item lines in DB)
            </div>
          )}
        </div>

        {/* Search & Add Item Modal */}
        {showItemSearch && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setShowItemSearch(false)}
          >
            <div
              className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border bg-secondary/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Select Item / Medicine</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowItemSearch(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary hover:bg-secondary/80 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 border-b border-border bg-muted/40">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Type to filter medicines or batch..."
                    className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground transition"
                  />
                </div>
              </div>

              <div className="p-2 overflow-y-auto flex-1 divide-y divide-border/40">
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No available items found matching "{itemSearchQuery}"</div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={`${item.label}-${item.batch}`}
                      type="button"
                      onClick={() => addRow(item)}
                      className="w-full p-3 text-left rounded-xl hover:bg-secondary/70 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-foreground group-hover:text-primary transition">{item.label}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {item.manufacturer && (
                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded shadow-2xs">
                              {item.manufacturer}
                            </span>
                          )}
                          {item.packing && <span>{item.packing}</span>}
                          {item.salt && <span className="italic text-muted-foreground">{item.salt}</span>}
                          <span className="font-mono bg-secondary px-1.5 py-0.5 rounded border border-border text-foreground">
                            Batch: {item.batch}
                          </span>
                          <span>Stock: {item.stock}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(item.rate)}</div>
                        <span className="text-[10px] text-muted-foreground uppercase">GST: {item.gst}%</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-3 bg-secondary/30 border-t border-border text-xs text-muted-foreground flex justify-between items-center">
                <span>{filteredItems.length} items available</span>
                <button
                  type="button"
                  onClick={() => setShowItemSearch(false)}
                  className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded-lg text-foreground font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Bottom Action Bar for Mobile Screen */}
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-md border-t border-border p-3 flex items-center justify-between gap-3 shadow-2xl">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total ({items.length} items)</div>
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(totals.grandTotal)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowItemSearch(true)}
              className="flex items-center gap-1 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-semibold transition border border-border cursor-pointer"
            >
              <Plus size={14} /> Add Item
            </button>
            <button
              type="button"
              onClick={saveInvoice}
              disabled={saving || !customer || !items.length}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Desktop Keyboard Shortcuts Hint */}
        <div className="hidden md:block fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 text-[10px] text-center uppercase tracking-widest text-muted-foreground z-30">
          F2: Item Search | Enter: Next Field/Row | Alt+S: Save | Esc: Cancel
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintModal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 no-print overflow-y-auto"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex-1 min-w-0 pr-8 sm:pr-0 relative">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">Tax Invoice Bill Preview</h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Standard A4 pharmaceutical wholesale &amp; retail tax invoice ready for print or PDF
                </p>
                {/* Mobile top-right close X */}
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="sm:hidden absolute top-0 right-0 p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary transition cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <PrintButton
                  label="Print Bill"
                  autoOrientationHint="portrait"
                  variant="secondary"
                  kbd="Ctrl+P"
                />
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="hidden sm:inline-flex p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-secondary transition cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto text-black">
              <TaxInvoicePrint data={getPrintData()} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Checkout Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border p-3 flex items-center justify-between gap-3 md:hidden shadow-xl">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Grand Total ({items.length} items)</div>
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.grandTotal)}</div>
          </div>
          <button
            type="button"
            onClick={saveInvoice}
            disabled={saving || !customer || !items.length}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? 'Saving…' : isEditMode ? 'Update' : 'Save Bill'}</span>
          </button>
        </div>
      )}

      {/* Print Target (Rendered exclusively for window.print()) */}
      <div className="hidden print:block w-full mx-auto">
        <TaxInvoicePrint data={getPrintData()} />
      </div>

      {/* Free Local OCR Invoice / Prescription Scanner */}
      <InvoiceOcrModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onApply={handleApplyOcrData}
        masterItems={itemOptions.map((opt) => ({
          id: opt.id || opt.itemId,
          itemId: opt.itemId,
          name: opt.label,
          label: opt.label,
          packing: opt.packing,
          hsn: opt.hsn,
          mrp: opt.mrp,
          rate: opt.rate,
          purchaseRate: opt.purchaseRate,
          gstRate: opt.gst,
          stock: opt.stock,
          manufacturer: opt.manufacturer,
          salt: opt.salt
        }))}
        mode="sale"
      />

      {/* Universal Law 1: Below Purchase Cost Alert & Reason Authorization Modal */}
      {belowCostModal && (
        <BelowCostAlertModal
          open={belowCostModal.open}
          itemName={belowCostModal.itemName}
          batch={belowCostModal.batch}
          sellPrice={belowCostModal.sellPrice}
          purchasePrice={belowCostModal.purchasePrice}
          currentReason={belowCostModal.currentReason}
          onAuthorize={handleAuthorizeBelowCost}
          onRevert={handleRevertBelowCost}
          onClose={() => setBelowCostModal(null)}
        />
      )}
    </div>
  )
}
