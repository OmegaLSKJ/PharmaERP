import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Edit2, Trash2, FileText, Download, Printer, Landmark, ArrowUpRight, ArrowDownLeft, Calendar, Filter, X } from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn, formatCurrency } from '../../../lib/utils'
import { exportVisibleTables } from '../../../lib/download'
import PrintHeader from '../../../components/layout/PrintHeader'

interface Ledger {
  id: string
  name: string
  group: string
  balance: number
  type: 'Dr' | 'Cr'
}

interface StatementEntry {
  id: string
  party: string
  date: string
  vType: string
  vNo: string
  debit: number
  credit: number
  narration: string
}

const TYPE_BADGES: Record<string, string> = {
  sale: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  purchase: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  receipt: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  payment: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  contra: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  journal: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  challan: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

export default function LedgerList() {
  const [activeTab, setActiveTab] = useState<'masters' | 'statement'>('masters')
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([])
  const [selectedLedger, setSelectedLedger] = useState<string>('')
  const [search, setSearch] = useState('')
  const [statementSearch, setStatementSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('Sundry Debtors')
  const addToast = useUIStore((s) => s.addToast)

  const loadData = () => {
    Promise.all([
      getErp<Ledger[]>('accounts').catch(() => []),
      getErp<any[]>('parties').catch(() => []),
      getErp<StatementEntry[]>('ledgers').catch(() => [])
    ])
      .then(([accounts, parties, ledgerRows]) => {
        const partyLedgers: Ledger[] = parties.map((p) => ({
          id: p.id,
          name: p.name,
          group: p.type === 'supplier' ? 'Sundry Creditors' : 'Sundry Debtors',
          balance: Math.abs(Number(p.balance || 0)),
          type: Number(p.balance || 0) < 0 ? 'Cr' : 'Dr'
        }))

        // Merge chart of accounts with parties
        const existingNames = new Set(accounts.map((a) => a.name.toLowerCase()))
        const combined = [
          ...accounts,
          ...partyLedgers.filter((p) => !existingNames.has(p.name.toLowerCase()))
        ]
        setLedgers(combined)

        const seenStatementKeys = new Set<string>()
        const dedupedRows = (ledgerRows || []).filter((r) => {
          const key = `${(r.vNo || r.id || '').trim()}_${(r.party || '').trim()}_${Number(r.debit || 0)}_${Number(r.credit || 0)}`
          if (seenStatementKeys.has(key)) return false
          seenStatementKeys.add(key)
          return true
        })
        setStatementEntries(dedupedRows)

        if (combined.length > 0 && !selectedLedger) {
          setSelectedLedger(combined[0].name)
        }
      })
      .catch((e) => addToast(e.message, 'error'))
  }

  useEffect(() => {
    loadData()
  }, [addToast])

  const groups = [
    'Sundry Debtors',
    'Sundry Creditors',
    'Tax - CGST',
    'Tax - SGST',
    'Tax - IGST',
    'Sales Account',
    'Purchase Account',
    'Cash',
    'Bank',
    'Suspense Account',
  ]

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    try {
      const created = await postErp<Ledger>('accounts', { name, group })
      setLedgers((rows) => [...rows, created])
      setName('')
      setShowModal(false)
      addToast('Ledger saved', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to save ledger', 'error')
    }
  }

  const editLedger = async (ledger: Ledger) => {
    const nextName = window.prompt('Ledger name', ledger.name)
    if (!nextName) return
    try {
      await patchErp('accounts', ledger.id, { name: nextName, group: ledger.group })
      setLedgers((rows) => rows.map((row) => (row.id === ledger.id ? { ...row, name: nextName } : row)))
      addToast('Ledger updated', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to update ledger', 'error')
    }
  }

  const removeLedger = async (ledger: Ledger) => {
    if (!window.confirm(`Delete ${ledger.name}?`)) return
    try {
      await deleteErp('accounts', ledger.id)
      setLedgers((rows) => rows.filter((row) => row.id !== ledger.id))
      addToast('Ledger deleted', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'This ledger may already be used in posted entries.', 'error')
    }
  }

  const openPartyStatement = (ledgerName: string) => {
    setSelectedLedger(ledgerName)
    setActiveTab('statement')
  }

  const filteredLedgers = ledgers.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase())
    const matchGroup = groupFilter === 'ALL' || l.group.toLowerCase() === groupFilter.toLowerCase()
    return matchSearch && matchGroup
  })

  // Calculate Party-Wise Statement with Running Balance
  const selectedLedgerObj = ledgers.find((l) => l.name === selectedLedger)

  const partyTransactions = useMemo(() => {
    if (!selectedLedger) return []
    const relevant = statementEntries.filter(
      (e) => (e.party || '').toLowerCase() === selectedLedger.toLowerCase()
    )

    // Sort chronologically
    relevant.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let currentBal = 0
    return relevant.map((txn) => {
      const dr = Number(txn.debit) || 0
      const cr = Number(txn.credit) || 0
      currentBal += dr - cr
      return {
        ...txn,
        debit: dr,
        credit: cr,
        runningBalance: Math.abs(currentBal),
        balanceType: currentBal >= 0 ? ('Dr' as const) : ('Cr' as const)
      }
    })
  }, [statementEntries, selectedLedger])

  // Filter statement transactions by date & type
  const filteredStatementTxns = useMemo(() => {
    return partyTransactions.filter((txn) => {
      const matchSearch =
        txn.vNo.toLowerCase().includes(statementSearch.toLowerCase()) ||
        txn.narration.toLowerCase().includes(statementSearch.toLowerCase()) ||
        txn.vType.toLowerCase().includes(statementSearch.toLowerCase())

      const matchType = typeFilter === 'all' || txn.vType.toLowerCase() === typeFilter.toLowerCase()

      const matchDate = (!fromDate || txn.date >= fromDate) && (!toDate || txn.date <= toDate)

      return matchSearch && matchType && matchDate
    })
  }, [partyTransactions, statementSearch, typeFilter, fromDate, toDate])

  const totalStatementDr = filteredStatementTxns.reduce((s, t) => s + t.debit, 0)
  const totalStatementCr = filteredStatementTxns.reduce((s, t) => s + t.credit, 0)
  const netStatementChange = totalStatementDr - totalStatementCr
  const closingBalance =
    filteredStatementTxns.length > 0
      ? filteredStatementTxns[filteredStatementTxns.length - 1].runningBalance
      : selectedLedgerObj?.balance || 0
  const closingBalType =
    filteredStatementTxns.length > 0
      ? filteredStatementTxns[filteredStatementTxns.length - 1].balanceType
      : selectedLedgerObj?.type || 'Dr'

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <PrintHeader title={`Party Statement: ${selectedLedger || 'All Ledgers'}`} />

      {/* Main Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Landmark className="text-indigo-400" size={24} /> Ledger &amp; Party Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Chart of accounts, customer/supplier ledgers and party-wise financial statements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'statement' ? (
            <>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition border border-slate-700"
              >
                <Printer size={15} /> Print Statement
              </button>
              <button
                onClick={() => exportVisibleTables(`statement-${selectedLedger || 'party'}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                <Download size={15} /> Export CSV
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition"
            >
              <Plus size={16} /> New Ledger
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 no-print">
        <button
          onClick={() => setActiveTab('masters')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2',
            activeTab === 'masters'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Landmark size={15} /> Chart of Accounts / All Ledgers ({ledgers.length})
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2',
            activeTab === 'statement'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <FileText size={15} /> Party-Wise Statement {selectedLedger && `(${selectedLedger})`}
        </button>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS / ALL LEDGERS */}
      {activeTab === 'masters' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md w-full shadow-xs">
              <Search className="text-slate-400 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Search ledgers by name or group..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-white text-xs sm:text-sm w-full placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Group:</span>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Account Groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Horizontal Scroller Container */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
            <table className="min-w-[700px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5">Ledger / Party Name</th>
                  <th className="p-3.5">Account Group</th>
                  <th className="p-3.5 text-right">Current Balance</th>
                  <th className="p-3.5 text-center">Dr/Cr</th>
                  <th className="p-3.5 text-right">Actions &amp; Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {filteredLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                      No ledgers matching &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filteredLedgers.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-900/40 text-slate-300 transition">
                      <td className="p-3.5 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{l.name}</span>
                          {['Sundry Debtors', 'Sundry Creditors'].includes(l.group) && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-normal">
                              Party
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-400 text-xs">{l.group}</td>
                      <td
                        className={cn(
                          'p-3.5 text-right font-mono font-semibold',
                          l.type === 'Dr' ? 'text-emerald-400' : 'text-amber-400'
                        )}
                      >
                        ₹{l.balance.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-center text-xs font-mono">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold',
                            l.type === 'Dr' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          )}
                        >
                          {l.type}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => openPartyStatement(l.name)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium transition"
                            title="View Statement"
                          >
                            <FileText size={13} /> Statement
                          </button>
                          <button
                            aria-label={`Edit ${l.name}`}
                            onClick={() => editLedger(l)}
                            className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${l.name}`}
                            onClick={() => removeLedger(l)}
                            className="p-1.5 hover:text-rose-400 text-slate-400 hover:bg-rose-950/30 rounded transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PARTY-WISE STATEMENT */}
      {activeTab === 'statement' && (
        <div className="space-y-4">
          {/* Party Selector & Filters Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Party / Ledger Dropdown */}
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Select Party / Ledger
                </label>
                <select
                  value={selectedLedger}
                  onChange={(e) => setSelectedLedger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-semibold"
                >
                  <optgroup label="👥 Customer Ledgers (Sundry Debtors)">
                    {ledgers
                      .filter((l) => l.group === 'Sundry Debtors')
                      .map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name} (Dr ₹{l.balance.toLocaleString('en-IN')})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🏢 Supplier Ledgers (Sundry Creditors)">
                    {ledgers
                      .filter((l) => l.group === 'Sundry Creditors')
                      .map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name} (Cr ₹{l.balance.toLocaleString('en-IN')})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🏦 Bank & Cash Accounts">
                    {ledgers
                      .filter((l) => ['Cash', 'Bank', 'Cash-in-hand', 'Bank Accounts'].includes(l.group))
                      .map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="📑 General & Nominal Accounts">
                    {ledgers
                      .filter(
                        (l) => !['Sundry Debtors', 'Sundry Creditors', 'Cash', 'Bank', 'Cash-in-hand', 'Bank Accounts'].includes(l.group)
                      )
                      .map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Voucher Type:</span>
                {['all', 'sale', 'purchase', 'receipt', 'payment', 'journal', 'contra'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs capitalize font-medium transition',
                      typeFilter === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voucher or narration..."
                  value={statementSearch}
                  onChange={(e) => setStatementSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Statement KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Debit (Dr)</div>
              <div className="text-base sm:text-lg font-bold text-emerald-400 mt-1 font-mono">
                {formatCurrency(totalStatementDr)}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Credit (Cr)</div>
              <div className="text-base sm:text-lg font-bold text-rose-400 mt-1 font-mono">
                {formatCurrency(totalStatementCr)}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Movement</div>
              <div
                className={cn(
                  'text-base sm:text-lg font-bold mt-1 font-mono',
                  netStatementChange >= 0 ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {formatCurrency(Math.abs(netStatementChange))} {netStatementChange >= 0 ? 'Dr' : 'Cr'}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Closing Balance</div>
              <div
                className={cn(
                  'text-base sm:text-lg font-bold mt-1 font-mono',
                  closingBalType === 'Dr' ? 'text-white' : 'text-amber-400'
                )}
              >
                {formatCurrency(closingBalance)} {closingBalType}
              </div>
            </div>
          </div>

          {/* Party Statement Ledger Grid */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
              <div className="text-xs font-semibold text-white">
                Statement for <span className="text-indigo-400">{selectedLedger}</span> &bull;{' '}
                {filteredStatementTxns.length} transactions
              </div>
              <div className="text-xs text-slate-400">
                Period: {fromDate || 'Start'} to {toDate || 'Present'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[750px]">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium w-28">Date</th>
                    <th className="text-left px-4 py-3 font-medium w-28">Voucher Type</th>
                    <th className="text-left px-4 py-3 font-medium w-36">Voucher / Ref No</th>
                    <th className="text-left px-4 py-3 font-medium">Particulars / Narration</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Debit (Dr ₹)</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Credit (Cr ₹)</th>
                    <th className="text-right px-4 py-3 font-medium w-36">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredStatementTxns.map((txn, idx) => (
                    <tr key={txn.id || idx} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-3 font-mono text-slate-400">{txn.date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-semibold uppercase border',
                            TYPE_BADGES[txn.vType.toLowerCase()] || 'bg-slate-800 text-slate-400 border-slate-700'
                          )}
                        >
                          {txn.vType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-white font-medium">{txn.vNo}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-sm truncate">{txn.narration || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-medium">
                        {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-400 font-medium">
                        {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                        {formatCurrency(txn.runningBalance)}{' '}
                        <span className="text-[10px] text-slate-400">{txn.balanceType}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredStatementTxns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-500">
                        No transactions found for {selectedLedger} within the selected date range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/90 border-t border-slate-700 text-white font-bold text-xs">
                    <td colSpan={4} className="px-4 py-3 uppercase">
                      Total Transaction Movement
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      {formatCurrency(totalStatementDr)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-400">
                      {formatCurrency(totalStatementCr)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {formatCurrency(closingBalance)} {closingBalType}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Ledger */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-white">
              <h3 className="text-base sm:text-lg font-bold text-white">Create New Ledger</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Ledger Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. ABC Pharma Distributors"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Group *</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md transition"
                  >
                    Save Ledger
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

