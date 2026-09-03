import { useState, useEffect } from 'react'
import { Search, Download, FileText, Eye } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { exportVisibleTables } from '../../lib/download'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface LedgerEntry {
  id: string
  date: string
  vType: string
  vNo: string
  debit: number
  credit: number
  balance: number
  narration: string
  balType: string
}

export default function LedgerView() {
  const [allEntries, setAllEntries] = useState<Array<LedgerEntry & { party: string }>>([])
  const [selectedLedger, setSelectedLedger] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  const handleCancel = async (e: any) => {
    const reason = prompt('Enter reason for cancellation:')
    if (reason === null) return
    if (!reason.trim()) {
      showToast('Cancellation reason is required.')
      return
    }

    try {
      let kind = ''
      if (e.vType === 'sale') kind = 'sales'
      else if (e.vType === 'purchase') kind = 'purchases'
      else if (e.vType === 'challan') kind = 'challans'

      if (!kind) {
        showToast('This transaction type cannot be cancelled.')
        return
      }

      await postErp('cancellations', { kind, id: e.id, reason })
      showToast('Transaction cancelled successfully.')
      
      // Reload
      const rows = await getErp<any[]>('ledgers')
      const balances: Record<string, number> = {}
      const mapped = rows.map((row) => {
        balances[row.party] = (balances[row.party] ?? 0) + Number(row.debit) - Number(row.credit)
        return {
          ...row,
          balance: Math.abs(balances[row.party]),
          balType: balances[row.party] < 0 ? 'Cr' : 'Dr',
          vType: String(row.vType).replace('_', ' ')
        }
      })
      setAllEntries(mapped)
      setSelectedTransaction(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel transaction.')
    }
  }

  useEffect(() => {
    getErp<any[]>('ledgers')
      .then((rows) => {
        const seenKeys = new Set<string>()
        const deduped = (rows || []).filter((r) => {
          const dr = Number(r.debit || 0)
          const cr = Number(r.credit || 0)
          if (dr <= 0 && cr <= 0) return false
          if (isNaN(dr) && isNaN(cr)) return false
          const key = `${(r.vNo || r.id || '').trim()}_${(r.party || '').trim()}_${dr}_${cr}`
          if (seenKeys.has(key)) return false
          seenKeys.add(key)
          return true
        })

        const balances: Record<string, number> = {}
        const mapped = deduped.map((row) => {
          balances[row.party] = (balances[row.party] ?? 0) + Number(row.debit) - Number(row.credit)
          return {
            ...row,
            balance: Math.abs(balances[row.party]),
            balType: balances[row.party] < 0 ? 'Cr' : 'Dr',
            vType: String(row.vType).replace('_', ' ')
          }
        })
        setAllEntries(mapped)
        if (mapped[0]) setSelectedLedger(mapped[0].party)
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  const ledgerNames = [...new Set(allEntries.map((entry) => entry.party))]
  const entries = allEntries.filter((entry) => entry.party === selectedLedger)
  const filtered = entries.filter((e) => e.narration.toLowerCase().includes(search.toLowerCase()) || e.vNo.toLowerCase().includes(search.toLowerCase()))
  const lastBalance = filtered.length > 0 ? filtered[filtered.length - 1] : null

  return (
    <div className="p-6 space-y-4">
      <PrintHeader title={`General Ledger: ${selectedLedger || 'All'}`} />
      {/* Header Block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ledger View</h1>
          <p className="text-sm text-muted-foreground mt-1">{selectedLedger || 'Select a ledger'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-sm font-semibold shadow-sm transition border border-border"
          >
            <FileText size={16} /> Export PDF
          </button>
          <button
            onClick={() => exportVisibleTables(`ledger-${selectedLedger || 'all'}`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition border border-primary/20"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Left Side Ledgers list */}
        <div className="md:col-span-1 bg-card border border-border rounded-xl p-4 shadow-sm h-fit no-print">
          <div className="text-xs text-muted-foreground uppercase font-semibold mb-3">Ledger Accounts</div>
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {ledgerNames.map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLedger(l)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition font-medium',
                  selectedLedger === l
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side Ledger view */}
        <div className="md:col-span-3 space-y-4">
          {/* KPI summaries */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Debit</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(entries.reduce((a, e) => a + e.debit, 0))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Credit</div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                {formatCurrency(entries.reduce((a, e) => a + e.credit, 0))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Current Balance</div>
              {lastBalance && (
                <div className={cn('text-lg font-bold mt-1', lastBalance.balType === 'Dr' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400')}>
                  {formatCurrency(lastBalance.balance)} {lastBalance.balType}
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm no-print">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
              className="w-full pr-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition"
            />
          </div>

          {/* Ledger Table Grid */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Voucher</th>
                  <th className="text-right px-4 py-3 font-semibold w-24">Debit</th>
                  <th className="text-right px-4 py-3 font-semibold w-24">Credit</th>
                  <th className="text-right px-4 py-3 font-semibold w-32">Balance</th>
                  <th className="text-left px-4 py-3 font-semibold">Narration</th>
                  <th className="text-right px-4 py-3 font-semibold w-24 no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-3 text-foreground">{e.vType}</td>
                    <td className="px-4 py-3 font-mono text-foreground font-semibold">{e.vNo}</td>
                    <td className="px-4 py-3 text-right font-mono">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                     <td className={cn('px-4 py-3 text-right font-mono font-medium', e.balType === 'Dr' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400')}>
                      {formatCurrency(e.balance)} {e.balType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.narration}</td>
                    <td className="px-4 py-3 text-right no-print">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label="View Details"
                          onClick={() => setSelectedTransaction(e)}
                          className="p-1 text-muted-foreground hover:text-foreground transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        {['sale', 'purchase', 'challan'].includes(e.vType) &&
                          !e.narration.toLowerCase().includes('cancelled') && (
                            <button
                              aria-label="Cancel Transaction"
                              onClick={() => handleCancel(e)}
                              className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 rounded text-[10px] font-semibold transition"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="bg-card border border-border w-full max-w-md rounded-xl p-6 shadow-xl space-y-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {selectedTransaction.vType}
                </span>
                <h2 className="text-lg font-bold text-foreground mt-2">
                  Voucher: {selectedTransaction.vNo}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Posted Date: {selectedTransaction.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition"
              >
                Close
              </button>
            </div>

            <div className="border-t border-border pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ledger Account:</span>
                <span className="font-medium text-foreground">{selectedTransaction.party}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Debit Amount:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {selectedTransaction.debit > 0 ? formatCurrency(selectedTransaction.debit) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Amount:</span>
                <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                  {selectedTransaction.credit > 0 ? formatCurrency(selectedTransaction.credit) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cumulative Balance:</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(selectedTransaction.balance)} {selectedTransaction.balType}
                </span>
              </div>
              <div className="pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground block mb-1">Narration / Status:</span>
                <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/40 leading-relaxed italic">
                  {selectedTransaction.narration}
                </p>
              </div>
            </div>

            {['sale', 'purchase', 'challan'].includes(selectedTransaction.vType) &&
              !selectedTransaction.narration.toLowerCase().includes('cancelled') && (
                <div className="pt-4 border-t border-border flex justify-end">
                  <button
                    onClick={() => handleCancel(selectedTransaction)}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-sm font-semibold shadow-md transition"
                  >
                    Cancel Transaction
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
