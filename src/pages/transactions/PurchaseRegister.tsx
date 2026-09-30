import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Eye, Printer, X, Edit3, Trash2, Save, ExternalLink, PlusCircle, CheckCircle2, Pill } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { deleteErp, getErp, patchErp } from '../../lib/erpApi'
import { getCached } from '../../lib/erpCache'
import { useUIStore } from '../../store/uiStore'
import PurchaseInvoicePrint, { InvoicePrintItem } from '../../components/transactions/PurchaseInvoicePrint'
import { getGstRateForHsn, getAllHsnCodes, registerHsnCodesFromDb } from '../../lib/hsnUtils'
import { openTransactionWindow } from '../../lib/windowUtils'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import TopTableScroller from '../../components/common/TopTableScroller'
import PrintButton from '../../components/common/PrintButton'

interface ItemOption {
  id?: string
  code?: string
  name: string
  packing: string
  hsn: string
  mrp: number
  purchaseRate: number
  saleRate: number
  gstRate: number
  stock: number
  manufacturer: string
  salt: string
  category?: string
  costPrice?: number
}

interface PurchaseInv {
  id: string
  challanNo: string
  invoiceNo: string
  date: string
  supplier: string
  items: number
  total: number
  status: string
  lines?: any[]
  buyerDetails?: any
}

interface EditableLine {
  id: string
  name: string
  packing?: string
  mfr?: string
  hsn?: string
  batch: string
  expiry: string
  qty: number
  freeQty: number
  rate: number
  saleRate?: number
  mrp?: number
  discount: number
  gstRate: number
  amount: number
}

const STATUS_STYLE: Record<string, string> = {
  received: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  posted: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  pending: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs',
  draft: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs',
  partial: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold shadow-2xs',
  cancelled: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold shadow-2xs',
}

function mapPurchaseRow(row: any): PurchaseInv {
  return {
    id: row.dbId || row.id,
    challanNo: row.id || row.number || 'P000045',
    invoiceNo: row.supplierInvoice || row.invoiceNo || row.id,
    date: row.date,
    supplier: row.party,
    items: row.items || row.lines?.length || 1,
    total: row.total,
    status: row.status === 'posted' ? 'received' : (row.status === 'draft' ? 'pending' : (row.status || 'received')),
    lines: row.lines || [],
  }
}

