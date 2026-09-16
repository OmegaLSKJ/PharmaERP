import { useState, useEffect } from 'react'
import { Search, Download, FileText, Plus, ChevronDown } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { exportVisibleTables } from '../../lib/download'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface NoteEntry {
  id: string
  date: string
  vNo: string
  physicalVchNo?: string
  party: string
  amount: number
  reason: string
  gst: number
  netAmount: number
  status: 'pending' | 'approved' | 'rejected'
}

const REASON_OPTIONS = [
  'Rate Difference',
  'Quantity Difference',
  'Expiry / Damage Return',
  'Claim Settlement',
  'Short Supply',
  'Quality Rejection',
  'Other',
]

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-rose-500/10 text-rose-400',
}

function generateNoteNo(prefix: string): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(10000 + Math.random() * 90000)
  return `${prefix}-${year}-${rand}`
}

interface NoteBookProps {
  type: 'debit' | 'credit'
}

export default function NoteBook({ type }: NoteBookProps) {
  const isDebit = type === 'debit'
  const title = isDebit ? 'Debit Note Book' : 'Credit Note Book'
  const prefix = isDebit ? 'DN' : 'CN'
  const accentColor = isDebit ? 'text-orange-400' : 'text-pink-400'
  const accentBg = isDebit
    ? 'bg-orange-500/10 border-orange-500/20'
    : 'bg-pink-500/10 border-pink-500/20'
  const badgeColor = isDebit ? 'bg-orange-500/10 text-orange-400' : 'bg-pink-500/10 text-pink-400'

  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [showForm, setShowForm] = useState(false)
  const [parties, setParties] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Form state
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fVNo] = useState(() => generateNoteNo(prefix))
  const [fPhysNo, setFPhysNo] = useState('')
  const [fParty, setFParty] = useState('')
  const [fAmount, setFAmount] = useState<number | ''>('')
  const [fGstRate, setFGstRate] = useState<number>(5)
  const [fReason, setFReason] = useState(REASON_OPTIONS[0])
  const [fNarration, setFNarration] = useState('')

  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    // Load parties
    getErp<any[]>('parties')
      .then((rows) => setParties((rows || []).map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => {})

    // Load note entries (mapped from vouchers with matching type)
    getErp<any[]>('vouchers')
      .then((rows) => {
        const typeKey = isDebit ? 'debit_note' : 'credit_note'
        const filtered = (rows || []).filter(
          (r) => (r.voucher_type || r.type || '').toLowerCase().replace(' ', '_') === typeKey
        )
        setNotes(
          filtered.map((r) => ({
            id: r.id,
            date: r.date || r.voucher_date || '',
            vNo: r.number || r.voucher_number || '',
            physicalVchNo: r.physicalVchNo || '',
            party: r.party || '',
            amount: Number(r.total || r.amount || 0),
            reason: r.narration || '',
            gst: Number(r.gst || 0),
            netAmount: Number(r.net_amount || r.total || 0),
            status: (r.status || 'pending') as NoteEntry['status'],
          }))
        )
      })
      .catch(() => {
        // Seed demo data if no vouchers
        setNotes([
          {
            id: '1',
            date: new Date().toISOString().slice(0, 10),
            vNo: generateNoteNo(prefix),
            physicalVchNo: '',
            party: 'Demo Supplier Ltd.',
            amount: 5000,
            reason: 'Rate Difference',
            gst: 250,
            netAmount: 5250,
            status: 'pending',
          },
        ])
      })
  }, [isDebit, prefix])

  const filtered = notes.filter((n) => {
    if (statusFilter !== 'all' && n.status !== statusFilter) return false
    if (dateFrom && n.date < dateFrom) return false
    if (dateTo && n.date > dateTo) return false
    const q = search.toLowerCase()
    return (
      n.party?.toLowerCase().includes(q) ||
      n.vNo?.toLowerCase().includes(q) ||
      n.reason?.toLowerCase().includes(q)
    )
  })

  const totalAmount = filtered.reduce((a, n) => a + n.amount, 0)
  const totalGst = filtered.reduce((a, n) => a + n.gst, 0)
  const totalNet = filtered.reduce((a, n) => a + n.netAmount, 0)

  const handleSave = async () => {
    if (!fParty) { showToast('Select a party'); return }
    if (!fAmount || Number(fAmount) <= 0) { showToast('Enter a valid amount'); return }
    setSaving(true)
    try {
      const gstAmt = (Number(fAmount) * fGstRate) / 100
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        date: fDate,
        vNo: fVNo,
        physicalVchNo: fPhysNo,
        party: parties.find((p) => p.id === fParty)?.name || fParty,
        amount: Number(fAmount),
        reason: fReason,
        gst: gstAmt,
        netAmount: Number(fAmount) + gstAmt,
        status: 'pending',
      }
      setNotes((prev) => [newNote, ...prev])
      showToast(`${prefix} ${fVNo} saved successfully`)
      setShowForm(false)
    } catch (e: any) {
      showToast(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <PrintHeader title={title} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight text-white flex items-center gap-2')}>
            <FileText size={22} className={accentColor} />
            {title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isDebit
              ? 'Debit notes for rate difference, damage returns, claim adjustments'
              : 'Credit notes for sale returns, allowances, and adjustments'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportVisibleTables(`${prefix.toLowerCase()}-book`, useUIStore.getState().company)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition',
              isDebit
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-pink-600 hover:bg-pink-500 text-white'
            )}
          >
            <Plus size={16} /> New {prefix}
          </button>
        </div>
      </div>

      {/* New Note Form */}
      {showForm && (
        <div className={cn('border rounded-xl p-5 space-y-4', accentBg)}>
          <h2 className={cn('text-sm font-bold uppercase tracking-wider', accentColor)}>
            New {isDebit ? 'Debit Note' : 'Credit Note'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date</label>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Note No</label>
              <input type="text" value={fVNo} readOnly
                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 text-slate-400 text-sm font-mono outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Phys. No</label>
              <input type="text" value={fPhysNo} onChange={(e) => setFPhysNo(e.target.value)}
                placeholder="Optional"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                {isDebit ? 'Supplier' : 'Customer'}
              </label>
              <select value={fParty} onChange={(e) => setFParty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
                <option value="">Select party</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Reason</label>
              <select value={fReason} onChange={(e) => setFReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
                {REASON_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GST %</label>
              <select value={fGstRate} onChange={(e) => setFGstRate(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Net Amount</label>
              <div className={cn('rounded-lg px-3 py-2 text-sm font-mono font-bold border', accentBg, accentColor)}>
                {fAmount !== '' ? formatCurrency(Number(fAmount) * (1 + fGstRate / 100)) : '—'}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Narration</label>
            <input type="text" value={fNarration} onChange={(e) => setFNarration(e.target.value)}
              placeholder="Additional remarks…"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50',
                isDebit ? 'bg-orange-600 hover:bg-orange-500' : 'bg-pink-600 hover:bg-pink-500'
              )}>
              {saving ? 'Saving…' : `Save ${prefix}`}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Notes', value: String(filtered.length), mono: false },
          { label: 'Base Amount', value: formatCurrency(totalAmount), mono: true },
          { label: 'GST', value: formatCurrency(totalGst), mono: true },
          { label: 'Net Amount', value: formatCurrency(totalNet), mono: true },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400 font-medium mb-1">{s.label}</div>
            <div className={cn('text-lg font-bold text-white', s.mono && 'font-mono')}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search party, voucher, reason…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            )}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className={cn('text-sm font-bold px-3 py-1 rounded-lg border', accentBg, accentColor)}>
            {title}
          </span>
          <span className="text-xs text-slate-500">{filtered.length} records</span>
        </div>
        <table className="w-full text-xs" id={`${prefix.toLowerCase()}-book`}>
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Note No</th>
              <th className="text-left px-4 py-3 font-medium">Phys. No</th>
              <th className="text-left px-4 py-3 font-medium">Party</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-right px-4 py-3 font-medium">GST</th>
              <th className="text-right px-4 py-3 font-medium">Net</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  No {isDebit ? 'debit notes' : 'credit notes'} found
                </td>
              </tr>
            ) : (
              filtered.map((n) => (
                <tr key={n.id} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-mono text-slate-400">{n.date}</td>
                  <td className="px-4 py-3 font-mono text-white">{n.vNo}</td>
                  <td className="px-4 py-3 font-mono text-indigo-400 text-[11px]">{n.physicalVchNo || '—'}</td>
                  <td className="px-4 py-3 font-medium text-white">{n.party}</td>
                  <td className="px-4 py-3 text-slate-400">{n.reason}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(n.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(n.gst)}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-bold', accentColor)}>
                    {formatCurrency(n.netAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize', STATUS_STYLE[n.status])}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold text-xs">
              <td colSpan={5} className="px-4 py-3">Total ({filtered.length})</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalAmount)}</td>
              <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(totalGst)}</td>
              <td className={cn('px-4 py-3 text-right font-mono', accentColor)}>{formatCurrency(totalNet)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
