import { useState, useEffect, useMemo } from 'react'
import {
  Ban,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  FileText,
  Download,
  CheckCircle,
  X,
  AlertTriangle,
  Package,
  Layers
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp, patchErp } from '../../lib/erpApi'

export interface RestrictedItem {
  id: string
  itemId?: string
  name: string
  packing?: string
  batch: string
  expiry?: string
  qty: number
  mrp: number
  purchaseRate: number
  reason: string
  refNo?: string
  type: 'hold' | 'ban'
  dateAdded: string
}

const STORAGE_KEY = 'pharma_erp_hold_ban_stock'

export default function HoldBanStock() {
  const [itemsList, setItemsList] = useState<any[]>([])
  const [restricted, setRestricted] = useState<RestrictedItem[]>([])
  const [tab, setTab] = useState<'all' | 'hold' | 'ban'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const addToast = useUIStore((s) => s.addToast)

  // Modal form state
  const [selectedItemId, setSelectedItemId] = useState('')
  const [customName, setCustomName] = useState('')
  const [batch, setBatch] = useState('')
  const [expiry, setExpiry] = useState('')
  const [qty, setQty] = useState(10)
  const [mrp, setMrp] = useState(100)
  const [purchaseRate, setPurchaseRate] = useState(80)
  const [type, setType] = useState<'hold' | 'ban'>('hold')
  const [reason, setReason] = useState('Under Quality Control (QC) Inspection')
  const [refNo, setRefNo] = useState('')

  // Load items from ERP and stored restrictions
  useEffect(() => {
    getErp<any[]>('items')
      .then((data) => {
        const prods = data || []
        setItemsList(prods)

        // Load saved restrictions from localStorage
        const saved = localStorage.getItem(STORAGE_KEY)
        let localData: RestrictedItem[] = []
        if (saved) {
          try {
            localData = JSON.parse(saved)
          } catch {}
        }

        // Also check if any items in ERP have status === 'banned'
        const fromDb: RestrictedItem[] = []
        prods.forEach((p) => {
          if (p.status === 'banned') {
            fromDb.push({
              id: `banned-${p.id}`,
              itemId: p.id,
              name: p.name,
              packing: p.packing || '10T',
              batch: p.batches?.[0]?.batch || 'ALL-BATCHES',
              expiry: p.batches?.[0]?.expiry || '12/28',
              qty: Number(p.stock || 50),
              mrp: Number(p.mrp || 120),
              purchaseRate: Number(p.purchaseRate || 90),
              reason: 'Government / Regulatory Banned Formulation',
              refNo: 'GAZETTE-NOTIFICATION',
              type: 'ban',
              dateAdded: new Date().toISOString().slice(0, 10)
            })
          }
        })

        // Combine unique
        const combined = [...localData]
        fromDb.forEach((dbItem) => {
          if (!combined.some((c) => c.itemId === dbItem.itemId && c.type === 'ban')) {
            combined.push(dbItem)
          }
        })

        setRestricted(combined)
      })
      .catch((e) => addToast(e.message, 'error'))
  }, [addToast])

  // Sync to localStorage
  const saveRestricted = (updated: RestrictedItem[]) => {
    setRestricted(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Filter items
  const filtered = useMemo(() => {
    return restricted.filter((item) => {
      const matchesTab = tab === 'all' || item.type === tab
      const query = search.toLowerCase()
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.batch.toLowerCase().includes(query) ||
        item.reason.toLowerCase().includes(query) ||
        (item.refNo && item.refNo.toLowerCase().includes(query))
      return matchesTab && matchesSearch
    })
  }, [restricted, tab, search])

  // Aggregate metrics
  const holdItems = restricted.filter((r) => r.type === 'hold')
  const banItems = restricted.filter((r) => r.type === 'ban')
  const totalHeldQty = holdItems.reduce((sum, r) => sum + Number(r.qty || 0), 0)
  const totalBannedQty = banItems.reduce((sum, r) => sum + Number(r.qty || 0), 0)
  const totalValue = restricted.reduce((sum, r) => sum + Number(r.qty || 0) * Number(r.purchaseRate || r.mrp || 0), 0)

  // Handle placing an item on hold/ban
  const handleSaveRestriction = async () => {
    if (!selectedItemId && !customName.trim()) {
      addToast('Please select or enter an item name', 'error')
      return
    }

    const matched = itemsList.find((i) => i.id === selectedItemId)
    const finalName = matched ? matched.name : customName.trim()
    const finalPacking = matched ? matched.packing : '10T'

    const newItem: RestrictedItem = {
      id: `res-${Date.now()}`,
      itemId: selectedItemId || undefined,
      name: finalName,
      packing: finalPacking,
      batch: batch || 'BATCH-01',
      expiry: expiry || '12/28',
      qty: Number(qty) || 1,
      mrp: Number(mrp) || 100,
      purchaseRate: Number(purchaseRate) || 80,
      reason: reason.trim() || 'QC Hold',
      refNo: refNo.trim() || undefined,
      type,
      dateAdded: new Date().toISOString().slice(0, 10)
    }

    const updated = [newItem, ...restricted]
    saveRestricted(updated)

    // If banned, update item status in ERP
    if (type === 'ban' && selectedItemId) {
      try {
        await patchErp('items', selectedItemId, { status: 'banned' })
      } catch {}
    }

    addToast(
      `Stock for ${finalName} placed on ${type === 'hold' ? 'Hold' : 'Banned Status'} successfully`,
      'success'
    )
    setShowModal(false)

    // Reset form
    setSelectedItemId('')
    setCustomName('')
    setBatch('')
    setExpiry('')
    setQty(10)
    setRefNo('')
  }

  // Handle release stock back to active inventory
  const handleReleaseStock = async (item: RestrictedItem) => {
    const updated = restricted.filter((r) => r.id !== item.id)
    saveRestricted(updated)

    if (item.type === 'ban' && item.itemId) {
      try {
        await patchErp('items', item.itemId, { status: 'active' })
      } catch {}
    }

    addToast(`Released ${item.name} (${item.batch}) back to active saleable inventory`, 'success')
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title="Hold / Banned Stock Register" subtitle="Restricted stock excluded from sales billing and dispatch" />

      {/* Screen Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hold / Ban Stock</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-rose-500" />
            Restricted inventory batches excluded from billing &amp; dispatch
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('hold-ban-stock', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition border border-border cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 h-9 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-rose-500/30 cursor-pointer"
          >
            <Plus size={16} /> Place Stock on Hold / Ban
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Total Restricted</span>
            <Layers size={13} className="text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono mt-1">
            {restricted.length} batches
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalHeldQty + totalBannedQty} total units locked
          </div>
        </div>

        <div className="bg-card border border-amber-500/20 rounded-xl p-4 shadow-sm bg-amber-500/5">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold flex items-center justify-between">
            <span>QC / Inspection Hold</span>
            <AlertTriangle size={13} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
            {holdItems.length} batches
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalHeldQty} units under quarantine
          </div>
        </div>

        <div className="bg-card border border-rose-500/20 rounded-xl p-4 shadow-sm bg-rose-500/5">
          <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold flex items-center justify-between">
            <span>Banned / Recalled</span>
            <Ban size={13} className="text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
            {banItems.length} batches
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalBannedQty} units prohibited
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Locked Stock Value</span>
            <Package size={13} className="text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono mt-1">
            {formatCurrency(totalValue)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Valued at purchase cost</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit shadow-xs">
          <button
            onClick={() => setTab('all')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All ({restricted.length})
          </button>
          <button
            onClick={() => setTab('hold')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'hold'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            QC Hold ({holdItems.length})
          </button>
          <button
            onClick={() => setTab('ban')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'ban'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Banned / Recall ({banItems.length})
          </button>
        </div>

        <div className="relative max-w-sm w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search medicine, batch, or notice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-indigo-600 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Main Table or Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {search
                ? 'No matching restricted items found'
                : 'No Inventory Currently on Hold or Banned'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {search
                ? `No restricted batches match "${search}". Try resetting your filter.`
                : 'All pharmaceutical batches in the warehouse are verified, approved, and currently eligible for sales billing.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus size={14} /> Place Stock on Hold / Ban
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[880px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                <th className="text-left px-4 py-3 min-w-[200px]">Medicine / Item</th>
                <th className="text-left px-3 py-3 w-28">Batch No</th>
                <th className="text-left px-3 py-3 w-24">Expiry</th>
                <th className="text-left px-3 py-3 w-32">Restriction Type</th>
                <th className="text-right px-3 py-3 w-24">Locked Qty</th>
                <th className="text-right px-3 py-3 w-28">Value (₹)</th>
                <th className="text-left px-4 py-3 min-w-[200px]">Reason &amp; Reference</th>
                <th className="text-right px-4 py-3 w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{r.name}</div>
                    {r.packing && (
                      <span className="text-[10px] text-muted-foreground font-normal">{r.packing}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-foreground">{r.batch}</td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">{r.expiry || '-'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 shadow-2xs',
                        r.type === 'hold'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      )}
                    >
                      {r.type === 'hold' ? <AlertTriangle size={11} /> : <Ban size={11} />}
                      {r.type === 'hold' ? 'QC Hold' : 'Banned / Recall'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                    {formatCurrency(r.qty * r.purchaseRate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="font-medium text-foreground">{r.reason}</div>
                    {r.refNo && (
                      <div className="text-[10px] font-mono text-muted-foreground">Ref: {r.refNo}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReleaseStock(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                      title="Release this batch back to active billing inventory"
                    >
                      <CheckCircle size={13} /> Release
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Place Stock on Hold / Ban Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto no-print"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-xl rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg">
                  <ShieldAlert size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">Place Stock on Hold or Ban</h3>
                  <p className="text-xs text-muted-foreground">
                    Immediately locks stock from billing and invoices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-3 text-xs">
              {/* Restriction Type Toggle */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Restriction Category *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('hold')
                      setReason('Under Quality Control (QC) Inspection')
                    }}
                    className={cn(
                      'p-2.5 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer',
                      type === 'hold'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                        : 'border-border bg-secondary/20 text-muted-foreground'
                    )}
                  >
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs">Quality / QC Hold</div>
                      <div className="text-[10px] font-normal opacity-80">Quarantine for lab inspection or seal check</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('ban')
                      setReason('Government / CDSCO Regulatory Banned Drug')
                    }}
                    className={cn(
                      'p-2.5 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer',
                      type === 'ban'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                        : 'border-border bg-secondary/20 text-muted-foreground'
                    )}
                  >
                    <Ban size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs">Banned / Recall</div>
                      <div className="text-[10px] font-normal opacity-80">Regulatory ban or manufacturer recall notice</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Medicine Select */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Select Product / Item *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value)
                    const found = itemsList.find((i) => i.id === e.target.value)
                    if (found) {
                      setBatch(found.batches?.[0]?.batch || 'BT' + String(Date.now()).slice(-4))
                      setExpiry(found.batches?.[0]?.expiry || '12/28')
                      setQty(found.stock || 10)
                      setMrp(found.mrp || 100)
                      setPurchaseRate(found.purchaseRate || 80)
                    }
                  }}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose from inventory stock --</option>
                  {itemsList.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.packing || '10T'}) - Stock: {it.stock || 0}
                    </option>
                  ))}
                </select>
                {!selectedItemId && (
                  <div className="mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Or enter custom item name:</span>
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol 500mg (Batch Specific)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-1.5 text-foreground outline-none focus:border-indigo-600"
                    />
                  </div>
                )}
              </div>

              {/* Batch, Expiry, Qty */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Batch No *
                  </label>
                  <input
                    type="text"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value.toUpperCase())}
                    placeholder="BATCH-01"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground uppercase outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Expiry (MM/YY)
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="12/28"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Hold Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground font-bold outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Purchase Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Reason for Restriction *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-indigo-600"
                >
                  <option value="Under Quality Control (QC) Inspection">Under Quality Control (QC) Inspection</option>
                  <option value="CDSCO / State Drug Controller Recall Notice">CDSCO / State Drug Controller Recall Notice</option>
                  <option value="Suspected Not of Standard Quality (NSQ)">Suspected Not of Standard Quality (NSQ)</option>
                  <option value="Broken Seal / Leakage / Physical Damage">Broken Seal / Leakage / Physical Damage</option>
                  <option value="Temperature Excursion during transit">Temperature Excursion during transit</option>
                  <option value="Government Banned Formulation">Government Banned Formulation</option>
                  <option value="Manufacturer Voluntary Recall">Manufacturer Voluntary Recall</option>
                </select>
              </div>

              {/* Circular / Reference No */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Notice / Circular / Lab Reference No
                </label>
                <input
                  type="text"
                  placeholder="e.g. CDSCO-RECALL/2026/045 or QC-LAB-89"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRestriction}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
              >
                Lock Stock from Billing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
