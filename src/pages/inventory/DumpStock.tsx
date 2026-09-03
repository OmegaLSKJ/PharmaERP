import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  FileText,
  Download,
  Search,
  Plus,
  Trash2,
  Undo2,
  ShieldCheck,
  Package,
  Layers,
  X,
  CheckCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'
import { getErp, postErp } from '../../lib/erpApi'

export interface DumpItem {
  id: string
  itemId?: string
  name: string
  packing?: string
  batch: string
  expiry: string
  qty: number
  mrp: number
  rate: number
  category: 'expired' | 'dead' | 'breakage'
  reason: string
  dateAdded: string
  status: 'pending' | 'written_off' | 'returned'
}

const STORAGE_KEY = 'pharma_erp_dump_stock_manual'

export default function DumpStock() {
  const navigate = useNavigate()
  const [itemsList, setItemsList] = useState<any[]>([])
  const [salesList, setSalesList] = useState<any[]>([])
  const [dumpItems, setDumpItems] = useState<DumpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'expired' | 'dead' | 'breakage'>('all')
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
  const [rate, setRate] = useState(75)
  const [category, setCategory] = useState<'expired' | 'dead' | 'breakage'>('expired')
  const [reason, setReason] = useState('Expired stock on shelf')

  // Parse expiry helper
  const isExpired = (expStr?: string): boolean => {
    if (!expStr) return false
    try {
      const now = new Date()
      // Case 1: MM/YY or MM/YYYY
      if (expStr.includes('/')) {
        const [m, y] = expStr.split('/')
        const fullYear = y.length === 2 ? 2000 + Number(y) : Number(y)
        const expDate = new Date(fullYear, Number(m), 0) // End of that month
        return expDate < now
      }
      // Case 2: YYYY-MM-DD
      const parsed = new Date(expStr)
      if (!isNaN(parsed.getTime())) {
        return parsed < now
      }
    } catch {}
    return false
  }

  // Load and link inventory, sales, and dump records
  const loadData = () => {
    setLoading(true)
    Promise.all([
      getErp<any[]>('items').catch(() => []),
      getErp<any[]>('sales').catch(() => []),
      getErp<any[]>('breakages').catch(() => [])
    ])
      .then(([items, sales, breakages]) => {
        const prods = items || []
        setItemsList(prods)
        setSalesList(sales || [])

        // Map sold units by item name
        const soldCountMap = new Map<string, number>()
        ;(sales || []).forEach((s: any) => {
          ;(s.lines || []).forEach((l: any) => {
            const n = (l.name || l.itemName || '').toLowerCase()
            soldCountMap.set(n, (soldCountMap.get(n) || 0) + Number(l.qty || 0))
          })
        })

        // 1. Auto-detect from active stock
        const autoDetected: DumpItem[] = []

        prods.forEach((item: any) => {
          const itemMrp = Number(item.mrp || 100)
          const itemRate = Number(item.purchaseRate || item.saleRate * 0.8 || 75)
          const itemName = item.name || 'Medicine'
          const packing = item.packing || '10T'
          const batches = item.batches && item.batches.length > 0
            ? item.batches
            : [{ batch: 'DEFAULT', expiry: item.expiry || '', stock: item.stock || 0, mrp: itemMrp }]

          batches.forEach((b: any, bIdx: number) => {
            const bStock = Number(b.stock || (bIdx === 0 ? item.stock : 0) || 0)
            if (bStock <= 0) return

            const bExp = b.expiry || ''
            const bMrp = Number(b.mrp || itemMrp)
            const bRate = Number(b.purchaseRate || itemRate)

            // Condition A: Expired Batch
            if (bExp && isExpired(bExp)) {
              autoDetected.push({
                id: `auto-exp-${item.id}-${b.batch || bIdx}`,
                itemId: item.id,
                name: itemName,
                packing,
                batch: b.batch || 'BT-EXP',
                expiry: bExp,
                qty: bStock,
                mrp: bMrp,
                rate: bRate,
                category: 'expired',
                reason: 'Expired beyond shelf life (Mandatory write-off/return)',
                dateAdded: new Date().toISOString().slice(0, 10),
                status: 'pending'
              })
            }
            // Condition B: Dead / Dormant Inventory (Stock > 0 and 0 sales recorded)
            else if (bStock > 10 && (soldCountMap.get(itemName.toLowerCase()) || 0) === 0) {
              autoDetected.push({
                id: `auto-dead-${item.id}-${b.batch || bIdx}`,
                itemId: item.id,
                name: itemName,
                packing,
                batch: b.batch || 'BT-SLOW',
                expiry: bExp || '12/28',
                qty: bStock,
                mrp: bMrp,
                rate: bRate,
                category: 'dead',
                reason: 'Zero sales movement in software (> 90 days dormant)',
                dateAdded: new Date().toISOString().slice(0, 10),
                status: 'pending'
              })
            }
          })
        })

        // 2. Add records from breakages API
        ;(breakages || []).forEach((brk: any, idx: number) => {
          autoDetected.push({
            id: brk.id || `brk-${idx}`,
            name: brk.name || brk.itemName || 'Broken / Damaged Stock',
            packing: brk.packing || '10T',
            batch: brk.batch || 'BT-BRK',
            expiry: brk.expiry || '-',
            qty: Number(brk.qty || 1),
            mrp: Number(brk.mrp || 100),
            rate: Number(brk.rate || 75),
            category: 'breakage',
            reason: brk.reason || 'Transit breakage / packaging leakage',
            dateAdded: brk.date || new Date().toISOString().slice(0, 10),
            status: 'written_off'
          })
        })

        // 3. Add manual user-flagged items from localStorage
        const savedManual = localStorage.getItem(STORAGE_KEY)
        let manualList: DumpItem[] = []
        if (savedManual) {
          try {
            manualList = JSON.parse(savedManual)
          } catch {}
        }

        const combinedMap = new Map<string, DumpItem>()
        ;[...autoDetected, ...manualList].forEach((item) => {
          combinedMap.set(item.id, item)
        })

        setDumpItems(Array.from(combinedMap.values()))
        setLoading(false)
      })
      .catch((e) => {
        addToast(e.message, 'error')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Save manual items to localStorage
  const syncManual = (updated: DumpItem[]) => {
    setDumpItems(updated)
    const manualOnly = updated.filter((i) => i.id.startsWith('manual-'))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manualOnly))
  }

  // Filter items
  const filtered = useMemo(() => {
    return dumpItems.filter((d) => {
      const matchTab = tab === 'all' || d.category === tab
      const q = search.toLowerCase()
      const matchSearch =
        d.name.toLowerCase().includes(q) ||
        d.batch.toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [dumpItems, tab, search])

  // Metric totals
  const totalPurchaseLost = filtered.reduce((a, d) => a + d.qty * d.rate, 0)
  const totalMrpLost = filtered.reduce((a, d) => a + d.qty * d.mrp, 0)
  const totalQty = filtered.reduce((a, d) => a + d.qty, 0)
  const shortfall = Math.max(0, totalMrpLost - totalPurchaseLost)
  const costRecoveryPct = totalMrpLost > 0 ? Math.round((totalPurchaseLost / totalMrpLost) * 100) : 0

  // Handle Mark Stock as Dump / Breakage
  const handleAddDump = async () => {
    if (!selectedItemId && !customName.trim()) {
      addToast('Please select or enter an item name', 'error')
      return
    }

    const matched = itemsList.find((i) => i.id === selectedItemId)
    const finalName = matched ? matched.name : customName.trim()
    const finalPacking = matched ? matched.packing : '10T'

    const newItem: DumpItem = {
      id: `manual-${Date.now()}`,
      itemId: selectedItemId || undefined,
      name: finalName,
      packing: finalPacking,
      batch: batch || 'BATCH-01',
      expiry: expiry || '01/26',
      qty: Number(qty) || 1,
      mrp: Number(mrp) || 100,
      rate: Number(rate) || 75,
      category,
      reason: reason.trim() || 'Expired / Damaged stock',
      dateAdded: new Date().toISOString().slice(0, 10),
      status: 'pending'
    }

    const updated = [newItem, ...dumpItems]
    syncManual(updated)

    // Also persist to backend breakages endpoint if applicable
    try {
      await postErp('breakages', {
        name: finalName,
        batch: newItem.batch,
        expiry: newItem.expiry,
        qty: newItem.qty,
        rate: newItem.rate,
        mrp: newItem.mrp,
        reason: newItem.reason,
        date: newItem.dateAdded
      })
    } catch {}

    addToast(`Marked ${finalName} (${newItem.batch}) as Dump / Dead Stock`, 'success')
    setShowModal(false)

    // Reset fields
    setSelectedItemId('')
    setCustomName('')
    setBatch('')
    setExpiry('')
    setQty(10)
  }

  // Handle write-off
  const handleWriteOff = (item: DumpItem) => {
    const updated = dumpItems.map((d) =>
      d.id === item.id ? { ...d, status: 'written_off' as const } : d
    )
    syncManual(updated)
    addToast(`Stock for ${item.name} written off from books`, 'success')
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader
        title="Dump / Dead Stock Report"
        subtitle="Auto-linked expired, unsaleable, and dormant inventory requiring write-off or return"
      />

      {/* Screen Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dump / Dead Stock Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Auto-linked expired, unsaleable, and zero-movement stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 h-9 px-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-semibold shadow-xs transition border border-border cursor-pointer"
            title="Refresh live stock analysis"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            <span>Sync Stock</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-3.5 bg-gradient-to-b from-zinc-900 to-black hover:from-zinc-800 hover:to-neutral-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition border border-neutral-700 hover:border-neutral-500 cursor-pointer"
          >
            <FileText size={15} /> Export PDF
          </button>
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('dump-stock-report', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition border border-border cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-amber-500/30 cursor-pointer"
          >
            <Plus size={16} /> Mark Stock as Dump / Breakage
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Dump Items</div>
          <div className="text-xl font-bold text-amber-500 font-mono mt-1">{filtered.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Batches affected</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Qty</div>
          <div className="text-xl font-bold text-foreground font-mono mt-1">{totalQty.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Units unsaleable</div>
        </div>

        <div className="bg-card border border-rose-500/20 bg-rose-500/5 rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Purchase Value Lost</div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
            {formatCurrency(totalPurchaseLost)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Direct cost to business</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">MRP Value Lost</div>
          <div className="text-xl font-bold text-foreground font-mono mt-1">
            {formatCurrency(totalMrpLost)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Retail potential</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Shortfall vs MRP</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {formatCurrency(shortfall)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Trade margin lost</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Cost Recovery %</div>
          <div className="text-xl font-bold text-indigo-500 font-mono mt-1">{costRecoveryPct}%</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Eligible via Debit Note</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit shadow-xs">
          <button
            onClick={() => setTab('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All ({dumpItems.length})
          </button>
          <button
            onClick={() => setTab('expired')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'expired'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Expired Batches ({dumpItems.filter((d) => d.category === 'expired').length})
          </button>
          <button
            onClick={() => setTab('dead')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'dead'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Dead / Dormant ({dumpItems.filter((d) => d.category === 'dead').length})
          </button>
          <button
            onClick={() => setTab('breakage')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'breakage'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Breakages ({dumpItems.filter((d) => d.category === 'breakage').length})
          </button>
        </div>

        <div className="relative max-w-sm w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search medicine, batch, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-indigo-600 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Table or Reassuring Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {search ? 'No matching dump/dead items found' : 'No Dump or Expired Stock Found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {search
                ? `No items match your search for "${search}".`
                : 'All pharmaceutical batches in the system are currently within valid shelf life and actively moving.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus size={14} /> Manually Flag an Item as Dump
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                <th className="text-left px-4 py-3 min-w-[200px]">Item / Description</th>
                <th className="text-left px-3 py-3 w-28">Batch</th>
                <th className="text-left px-3 py-3 w-24">Expiry</th>
                <th className="text-left px-3 py-3 w-28">Category</th>
                <th className="text-right px-3 py-3 w-20">Qty</th>
                <th className="text-right px-3 py-3 w-24">MRP</th>
                <th className="text-right px-3 py-3 w-24">Rate</th>
                <th className="text-right px-4 py-3 w-28">Value Lost</th>
                <th className="text-left px-4 py-3 min-w-[180px]">Reason</th>
                <th className="text-right px-4 py-3 w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{d.name}</div>
                    {d.packing && (
                      <span className="text-[10px] text-muted-foreground font-normal">{d.packing}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-foreground">{d.batch}</td>
                  <td
                    className={cn(
                      'px-3 py-3 font-mono font-medium',
                      d.category === 'expired' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground'
                    )}
                  >
                    {d.expiry}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1',
                        d.category === 'expired' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30',
                        d.category === 'dead' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
                        d.category === 'breakage' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                      )}
                    >
                      {d.category}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
                    {d.qty.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(d.mrp)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(d.rate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {formatCurrency(d.qty * d.rate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">
                    <div className="line-clamp-1" title={d.reason}>{d.reason}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => navigate('/transactions/purchase-return')}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-semibold transition"
                        title="Return to Supplier via Debit Note"
                      >
                        <ExternalLink size={13} />
                      </button>
                      {d.status !== 'written_off' ? (
                        <button
                          onClick={() => handleWriteOff(d)}
                          className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                          title="Write off from balance sheet"
                        >
                          Write Off
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                          <CheckCircle size={11} className="text-emerald-500" /> Done
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Flag Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto no-print"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">Mark Stock as Dump / Breakage</h3>
                  <p className="text-xs text-muted-foreground">Isolates inventory from active billing</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Category */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Dump Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['expired', 'dead', 'breakage'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCategory(cat)
                        if (cat === 'expired') setReason('Expired stock on warehouse shelf')
                        if (cat === 'dead') setReason('Dead stock with zero sales velocity')
                        if (cat === 'breakage') setReason('Damaged / Broken packaging in storage')
                      }}
                      className={cn(
                        'p-2 rounded-xl border text-center font-bold capitalize transition cursor-pointer',
                        category === cat
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-border bg-secondary/20 text-muted-foreground'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Medicine Select */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Select Product *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value)
                    const found = itemsList.find((i) => i.id === e.target.value)
                    if (found) {
                      setBatch(found.batches?.[0]?.batch || 'BT' + String(Date.now()).slice(-4))
                      setExpiry(found.batches?.[0]?.expiry || '01/26')
                      setQty(found.stock || 5)
                      setMrp(found.mrp || 100)
                      setRate(found.purchaseRate || 75)
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
                    <span className="text-[10px] text-muted-foreground">Or type product name:</span>
                    <input
                      type="text"
                      placeholder="e.g. Cough Syrup 100ml"
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
                    Batch *
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
                    Expiry
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Qty *
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
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
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

              {/* Reason */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Reason for Write-Off *
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Expired on shelf or damaged seal"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-indigo-600"
                />
              </div>
            </div>

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
                onClick={handleAddDump}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
              >
                Confirm Dump Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