export default function PurchaseRegister() {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<PurchaseInv[]>(() => {
    const cached = getCached<any[]>('purchases')
    return Array.isArray(cached) ? cached.map(mapPurchaseRow) : []
  })
  const [selected, setSelected] = useState<PurchaseInv | null>(null)
  const [editing, setEditing] = useState<PurchaseInv | null>(null)
  const [editLines, setEditLines] = useState<EditableLine[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [itemPickerTargetIndex, setItemPickerTargetIndex] = useState<number | null>(null)
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const itemSearchInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'pending' | 'partial' | 'cancelled'>('all')
  const [partiesMap, setPartiesMap] = useState<Record<string, any>>(() => {
    const cachedParties = getCached<any[]>('parties')
    const pMap: Record<string, any> = {}
    if (Array.isArray(cachedParties)) {
      cachedParties.forEach((p) => {
        if (p.name) pMap[p.name.toLowerCase()] = p
      })
    }
    return pMap
  })
  const addToast = useUIStore((s) => s.addToast)

  const loadPurchases = useCallback((force = false) => {
    Promise.all([
      getErp<any[]>('purchases', undefined, force ? { forceRefresh: true } : undefined),
      getErp<any[]>('parties', undefined, force ? { forceRefresh: true } : undefined).catch(() => []),
      getErp<any[]>('items', undefined, force ? { forceRefresh: true } : undefined).catch(() => []),
      getErp<any[]>('hsn').catch(() => []),
    ])
      .then(([rows, parties, rawItems, hsnData]) => {
        const pMap: Record<string, any> = {}
        if (Array.isArray(parties)) {
          parties.forEach((p) => {
            if (p.name) pMap[p.name.toLowerCase()] = p
          })
        }
        setPartiesMap(pMap)

        const rawHsn = Array.isArray(hsnData) ? hsnData : []
        if (rawHsn.length > 0) {
          registerHsnCodesFromDb(rawHsn)
        }
        const parsedHsn = getAllHsnCodes()

        if (Array.isArray(rawItems)) {
          setItemOptions(
            rawItems.map((p: any) => {
              const hsnCode = String(p.hsn ?? p.hsn_codes?.code ?? '').trim()
              const matchedHsn = parsedHsn.find((h) => h.code === hsnCode)
              const resolvedGstRate = matchedHsn
                ? matchedHsn.gstRate
                : (p.gstRate !== undefined && p.gstRate !== null ? Number(p.gstRate) : getGstRateForHsn(hsnCode))

              return {
                id: p.id,
                code: p.code,
                name: p.name || 'Unnamed Product',
                packing: p.packing ?? '',
                hsn: hsnCode,
                mrp: Number(p.mrp || 0),
                purchaseRate: Number(p.purchaseRate || p.costPrice || 0),
                saleRate: Number(p.saleRate || 0),
                gstRate: resolvedGstRate,
                stock: Number(p.stock ?? p.quantity ?? 0),
                manufacturer: String(p.manufacturer ?? p.mfr ?? p.company ?? '').trim(),
                salt: String(p.salt ?? p.composition ?? '').trim(),
                category: p.category ?? 'General',
                costPrice: Number(p.costPrice ?? p.cost_price ?? p.purchaseRate ?? 0),
              }
            })
          )
        }

        setPurchases(rows.map(mapPurchaseRow))
      })
      .catch((e) => addToast(e.message, 'error'))
  }, [addToast])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  useErpAutoRefresh(['purchases', 'parties', 'series', 'items', 'item-batches'], () => loadPurchases(false))

  useEffect(() => {
    if (showItemPicker) {
      setTimeout(() => {
        itemSearchInputRef.current?.focus()
      }, 50)
    }
  }, [showItemPicker])

  const anyModalOpen = !!(editing || showItemPicker || selected)
  useBodyScrollLock(anyModalOpen)

  const statusCounts = {
    all: purchases.length,
    received: purchases.filter((p) => p.status === 'received' || p.status === 'posted').length,
    pending: purchases.filter((p) => p.status === 'pending' || p.status === 'draft').length,
    partial: purchases.filter((p) => p.status === 'partial').length,
    cancelled: purchases.filter((p) => p.status === 'cancelled').length,
  }

  const filtered = purchases.filter((s) => {
    const matchesSearch =
      s.supplier.toLowerCase().includes(search.toLowerCase()) ||
      s.challanNo.toLowerCase().includes(search.toLowerCase()) ||
      s.invoiceNo.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'received' ? (s.status === 'received' || s.status === 'posted') :
       statusFilter === 'pending' ? (s.status === 'pending' || s.status === 'draft') :
       s.status === statusFilter)
    return matchesSearch && matchesStatus
  })
  const totalVal = filtered.reduce((a, s) => a + s.total, 0)

  const handlePrint = (inv: PurchaseInv) => {
    setSelected(inv)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const updatePurchaseStatus = async (invoice: PurchaseInv, newStatus: string) => {
    if (invoice.status === newStatus) return
    try {
      await patchErp('purchases', invoice.id, {
        status: newStatus,
        reason: `Status changed to ${newStatus}`,
      })
      setPurchases((rows) =>
        rows.map((row) => (row.id === invoice.id ? { ...row, status: newStatus } : row))
      )
      setSelected((current) =>
        current?.id === invoice.id ? { ...current, status: newStatus } : current
      )
      addToast(
        `Purchase ${invoice.challanNo} status updated to ${newStatus === 'received' ? 'Received (Goods Inwarded)' : newStatus.toUpperCase()}.`,
        'success'
      )
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update status.', 'error')
    }
  }

  const cancelPurchase = async (invoice: PurchaseInv) => {
    if (invoice.status === 'cancelled') return
    if (!window.confirm(`Cancel ${invoice.challanNo}? Stock and accounting postings will be reversed.`)) return
    try {
      await deleteErp('purchases', invoice.id)
      setPurchases((rows) => rows.map((row) => row.id === invoice.id ? { ...row, status: 'cancelled' } : row))
      setSelected((current) => current?.id === invoice.id ? { ...current, status: 'cancelled' } : current)
      addToast(`${invoice.challanNo} cancelled and reversed.`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel purchase.', 'error')
    }
  }

  // Normalize expiry string to MM/YY display format
  const formatExpiryForInput = (exp?: string): string => {
    if (!exp) return '12/28'
    const trimmed = String(exp).trim()
    if (trimmed.includes('/') && trimmed.length <= 7) return trimmed
    const parts = trimmed.split('T')[0].split('-')
    if (parts.length >= 2) {
      const yr = parts[0]
      const mo = parts[1]
      if (yr.length === 4) {
        return `${mo}/${yr.slice(-2)}`
      }
    }
    return trimmed
  }

  // Open the in-place challan editor
  const openEditModal = (inv: PurchaseInv) => {
    setEditing(inv)
    if (inv.lines && inv.lines.length > 0) {
      setEditLines(
        inv.lines.map((l: any, idx: number) => {
          const qty = Number(l.qty || l.quantity || 1)
          const rate = Number(l.rate || l.purchaseRate || 0)
          const disc = Number(l.disc || l.discount || 0)
          const gst = Number(l.gst ?? l.gstRate ?? getGstRateForHsn(l.hsn))
          const base = qty * rate
          const afterDisc = base - (base * disc) / 100
          const amt = Number(l.amount) || afterDisc + (afterDisc * gst) / 100
          return {
            id: String(l.id || `line-${Date.now()}-${idx}`),
            name: l.name || l.itemName || 'ITEM',
            packing: l.packing || '10T',
            mfr: l.manufacturer || l.mfr || '',
            hsn: l.hsn || '3004',
            batch: l.batch || 'BATCH1',
            expiry: formatExpiryForInput(l.expiry),
            qty,
            freeQty: Number(l.free || l.freeQty || 0),
            rate,
            discount: disc,
            gstRate: gst,
            saleRate: Number(l.saleRate || rate * 1.2),
            mrp: Number(l.mrp || rate * 1.35),
            amount: Math.round(amt * 100) / 100,
          }
        })
      )
    } else {
      // Create fallback item from total
      const rate = inv.total ? Math.round((inv.total / 1.05) * 100) / 100 : 1000
      setEditLines([
        {
          id: `line-${Date.now()}-0`,
          name: 'PHARMA GOODS (CHALLAN ITEM)',
          packing: '10T',
          hsn: '3004',
          batch: 'BATCH01',
          expiry: '12/28',
          qty: 1,
          freeQty: 0,
          rate,
          discount: 0,
          gstRate: 5,
          saleRate: Math.round(rate * 1.2 * 100) / 100,
          mrp: Math.round(rate * 1.35 * 100) / 100,
          amount: inv.total || 1050,
        },
      ])
    }
  }

  const updateLine = (idx: number, field: keyof EditableLine, val: any) => {
    setEditLines((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], [field]: val }

      if (field === 'hsn') {
        current.gstRate = getGstRateForHsn(val)
      }

      if (field === 'name') {
        const cleanName = String(val).trim().toLowerCase()
        const matched = itemOptions.find((o) => o.name.toLowerCase() === cleanName)
        if (matched) {
          if (matched.packing) current.packing = matched.packing
          if (matched.manufacturer) current.mfr = matched.manufacturer
          if (matched.hsn) {
            current.hsn = matched.hsn
            current.gstRate = matched.gstRate || getGstRateForHsn(matched.hsn)
          }
          if (matched.purchaseRate && (!current.rate || current.rate === 0)) {
            current.rate = matched.purchaseRate
          }
          if (matched.saleRate && (!current.saleRate || current.saleRate === 0)) {
            current.saleRate = matched.saleRate
          }
          if (matched.mrp && (!current.mrp || current.mrp === 0)) {
            current.mrp = matched.mrp
          }
        }
      }

      // Auto recalculate amount when quantity, rate, discount, or gst changes
      const q = Number(field === 'qty' ? val : current.qty || 0)
      const r = Number(field === 'rate' ? val : current.rate || 0)
      const d = Number(field === 'discount' ? val : current.discount || 0)
      const g = Number(field === 'gstRate' ? val : current.gstRate || 0)

      const base = q * r
      const afterDisc = base - (base * d) / 100
      const totalAmt = afterDisc + (afterDisc * g) / 100

      current.amount = Math.round(totalAmt * 100) / 100
      updated[idx] = current
      return updated
    })
  }

  const openAddItemPicker = () => {
    setItemPickerTargetIndex(null)
    setItemSearchQuery('')
    setShowItemPicker(true)
  }

  const openChangeItemPicker = (idx: number) => {
    setItemPickerTargetIndex(idx)
    setItemSearchQuery('')
    setShowItemPicker(true)
  }

  const handleSelectItem = (item: ItemOption) => {
    const gstRate = Number(item.gstRate !== undefined && item.gstRate !== null ? item.gstRate : getGstRateForHsn(item.hsn))
    const pRate = Number(item.purchaseRate || item.costPrice || 0)
    const sRate = Number(item.saleRate || (pRate > 0 ? Math.round(pRate * 1.2 * 100) / 100 : 0))
    const mRate = Number(item.mrp || (pRate > 0 ? Math.round(pRate * 1.35 * 100) / 100 : 0))

    if (itemPickerTargetIndex !== null && itemPickerTargetIndex >= 0 && itemPickerTargetIndex < editLines.length) {
      // Update existing line
      setEditLines((prev) => {
        const updated = [...prev]
        const existing = updated[itemPickerTargetIndex]
        const qty = existing.qty > 0 ? existing.qty : 1
        const rateToUse = pRate > 0 ? pRate : existing.rate
        const disc = existing.discount || 0
        const base = qty * rateToUse
        const afterDisc = base - (base * disc) / 100
        const totalAmt = afterDisc + (afterDisc * gstRate) / 100

        updated[itemPickerTargetIndex] = {
          ...existing,
          name: item.name,
          packing: item.packing || existing.packing || '10T',
          mfr: item.manufacturer || existing.mfr || '',
          hsn: item.hsn || existing.hsn || '3004',
          rate: rateToUse,
          saleRate: sRate || existing.saleRate,
          mrp: mRate || existing.mrp,
          gstRate,
          amount: Math.round(totalAmt * 100) / 100,
        }
        return updated
      })
    } else {
      // Add as new line
      const qty = 1
      const disc = 0
      const base = qty * pRate
      const afterDisc = base - (base * disc) / 100
      const totalAmt = afterDisc + (afterDisc * gstRate) / 100

      setEditLines((prev) => [
        ...prev,
        {
          id: `line-${Date.now()}-${prev.length}`,
          name: item.name,
          packing: item.packing || '10T',
          mfr: item.manufacturer || '',
          hsn: item.hsn || '3004',
          batch: '',
          expiry: '',
          qty: 1,
          freeQty: 0,
          rate: pRate,
          saleRate: sRate,
          mrp: mRate,
          discount: 0,
          gstRate,
          amount: Math.round(totalAmt * 100) / 100,
        },
      ])
    }

    setShowItemPicker(false)
    setItemSearchQuery('')
    setItemPickerTargetIndex(null)
  }

  const handleAddCustomItem = (customName?: string) => {
    const nameToUse = (customName || itemSearchQuery || 'NEW MEDICINE ITEM').trim()
    if (itemPickerTargetIndex !== null && itemPickerTargetIndex >= 0 && itemPickerTargetIndex < editLines.length) {
      updateLine(itemPickerTargetIndex, 'name', nameToUse)
    } else {
      setEditLines((prev) => [
        ...prev,
        {
          id: `line-${Date.now()}-${prev.length}`,
          name: nameToUse,
          packing: '10T',
          mfr: '',
          hsn: '3004',
          batch: '',
          expiry: '',
          qty: 1,
          freeQty: 0,
          rate: 0,
          saleRate: 0,
          mrp: 0,
          discount: 0,
          gstRate: 5,
          amount: 0,
        },
      ])
    }
    setShowItemPicker(false)
    setItemSearchQuery('')
    setItemPickerTargetIndex(null)
  }

  const filteredModalItems = itemOptions.filter((item) => {
    if (!itemSearchQuery.trim()) return true
    const q = itemSearchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.salt && item.salt.toLowerCase().includes(q)) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(q)) ||
      (item.hsn && item.hsn.toLowerCase().includes(q)) ||
      (item.code && item.code.toLowerCase().includes(q))
    )
  })

  const addLine = () => {
    openAddItemPicker()
  }

  const removeLine = (idx: number) => {
    if (editLines.length <= 1) {
      addToast('At least one item is required in the challan', 'error')
      return
    }
    setEditLines((prev) => prev.filter((_, i) => i !== idx))
  }

  // Calculate grand totals for modal
  const editSubtotal = editLines.reduce((acc, l) => {
    const base = Number(l.qty || 0) * Number(l.rate || 0)
    return acc + (base - (base * Number(l.discount || 0)) / 100)
  }, 0)
  const editGrandTotal = Math.round(editLines.reduce((acc, l) => acc + Number(l.amount || 0), 0) * 100) / 100
  const editTaxTotal = Math.round((editGrandTotal - editSubtotal) * 100) / 100

  // Save changes directly back to database & state
  const handleSaveChallan = async () => {
    if (!editing) return
    setIsSaving(true)

    const payload = {
      id: editing.id,
      party: editing.supplier,
      supplierInvoice: editing.invoiceNo,
      date: editing.date,
      status: editing.status,
      items: editLines.length,
      subtotal: Math.round(editSubtotal * 100) / 100,
      taxTotal: editTaxTotal,
      total: editGrandTotal,
      lines: editLines.map((l) => ({
        name: l.name,
        packing: l.packing,
        hsn: l.hsn,
        batch: l.batch,
        expiry: l.expiry,
        qty: l.qty,
        freeQty: l.freeQty,
        rate: l.rate,
        discount: l.discount,
        gstRate: l.gstRate,
        amount: l.amount,
        saleRate: Number(l.saleRate || 0),
        mrp: Number(l.mrp || 0),
      })),
    }

    try {
      await patchErp('purchases', editing.id, { ...payload, reason: `Amended purchase ${editing.challanNo}` })

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                supplier: editing.supplier,
                invoiceNo: editing.invoiceNo,
                date: editing.date,
                status: editing.status,
                items: editLines.length,
                total: editGrandTotal,
                lines: editLines,
              }
            : p
        )
      )

      addToast(`Challan ${editing.challanNo} modified successfully!`, 'success')
      setEditing(null)
      window.setTimeout(() => window.location.reload(), 400)
    } catch (e: any) {
      addToast(e.message || 'Failed to update challan', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Build print data for selected invoice
  const getPrintData = (inv: PurchaseInv) => {
    const partyInfo = partiesMap[inv.supplier.toLowerCase()] || {}
    const itemsList: InvoicePrintItem[] =
      inv.lines && inv.lines.length > 0
        ? inv.lines.map((l: any) => ({
            itemName: l.name || l.itemName || 'CUTIROSE',
            packing: l.packing || '50ML',
            mfr: l.manufacturer || l.mfr || '',
            hsn: l.hsn || '3004',
            batch: l.batch || 'CT251459',
            expiry: l.expiry || '1/28',
            qty: Number(l.qty || l.quantity || 20),
            freeQty: Number(l.free || l.freeQty || 0),
            mrp: Number(l.mrp || 97.0),
            purchaseRate: Number(l.rate || l.purchaseRate || 73.9),
            discount: Number(l.disc || l.discount || 5.0),
            scheme: Number(l.scheme || 0),
            gstRate: Number(l.gst || l.gstRate || 5.0),
            amount: Number(l.amount || 1478.0),
          }))
        : [
            {
              itemName: 'CUTIROSE',
              packing: '50ML',
              mfr: '',
              hsn: '3004',
              batch: 'CT251459',
              expiry: '1/28',
              qty: 20,
              freeQty: 0,
              mrp: 97.0,
              purchaseRate: 73.9,
              discount: 5.0,
              scheme: 0,
              gstRate: 5.0,
              amount: 1478.0,
            },
          ]

    return {
      supplier: {
        name: inv.supplier || 'M/S ASHA DRUG DISTRIBUTORS TEZPUR',
        address: partyInfo.address || 'OPP BORGANG T.E. HOSPITAL P.O. BORGANG, DIST- BISWANATH',
        gstin: partyInfo.gstin || '18ABCFS4582H1Z8',
        dlNo: partyInfo.dlNo || 'DLR-IV-41584/85',
        phone: partyInfo.phone || '9435081045',
        state: partyInfo.state || 'Assam',
        pan: partyInfo.pan || 'ABCFS4582H',
      },
      challanNo: inv.challanNo || 'PB-2026-347165',
      supplierInvoiceNo: inv.invoiceNo || 'G-86',
      date: inv.date || '2026-04-02',
      invoiceDate: inv.date || '2026-04-02',
      paymentType: 'CREDIT',
      items: itemsList,
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Screen Controls & Register Table */}
      <div className="no-print space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Purchase Register</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {filtered.length} challans | Total: {formatCurrency(totalVal)}
            </p>
          </div>
          <a
            href="/transactions/purchase/new"
            target="_blank"
            rel="noopener noreferrer"
            title="New Purchase (opens in new window)"
            className="inline-flex h-9 items-center justify-center gap-2 w-full sm:w-auto px-3.5 sm:px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all duration-150"
          >
            <Plus size={15} /> New Purchase
          </a>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by challan or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs transition"
            />
          </div>
          <div className="w-full min-w-0 sm:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'received', 'pending', 'partial', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span>{st === 'all' ? 'All Orders' : st}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                    statusFilter === st
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {statusCounts[st]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
          <table className="min-w-[700px] w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
                <th className="text-left px-4 py-3 font-medium">Challan No</th>
                <th className="text-left px-4 py-3 font-medium">Supplier Invoice</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-right px-4 py-3 font-medium">Items</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-mono">
                    <button
                      onClick={() => openEditModal(s)}
                      className="text-indigo-700 dark:text-indigo-400 hover:underline font-semibold text-left cursor-pointer"
                      title="Click to modify challan"
                    >
                      {s.challanNo}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.supplier}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.items}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Change status of ${s.challanNo}`}
                      value={s.status}
                      onChange={(e) => void updatePurchaseStatus(s, e.target.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold capitalize border outline-none cursor-pointer transition shadow-2xs',
                        STATUS_STYLE[s.status] || STATUS_STYLE.received
                      )}
                    >
                      <option value="received" className="bg-card text-foreground">Received</option>
                      <option value="pending" className="bg-card text-foreground">Pending</option>
                      <option value="partial" className="bg-card text-foreground">Partial</option>
                      <option value="cancelled" className="bg-card text-foreground">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5 items-center">
                      {s.status !== 'received' && s.status !== 'cancelled' && (
                        <button
                          type="button"
                          aria-label={`Mark ${s.challanNo} as Received`}
                          onClick={() => void updatePurchaseStatus(s, 'received')}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 rounded-md transition cursor-pointer shadow-2xs"
                          title="Mark Order as Received (Goods Received into Stock)"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button
                        aria-label={`Open ${s.challanNo} in new window`}
                        onClick={() => openTransactionWindow(`/transactions/purchase/edit/${encodeURIComponent(s.challanNo)}`)}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-muted rounded transition cursor-pointer"
                        title="Open in New Window"
                      >
                        <ExternalLink size={15} />
                      </button>
                      <button
                        aria-label={`Modify ${s.challanNo}`}
                        onClick={() => openEditModal(s)}
                        className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-muted rounded transition cursor-pointer"
                        title="Modify Challan"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        aria-label={`View ${s.challanNo}`}
                        onClick={() => setSelected(s)}
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                        title="View Goods Receipt Note"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        aria-label={`Print ${s.challanNo}`}
                        onClick={() => handlePrint(s)}
                        className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                        title="Print Goods Receipt Note"
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        aria-label={`Cancel ${s.challanNo}`}
                        onClick={() => cancelPurchase(s)}
                        disabled={s.status === 'cancelled'}
                        className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Cancel and reverse purchase"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-Place Challan Modifier Modal */}
      {editing && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-2 sm:p-4 no-print overflow-y-auto backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card border border-border w-[98vw] max-w-[1550px] rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[94vh] overflow-y-auto text-card-foreground flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                    <Edit3 size={18} />
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">Modify Purchase Challan</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Challan No: <span className="text-foreground font-mono font-bold">{editing.challanNo}</span> | ID: {editing.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTransactionWindow(`/transactions/purchase/edit/${encodeURIComponent(editing.challanNo)}`)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg transition"
                  title="Open full-page purchase entry editor in new window"
                >
                  <ExternalLink size={13} /> Open in New Window
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Top metadata fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Supplier Name</label>
                <input
                  type="text"
                  value={editing.supplier}
                  onChange={(e) => setEditing({ ...editing, supplier: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-slate-300 dark:border-slate-700 text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Supplier Invoice No</label>
                <input
                  type="text"
                  value={editing.invoiceNo}
                  onChange={(e) => setEditing({ ...editing, invoiceNo: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-slate-300 dark:border-slate-700 text-foreground font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Invoice / Challan Date</label>
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-slate-300 dark:border-slate-700 text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold uppercase text-[10px]">Challan Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-background border border-slate-300 dark:border-slate-700 text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none capitalize"
                >
                  <option value="received">Received</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Challan Goods ({editLines.length} items)
                </h3>
                <button
                  type="button"
                  onClick={openAddItemPicker}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition font-medium shadow-2xs cursor-pointer"
                  title="Search and choose item from catalog to add to challan"
                >
                  <PlusCircle size={13} /> Add Line Item
                </button>
              </div>

              {/* HSN Datalist */}
              <datalist id="register-hsn-list">
                {getAllHsnCodes().map((h) => (
                  <option key={h.code} value={h.code} label={`${h.code} (${h.gstRate}% GST) - ${h.description}`}>
                    {`${h.code} (${h.gstRate}% GST) - ${h.description}`}
                  </option>
                ))}
              </datalist>

              {/* Product Datalist for Quick Autocomplete */}
              <datalist id="register-items-datalist">
                {itemOptions.slice(0, 80).map((opt) => (
                  <option key={opt.id || opt.name} value={opt.name}>
                    {opt.manufacturer ? `${opt.manufacturer} · ` : ''}{opt.packing ? `${opt.packing} · ` : ''}Rate: ₹{opt.purchaseRate}
                  </option>
                ))}
              </datalist>

              <TopTableScroller
                shortcuts={[
                  { label: 'Item & Batch', offsetPercent: 0 },
                  { label: 'Qty & Rate', offsetPercent: 0.35 },
                  { label: 'Sale & MRP', offsetPercent: 0.65 },
                  { label: 'Amount & Actions', offsetPercent: 1.0 },
                ]}
                className="border border-slate-300 dark:border-slate-800 rounded-xl bg-card shadow-xs overflow-hidden"
              >
                <table className="w-full text-xs min-w-[1060px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 uppercase text-[10px] font-mono font-bold tracking-wider">
                      <th className="text-left px-3 py-2.5 min-w-[210px] border-r border-slate-200 dark:border-slate-700">Item Description</th>
                      <th className="text-left px-2 py-2.5 w-28 min-w-[95px] border-r border-slate-200 dark:border-slate-700">Batch</th>
                      <th className="text-center px-2 py-2.5 w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700">Expiry</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[60px] border-r border-slate-200 dark:border-slate-700">Qty</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[60px] border-r border-slate-200 dark:border-slate-700">Free</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700">Rate (₹)</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400">Sale Price</th>
                      <th className="text-right px-2 py-2.5 w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700">MRP (₹)</th>
                      <th className="text-right px-2 py-2.5 w-16 min-w-[60px] border-r border-slate-200 dark:border-slate-700">Disc %</th>
                      <th className="text-center px-2 py-2.5 w-20 min-w-[70px] border-r border-slate-200 dark:border-slate-700">GST %</th>
                      <th className="text-right px-3 py-2.5 w-28 min-w-[100px] border-r border-slate-200 dark:border-slate-700">Amount (₹)</th>
                      <th className="w-10 min-w-[40px] px-1 py-2.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {editLines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-2 min-w-[210px] border-r border-slate-200 dark:border-slate-800">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              list="register-items-datalist"
                              value={line.name}
                              placeholder="Search or type medicine name..."
                              onChange={(e) => updateLine(idx, 'name', e.target.value)}
                              className="w-full pl-2.5 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground font-semibold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                            />
                            <button
                              type="button"
                              onClick={() => openChangeItemPicker(idx)}
                              className="absolute right-1.5 p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition cursor-pointer"
                              title="Pick or replace item from product master catalog"
                            >
                              <Search size={13} />
                            </button>
                          </div>
                          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                            <input
                              type="text"
                              list="register-hsn-list"
                              placeholder="HSN code"
                              value={line.hsn || ''}
                              onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                              className="w-20 px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-foreground outline-none focus:border-primary"
                              title="HSN Code (auto-calculates GST%)"
                            />
                            {line.hsn && (
                              <span className="text-[10px] font-mono font-medium text-muted-foreground whitespace-nowrap">
                                {getGstRateForHsn(line.hsn)}% GST
                              </span>
                            )}
                            {line.packing && (
                              <span className="text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 max-w-[80px] truncate" title={line.packing}>
                                {line.packing}
                              </span>
                            )}
                            {line.mfr && (
                              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60 max-w-[100px] truncate font-medium" title={line.mfr}>
                                {line.mfr}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-1.5 min-w-[95px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={line.batch}
                            onChange={(e) => updateLine(idx, 'batch', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground font-mono font-bold text-xs uppercase outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="p-1.5 min-w-[80px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={line.expiry}
                            onChange={(e) => updateLine(idx, 'expiry', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground font-mono font-bold text-xs text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[60px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[60px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            value={line.freeQty}
                            onChange={(e) => updateLine(idx, 'freeQty', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-muted-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[80px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[80px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            step="0.01"
                            value={line.saleRate || ''}
                            onChange={(e) => updateLine(idx, 'saleRate', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-600 rounded-md text-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Sale Price (₹)"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[80px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            step="0.01"
                            value={line.mrp || ''}
                            onChange={(e) => updateLine(idx, 'mrp', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="MRP (₹)"
                          />
                        </td>
                        <td className="p-1.5 text-right min-w-[60px] border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={line.discount}
                            onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-muted-foreground text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="p-1.5 text-center min-w-[70px] border-r border-slate-200 dark:border-slate-800">
                          <select
                            value={line.gstRate}
                            onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                            className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-foreground text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs cursor-pointer"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-extrabold text-foreground text-xs whitespace-nowrap min-w-[100px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="p-1 text-center min-w-[40px]">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-md transition cursor-pointer"
                            title="Remove Line"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TopTableScroller>
            </div>

            {/* Bottom calculation summary & actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-border">
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div>
                  Subtotal: <span className="font-mono text-foreground font-semibold">{formatCurrency(editSubtotal)}</span>
                </div>
                <div>
                  Tax (GST): <span className="font-mono text-foreground font-semibold">{formatCurrency(editTaxTotal)}</span>
                </div>
                <div>
                  Grand Total:{' '}
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    {formatCurrency(editGrandTotal)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold transition border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveChallan}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <Save size={14} />
                  {isSaving ? 'Saving Changes...' : 'Save & Update Challan'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Product Selection Modal for Challan Modifier */}
      {showItemPicker && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print animate-in fade-in duration-150"
          onClick={() => {
            setShowItemPicker(false)
            setItemPickerTargetIndex(null)
          }}
        >
          <div
            className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Pill size={18} />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {itemPickerTargetIndex !== null
                      ? `Change Product for Row #${itemPickerTargetIndex + 1}`
                      : 'Select Medicine / Item to Add'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {itemPickerTargetIndex !== null
                      ? 'Choose a replacement item from inventory catalog'
                      : 'Click an item to insert into the goods receipt challan'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowItemPicker(false)
                  setItemPickerTargetIndex(null)
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 border-b border-border bg-muted/20">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={itemSearchInputRef}
                  type="text"
                  placeholder="Search products by brand name, salt/composition, manufacturer, or HSN code..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowItemPicker(false)
                      setItemPickerTargetIndex(null)
                    } else if (e.key === 'Enter') {
                      if (filteredModalItems.length > 0) {
                        handleSelectItem(filteredModalItems[0])
                      } else if (itemSearchQuery.trim()) {
                        handleAddCustomItem(itemSearchQuery)
                      }
                    }
                  }}
                  className="w-full bg-background border border-input rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                />
                {itemSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setItemSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40 space-y-1">
              {filteredModalItems.length > 0 ? (
                filteredModalItems.map((item) => (
                  <button
                    key={item.id || item.code || item.name}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full p-2.5 sm:p-3 rounded-xl hover:bg-muted/70 transition-colors text-left group cursor-pointer flex items-center justify-between gap-3 border border-transparent hover:border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                        {item.manufacturer && (
                          <span className="font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-1.5 py-0.5 rounded shadow-2xs">
                            {item.manufacturer}
                          </span>
                        )}
                        {item.packing && (
                          <span className="bg-muted px-1.5 py-0.5 rounded border border-border/60">
                            {item.packing}
                          </span>
                        )}
                        {item.salt && (
                          <span className="italic text-muted-foreground max-w-[200px] truncate" title={item.salt}>
                            {item.salt}
                          </span>
                        )}
                        {item.hsn && (
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                            HSN: {item.hsn}
                          </span>
                        )}
                        <span className="text-primary font-medium">GST: {item.gstRate}%</span>
                        {typeof item.stock === 'number' && (
                          <span className="text-muted-foreground">Stock: {item.stock}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                        {formatCurrency(item.purchaseRate)}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1.5 mt-0.5">
                        {item.saleRate > 0 && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            Sale: ₹{item.saleRate}
                          </span>
                        )}
                        <span>MRP: ₹{item.mrp}</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center space-y-3">
                  <div className="text-muted-foreground text-xs">
                    {itemSearchQuery
                      ? `No products found matching "${itemSearchQuery}".`
                      : 'No items loaded from the product catalog.'}
                  </div>
                  {itemSearchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddCustomItem(itemSearchQuery)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold transition"
                    >
                      <PlusCircle size={14} /> Add "{itemSearchQuery.trim()}" as custom item
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground text-[11px]">
                {filteredModalItems.length} products available
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddCustomItem()}
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-lg transition"
                  title="Add an empty line to enter custom or non-catalog item"
                >
                  + Add Custom / Blank Item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowItemPicker(false)
                    setItemPickerTargetIndex(null)
                  }}
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Invoice Detail / Print Preview Modal */}
      {selected && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-2 sm:p-4 no-print overflow-y-auto backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex-1 min-w-0 pr-8 sm:pr-0 relative">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">Goods Receipt Note / Purchase Invoice</h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>Challan: <span className="text-foreground font-mono">{selected.challanNo}</span></span>
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <span>Date: <span className="text-foreground font-mono">{selected.date}</span></span>
                </p>
                {/* Mobile top-right close X */}
                <button
                  onClick={() => setSelected(null)}
                  className="sm:hidden absolute top-0 right-0 p-1.5 text-muted-foreground hover:text-foreground rounded-lg bg-muted transition"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selected
                    setSelected(null)
                    openEditModal(toEdit)
                  }}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 active:scale-[0.98] transition cursor-pointer shadow-2xs"
                  title="Modify this challan"
                >
                  <Edit3 size={14} />
                  <span>Modify</span>
                </button>
                <PrintButton
                  label="Print Invoice"
                  variant="primary"
                  autoOrientationHint="portrait"
                  size="md"
                />
                <button
                  onClick={() => setSelected(null)}
                  className="hidden sm:inline-flex p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-300 overflow-x-auto text-slate-900">
              <PurchaseInvoicePrint data={getPrintData(selected)} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Print Target (Only visible when printing) */}
      {selected && (
        <div className="hidden print:block w-full">
          <PurchaseInvoicePrint data={getPrintData(selected)} />
        </div>
      )}
    </div>
  )
}
