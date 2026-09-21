import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, BookOpen } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { exportVisibleTables } from '../../lib/download'
import { useUIStore } from '../../store/uiStore'
import PrintHeader from '../../components/layout/PrintHeader'

interface BookEntry {
  id: string
  date: string
  vType: string
  vNo: string
  physicalVchNo?: string
  ledger: string
  debit: number
  credit: number
  narration: string
}

const BOOK_TYPES = [
  { key: 'All',       label: 'All Books',       color: 'bg-slate-700 text-white border-slate-600' },
  { key: 'Receipt',   label: 'Receipt Book',   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'Payment',   label: 'Payment Book',   color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { key: 'Journal',   label: 'Journal Book',   color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { key: 'Contra',    label: 'Contra Book',    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { key: 'Sale',      label: 'Sale Book',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'Purchase',  label: 'Purchase Book',  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { key: 'Challan',   label: 'Challan Book',   color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { key: 'DebitNote', label: 'Debit Note Book',color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { key: 'CreditNote',label: 'Credit Note Book',color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
]

const TYPE_BADGE: Record<string, string> = {
  Receipt:    'bg-emerald-500/10 text-emerald-400',
  Payment:    'bg-rose-500/10 text-rose-400',
  Journal:    'bg-amber-500/10 text-amber-400',
  Contra:     'bg-cyan-500/10 text-cyan-400',
  Sale:       'bg-blue-500/10 text-blue-400',
  Purchase:   'bg-purple-500/10 text-purple-400',
  Challan:    'bg-teal-500/10 text-teal-400',
  DebitNote:  'bg-orange-500/10 text-orange-400',
  CreditNote: 'bg-pink-500/10 text-pink-400',
}

export default function SelectedBook() {
  const [allEntries, setAllEntries] = useState<BookEntry[]>([])
  const [selectedType, setSelectedType] = useState('All')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    Promise.all([getErp<any[]>('ledgers'), getErp<any[]>('challans')])
      .then(([rows, challans]) => {
        const seenKeys = new Set<string>()
        const deduped = (rows || []).filter((r) => {
          const dr = Number(r.debit || 0)
          const cr = Number(r.credit || 0)
          if (dr <= 0 && cr <= 0) return false
          const key = `${(r.vNo || r.id || '').trim()}_${(r.party || '').trim()}_${dr}_${cr}`
          if (seenKeys.has(key)) return false
          seenKeys.add(key)
          return true
        })
        const ledgerEntries = deduped.map((row) => ({
            id: row.id,
            date: row.date,
            vType: String(row.vType || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            vNo: row.vNo,
            physicalVchNo: row.physicalVchNo || '',
            ledger: row.party,
            debit: Number(row.debit),
            credit: Number(row.credit),
            narration: row.narration,
          }))
        const challanEntries = (challans || []).map((row) => ({
          id: `challan-${row.dbId || row.id}`,
          date: row.date,
          vType: 'Challan',
          vNo: row.id,
          physicalVchNo: row.transport || '',
          ledger: row.party || 'Walk-in customer',
          debit: (row.lines || []).reduce((sum: number, line: any) => sum + Number(line.qty || 0) * Number(line.rate || 0), 0),
          credit: 0,
          narration: `Delivery challan${row.status ? ` · ${row.status}` : ''}`,
        }))
        setAllEntries([...ledgerEntries, ...challanEntries])
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  const filtered = allEntries.filter((d) => {
    if (selectedType !== 'All') {
      const normD = d.vType.replace(/[\s_-]/g, '').toLowerCase()
      const normSel = selectedType.replace(/[\s_-]/g, '').toLowerCase()
      if (normD !== normSel) return false
    }
    if (dateFrom && d.date < dateFrom) return false
    if (dateTo && d.date > dateTo) return false
    const q = search.toLowerCase()
    return (
      d.ledger?.toLowerCase().includes(q) ||
      d.vNo?.toLowerCase().includes(q) ||
      d.narration?.toLowerCase().includes(q) ||
      (d.physicalVchNo || '').toLowerCase().includes(q)
    )
  })

  const totalDr = filtered.reduce((a, d) => a + d.debit, 0)
  const totalCr = filtered.reduce((a, d) => a + d.credit, 0)

  const currentBook = BOOK_TYPES.find((b) => b.key === selectedType) ?? BOOK_TYPES[0]

  return (
    <div className="p-6 space-y-5">
      <PrintHeader title={`${currentBook.label} — Selected Book`} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BookOpen size={22} className="text-indigo-400" />
            Excel Book View
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Spreadsheet view for receipts, payments, sales, purchases, challans, and vouchers
          </p>
        </div>
        <button
          onClick={() => exportVisibleTables('selected-book', useUIStore.getState().company)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition border border-slate-700"
        >
          <Download size={16} /> Export Excel (CSV)
        </button>
      </div>

      {/* Book type picker cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {BOOK_TYPES.map((b) => (
          <button
            key={b.key}
            onClick={() => setSelectedType(b.key)}
            className={cn(
              'px-3 py-2.5 rounded-xl border text-xs font-semibold transition text-center leading-tight',
              selectedType === b.key
                ? b.color + ' ring-2 ring-offset-1 ring-offset-slate-950 ring-indigo-500 shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ledger, voucher, narration…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Entries', value: filtered.length, mono: false },
          { label: 'Total Debit', value: formatCurrency(totalDr), mono: true },
          { label: 'Total Credit', value: formatCurrency(totalCr), mono: true },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400 font-medium mb-1">{s.label}</div>
            <div className={cn('text-lg font-bold text-white', s.mono && 'font-mono')}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className={cn('text-sm font-bold px-3 py-1 rounded-lg border', currentBook.color)}>
            {currentBook.label}
          </h2>
          <span className="text-xs text-slate-500">{filtered.length} records</span>
        </div>
        <table className="w-full text-xs border-collapse" id="selected-book">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Book</th>
              <th className="text-left px-4 py-3 font-medium">Voucher No</th>
              <th className="text-left px-4 py-3 font-medium">Phys. Vch No</th>
              <th className="text-left px-4 py-3 font-medium">Ledger / Party</th>
              <th className="text-right px-4 py-3 font-medium">Debit</th>
              <th className="text-right px-4 py-3 font-medium">Credit</th>
              <th className="text-left px-4 py-3 font-medium">Narration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No entries found for <span className="font-semibold text-slate-400">{currentBook.label}</span>
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-mono text-slate-400">{d.date}</td>
                  <td className="px-4 py-3"><span className={cn('rounded px-2 py-1 text-[10px] font-semibold', TYPE_BADGE[d.vType] || 'bg-slate-800 text-slate-300')}>{d.vType}</span></td>
                  <td className="px-4 py-3 font-mono">
                    <Link
                      to={
                        d.vType.toLowerCase().includes('sale')
                          ? `/transactions/sale/edit/${encodeURIComponent(d.vNo)}`
                          : d.vType.toLowerCase().includes('purchase')
                          ? `/transactions/purchase/edit/${encodeURIComponent(d.vNo)}`
                          : `/accounting/vouchers?vNo=${encodeURIComponent(d.vNo)}&type=${encodeURIComponent(d.vType)}&party=${encodeURIComponent(d.ledger)}`
                      }
                      className="text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {d.vNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-indigo-400 text-[11px]">{d.physicalVchNo || '—'}</td>
                  <td className="px-4 py-3 font-medium text-white">{d.ledger}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
                    {d.debit > 0 ? formatCurrency(d.debit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-rose-400">
                    {d.credit > 0 ? formatCurrency(d.credit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{d.narration}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/80 border-t border-slate-700 text-white font-bold text-xs">
              <td colSpan={5} className="px-4 py-3">Total ({filtered.length} entries)</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(totalDr)}</td>
              <td className="px-4 py-3 text-right font-mono text-rose-400">{formatCurrency(totalCr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
