import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  Download,
  Printer,
  Landmark,
  ChevronDown,
  ChevronRight,
  Receipt,
  ShoppingBag,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck,
  BookOpen,
  Users,
  Building2,
  Wallet,
  FolderTree,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Scale,
  ExternalLink
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn, formatCurrency } from '../../../lib/utils'
import { exportVisibleTables } from '../../../lib/download'
import PrintHeader from '../../../components/layout/PrintHeader'
import accountGroupMaster from '../../../data/accountGroupMasterData.json'

interface Ledger {
  id: string
  name: string
  group: string
  balance: number
  type: 'Dr' | 'Cr'
  txnCount?: number
  totalDr?: number
  totalCr?: number
}

interface StatementEntry {
  id: string
  party: string
  date: string
  vType: string
  vNo: string
  physicalVchNo?: string
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

interface SectionProps {
  title: string
  icon: React.ElementType
  iconColor: string
  badgeBg: string
  transactions: any[]
  children: React.ReactNode
}

const Section = ({ title, icon: Icon, iconColor, badgeBg, transactions, children }: SectionProps) => {
  const [isOpen, setIsOpen] = useState(true)
  const dr = transactions.reduce((acc, t) => acc + t.debit, 0)
  const cr = transactions.reduce((acc, t) => acc + t.credit, 0)
  if (transactions.length === 0) return null
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-slate-900/80 hover:bg-slate-800/80 transition"
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
          <div className={cn('p-1.5 rounded-lg border flex items-center justify-center', badgeBg)}>
            <Icon size={16} className={iconColor} />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">{title}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
            {transactions.length}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
          {dr > 0 && <span className="text-emerald-400">Dr: {formatCurrency(dr)}</span>}
          {cr > 0 && <span className="text-rose-400">Cr: {formatCurrency(cr)}</span>}
        </div>
      </button>
      {isOpen && <div className="border-t border-slate-800">{children}</div>}
    </div>
  )
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
  const [editModalLedger, setEditModalLedger] = useState<Ledger | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('Sundry Debtors')
  const [editBalance, setEditBalance] = useState('0')
  const [deleteConfirmLedger, setDeleteConfirmLedger] = useState<Ledger | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [purging, setPurging] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('Sundry Debtors')
  const addToast = useUIStore((s) => s.addToast)
  const navigate = useNavigate()

  const handleNavigateToTransaction = (t: { vType?: string; vNo?: string; id?: string; party?: string }) => {
    const type = String(t.vType || '').toLowerCase().trim()
    const rawNo = String(t.vNo || t.id || '').trim()
    const encoded = encodeURIComponent(rawNo)

    if (
      type === 'sale' ||
      type === 'sales' ||
      type === 'invoice' ||
      rawNo.toUpperCase().startsWith('SI') ||
      rawNo.toUpperCase().startsWith('INV')
    ) {
      navigate(`/transactions/sale/edit/${encoded}`)
    } else if (
      type === 'purchase' ||
      type === 'purchases' ||
      type === 'bill' ||
      rawNo.toUpperCase().startsWith('PB') ||
      rawNo.toUpperCase().startsWith('PUR')
    ) {
      navigate(`/transactions/purchase/edit/${encoded}`)
    } else if (type === 'sale-return' || type === 'sale_return') {
      navigate(`/transactions/sale-return`)
    } else if (type === 'purchase-return' || type === 'purchase_return') {
      navigate(`/transactions/purchase-return`)
    } else if (type === 'challan') {
      navigate(`/transactions/sale/challan`)
    } else {
      // Vouchers: Receipt, Payment, Journal, Contra, Notes
      const party = encodeURIComponent(t.party || selectedLedger || '')
      navigate(`/accounting/vouchers?vNo=${encoded}&type=${encodeURIComponent(type)}&party=${party}`)
    }
  }

  const handleForceRemoveZeroValueTxns = async () => {
    setPurging(true)
    try {
      await postErp('purge-zero-transactions', {}).catch(() => deleteErp('ledgers', 'zero-value')).catch(() => {})
      setLedgers((prev) =>
        prev.filter((l) => {
          const hasTxns = (l.txnCount || 0) > 0
          const hasBalance = (Number(l.balance) || 0) > 0
          const hasMovement = (l.totalDr || 0) > 0 || (l.totalCr || 0) > 0
          return hasTxns || hasBalance || hasMovement
        })
      )
      loadData()
      addToast('All zero-value accounts and transactions have been deleted from Chart of Accounts.', 'success')
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete zero-value entries.', 'error')
    } finally {
      setPurging(false)
    }
  }

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
          group: p.accountGroup || (p.type === 'supplier' ? 'Sundry Creditors' : p.type === 'both' ? 'Sundry Debtors & Creditors' : 'Sundry Debtors'),
          balance: Math.abs(Number(p.balance || 0)),
          type: Number(p.balance || 0) < 0 ? 'Cr' : 'Dr'
        }))

        const existingNames = new Set(accounts.map((a) => a.name.toLowerCase()))
        const combined = [
          ...accounts,
          ...partyLedgers.filter((p) => !existingNames.has(p.name.toLowerCase()))
        ]

        const seenStatementKeys = new Set<string>()
        const validRows = (ledgerRows || []).filter((r) => {
          const dr = Number(r.debit || 0)
          const cr = Number(r.credit || 0)
          // Strictly force remove all transactions which have no value (debit <= 0 and credit <= 0)
          if (dr <= 0 && cr <= 0) return false
          if (isNaN(dr) && isNaN(cr)) return false

          const key = `${(r.vNo || r.id || '').trim()}_${(r.party || '').trim()}_${dr}_${cr}`
          if (seenStatementKeys.has(key)) return false
          seenStatementKeys.add(key)
          return true
        })
        setStatementEntries(validRows)

        // Compute balances and totals directly connected to all real transactions for each ledger
        const ledgerTxnTotals: Record<string, { dr: number; cr: number; net: number; count: number }> = {}
        validRows.forEach((row) => {
          const partyKey = (row.party || '').trim().toLowerCase()
          if (!partyKey) return
          if (!ledgerTxnTotals[partyKey]) ledgerTxnTotals[partyKey] = { dr: 0, cr: 0, net: 0, count: 0 }
          const drVal = Number(row.debit) || 0
          const crVal = Number(row.credit) || 0
          ledgerTxnTotals[partyKey].dr += drVal
          ledgerTxnTotals[partyKey].cr += crVal
          ledgerTxnTotals[partyKey].net += drVal - crVal
          ledgerTxnTotals[partyKey].count += 1
        })

        const updatedCombined = combined.map((ledger) => {
          const key = ledger.name.trim().toLowerCase()
          const txnData = ledgerTxnTotals[key]
          if (txnData && txnData.count > 0) {
            // Incorporate transaction movement into balance
            const initialNet = (ledger.type === 'Cr' ? -1 : 1) * Number(ledger.balance || 0)
            const finalNet = (initialNet || 0) + txnData.net
            return {
              ...ledger,
              balance: Math.abs(finalNet),
              type: finalNet < 0 ? ('Cr' as const) : ('Dr' as const),
              txnCount: txnData.count,
              totalDr: txnData.dr,
              totalCr: txnData.cr,
            }
          }
          return {
            ...ledger,
            txnCount: 0,
            totalDr: 0,
            totalCr: 0,
          }
        })

        // Force remove all accounts and transactions that have no value (0 txns and ₹0 balance)
        const activeCombined = updatedCombined.filter((l) => {
          const hasTxns = (l.txnCount || 0) > 0
          const hasBalance = (Number(l.balance) || 0) > 0
          const hasMovement = (l.totalDr || 0) > 0 || (l.totalCr || 0) > 0
          return hasTxns || hasBalance || hasMovement
        })

        setLedgers(activeCombined)

        if (activeCombined.length > 0 && (!selectedLedger || !activeCombined.some((l) => l.name === selectedLedger))) {
          setSelectedLedger(activeCombined[0].name)
        }
      })
      .catch((e) => addToast(e.message, 'error'))
  }

  useEffect(() => {
    loadData()
  }, [addToast])

  const allGroups = useMemo(() => {
    return (accountGroupMaster as Array<{ name: string; category: string }>).map((g) => g.name)
  }, [])

  const groupedAccountOptions = useMemo(() => {
    const cats: Record<'Asset' | 'Liability' | 'Income' | 'Expense', string[]> = {
      Asset: [],
      Liability: [],
      Income: [],
      Expense: [],
    }
    ;(accountGroupMaster as Array<{ name: string; category: string }>).forEach((g) => {
      const cat = g.category as 'Asset' | 'Liability' | 'Income' | 'Expense'
      if (cats[cat]) {
        cats[cat].push(g.name)
      } else {
        cats.Asset.push(g.name)
      }
    })
    return cats
  }, [])

  const groups = allGroups

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

  const editLedger = (ledger: Ledger) => {
    setEditModalLedger(ledger)
    setEditName(ledger.name)
    setEditGroup(ledger.group)
    setEditBalance(String(ledger.balance || 0))
  }

  const confirmEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModalLedger || !editName.trim()) return
    try {
      await patchErp('accounts', editModalLedger.id, {
        name: editName.trim(),
        group: editGroup,
        openingBalance: Number(editBalance) || 0
      })
      // Also sync if party exists in custom parties localStorage
      try {
        const raw = localStorage.getItem('pharma_erp_custom_parties')
        if (raw) {
          const parties = JSON.parse(raw)
          const updated = parties.map((p: any) =>
            (p.id === editModalLedger.id || (p.name && p.name.toLowerCase() === editModalLedger.name.toLowerCase()))
              ? { ...p, name: editName.trim(), accountGroup: editGroup }
              : p
          )
          localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(updated))
        }
      } catch {}

      setLedgers((rows) =>
        rows.map((row) =>
          row.id === editModalLedger.id
            ? { ...row, name: editName.trim(), group: editGroup, balance: Number(editBalance) || row.balance }
            : row
        )
      )
      addToast('Ledger updated', 'success')
      setEditModalLedger(null)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to update ledger', 'error')
    }
  }

  const removeLedger = (ledger: Ledger) => {
    setDeleteConfirmLedger(ledger)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmLedger) return
    setDeleting(true)
    try {
      await deleteErp('accounts', deleteConfirmLedger.id)
      setLedgers((rows) => rows.filter((row) => row.id !== deleteConfirmLedger.id))
      addToast('Ledger deleted', 'success')
      setDeleteConfirmLedger(null)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'This ledger may already be used in posted entries.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const openPartyStatement = (ledgerName: string) => {
    setSelectedLedger(ledgerName)
    setActiveTab('statement')
  }

  const [hideZeroBalances, setHideZeroBalances] = useState(false)

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase())
      const matchGroup = groupFilter === 'ALL' || l.group.toLowerCase() === groupFilter.toLowerCase()
      const matchBalance = !hideZeroBalances || (Number(l.balance) || 0) > 0
      return matchSearch && matchGroup && matchBalance
    })
  }, [ledgers, search, groupFilter, hideZeroBalances])

  const selectedLedgerObj = ledgers.find((l) => l.name === selectedLedger)

  const partyTransactions = useMemo(() => {
    if (!selectedLedger) return []
    const relevant = statementEntries.filter(
      (e) => {
        const matchesParty = (e.party || '').toLowerCase() === selectedLedger.toLowerCase()
        const hasAmount = (Number(e.debit) || 0) > 0 || (Number(e.credit) || 0) > 0
        return matchesParty && hasAmount
      }
    )
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

  const TransactionTable = ({ txns }: { txns: any[] }) => (
    <table className="w-full text-xs text-left min-w-[700px]">
      <thead>
        <tr className="bg-slate-950/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
          <th className="px-4 py-3 font-medium w-24">Date</th>
          <th className="px-4 py-3 font-medium w-28">Type</th>
          <th className="px-4 py-3 font-medium w-36">Voucher No</th>
          <th className="px-4 py-3 font-medium">Narration</th>
          <th className="px-4 py-3 font-medium text-right w-28">Debit (₹)</th>
          <th className="px-4 py-3 font-medium text-right w-28">Credit (₹)</th>
          <th className="px-4 py-3 font-medium text-right w-32">Running Bal</th>
          <th className="px-3 py-3 font-medium text-center w-20">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800 text-slate-300">
        {txns.length === 0 && (
          <tr><td colSpan={8} className="p-6 text-center text-slate-500 italic">No records found.</td></tr>
        )}
        {txns.map((t, i) => (
          <tr
            key={t.id || i}
            onClick={() => handleNavigateToTransaction(t)}
            className="hover:bg-indigo-500/10 cursor-pointer transition group"
            title={`Click to open and modify ${t.vType?.toUpperCase()} ${t.vNo}`}
          >
            <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px] group-hover:text-slate-300">{t.date}</td>
            <td className="px-4 py-2.5">
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', TYPE_BADGES[t.vType?.toLowerCase()] || 'bg-slate-800 text-slate-400 border-slate-700')}>
                {t.vType}
              </span>
            </td>
            <td className="px-4 py-2.5 font-mono text-indigo-400 group-hover:text-indigo-300 font-medium text-[11px]">
              <span className="inline-flex items-center gap-1 underline underline-offset-2">
                {t.vNo}
                <ExternalLink size={11} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
              </span>
            </td>
            <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate group-hover:text-white">{t.narration || '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-medium">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono text-rose-400 font-medium">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-white text-[11px]">
              {formatCurrency(t.runningBalance)} <span className="text-[9px] text-slate-400">{t.balanceType}</span>
            </td>
            <td className="px-3 py-2.5 text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNavigateToTransaction(t)
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition"
                title={`Open & modify ${t.vNo}`}
              >
                <span>Edit</span>
                <ExternalLink size={10} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <PrintHeader title={`Party Statement: ${selectedLedger || 'All Ledgers'}`} />
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-white flex items-center gap-2">
            <Landmark className="text-indigo-600 dark:text-indigo-400" size={24} /> Ledger &amp; Party Master
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Chart of accounts, customer/supplier ledgers and party-wise financial statements</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleForceRemoveZeroValueTxns}
            disabled={purging}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
            title="Delete and force remove all accounts and transactions with no value (0 txns & ₹0 balance) from Chart of Accounts"
          >
            <Trash2 size={14} className={cn(purging && 'animate-spin', 'text-rose-400')} />
            <span>{purging ? 'Deleting Zero-Value...' : 'Delete Zero-Value (0 Txns / ₹0)'}</span>
          </button>
          {activeTab === 'statement' ? (
            <>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition border border-slate-700">
                <Printer size={15} /> Print Statement
              </button>
              <button onClick={() => exportVisibleTables(`statement-${selectedLedger || 'party'}`, useUIStore.getState().company)} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition">
                <Download size={15} /> Export CSV
              </button>
            </>
          ) : (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition">
              <Plus size={16} /> New Ledger
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border gap-2 no-print">
        <button
          onClick={() => setActiveTab('masters')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2',
            activeTab === 'masters'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-foreground'
          )}
        >
          <Landmark size={15} /> Chart of Accounts ({ledgers.length})
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2',
            activeTab === 'statement'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-foreground'
          )}
        >
          <FileText size={15} /> Party-Wise Statement {selectedLedger && `(${selectedLedger})`}
        </button>
      </div>

      {activeTab === 'masters' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md w-full shadow-xs">
              <Search className="text-slate-400 shrink-0" size={16} />
              <input type="text" placeholder="Search ledgers..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-white text-xs sm:text-sm w-full placeholder:text-slate-500" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={(e) => setHideZeroBalances(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                />
                <span>Hide Zero Balance (₹0)</span>
              </label>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none max-w-[220px]">
                <option value="ALL">All Groups (74 Groups)</option>
                <optgroup label="Assets">
                  {groupedAccountOptions.Asset.map((g) => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="Liabilities">
                  {groupedAccountOptions.Liability.map((g) => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="Income">
                  {groupedAccountOptions.Income.map((g) => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="Expenses">
                  {groupedAccountOptions.Expense.map((g) => <option key={g} value={g}>{g}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
            <table className="min-w-[850px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5">Ledger Name</th>
                  <th className="p-3.5">Account Group</th>
                  <th className="p-3.5 text-center">Connected Txns</th>
                  <th className="p-3.5 text-right">Total Debit</th>
                  <th className="p-3.5 text-right">Total Credit</th>
                  <th className="p-3.5 text-right">Current Balance</th>
                  <th className="p-3.5 text-center">Type</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {filteredLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                      No ledgers found.
                    </td>
                  </tr>
                ) : (
                  filteredLedgers.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-900/40 text-slate-300 transition group">
                      <td className="p-3.5 font-medium text-white">
                        <button
                          onClick={() => openPartyStatement(l.name)}
                          className="hover:text-indigo-400 hover:underline transition text-left flex items-center gap-1.5"
                          title="Click to view all connected transactions"
                        >
                          <span>{l.name}</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-slate-400 text-xs">{l.group}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            (l.txnCount || 0) > 0
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'text-slate-500'
                          )}
                        >
                          {l.txnCount || 0} txn{(l.txnCount || 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs text-emerald-400">
                        {(l.totalDr || 0) > 0 ? formatCurrency(l.totalDr || 0) : '-'}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs text-rose-400">
                        {(l.totalCr || 0) > 0 ? formatCurrency(l.totalCr || 0) : '-'}
                      </td>
                      <td className={cn('p-3.5 text-right font-mono font-semibold', l.type === 'Dr' ? 'text-emerald-400' : 'text-amber-400')}>
                        ₹{l.balance.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center text-xs">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', l.type === 'Dr' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
                          {l.type}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => openPartyStatement(l.name)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium transition"
                            title="View Statement & Transactions"
                          >
                            <FileText size={12} /> Statement
                          </button>
                          <button onClick={() => editLedger(l)} className="p-1 text-slate-400 hover:text-white transition" title="Edit"><Edit2 size={12}/></button>
                          <button onClick={() => removeLedger(l)} className="p-1 text-slate-400 hover:text-rose-400 transition" title="Delete"><Trash2 size={12}/></button>
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

      {activeTab === 'statement' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Select Party / Ledger</label>
                <select value={selectedLedger} onChange={(e) => setSelectedLedger(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold outline-none text-sm mt-1 focus:border-indigo-500">
                  <optgroup label="Customer Ledgers (Sundry Debtors)">
                    {ledgers.filter(l => l.group === 'Sundry Debtors').map(l => <option key={l.id} value={l.name}>{l.name} (Dr ₹{l.balance.toLocaleString('en-IN')})</option>)}
                  </optgroup>
                  <optgroup label="Supplier Ledgers (Sundry Creditors)">
                    {ledgers.filter(l => l.group === 'Sundry Creditors').map(l => <option key={l.id} value={l.name}>{l.name} (Cr ₹{l.balance.toLocaleString('en-IN')})</option>)}
                  </optgroup>
                  <optgroup label="Other Accounts">
                    {ledgers.filter(l => !['Sundry Debtors','Sundry Creditors'].includes(l.group)).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">From Date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none text-sm mt-1 focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">To Date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none text-sm mt-1 focus:border-indigo-500" />
              </div>
            </div>
            {/* Type filter + search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Filter:</span>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'sale', label: 'Sale' },
                  { key: 'purchase', label: 'Purchase' },
                  { key: 'challan', label: 'Challan' },
                  { key: 'receipt', label: 'Receipt' },
                  { key: 'payment', label: 'Payment' },
                  { key: 'journal', label: 'Journal' },
                  { key: 'contra', label: 'Cash/Bank Transfer' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-medium transition border',
                      typeFilter === key
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search voucher / narration..." value={statementSearch} onChange={e => setStatementSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-indigo-500 w-56" />
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                <span>Total Debit</span>
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{formatCurrency(totalStatementDr)}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                <span>Total Credit</span>
                <TrendingDown size={14} className="text-rose-400" />
              </div>
              <div className="text-lg font-bold text-rose-400 font-mono mt-1">{formatCurrency(totalStatementCr)}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                <span>Net Movement</span>
                <Scale size={14} className={netStatementChange >= 0 ? 'text-emerald-400' : 'text-amber-400'} />
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', netStatementChange >= 0 ? 'text-emerald-400' : 'text-amber-400')}>{formatCurrency(Math.abs(netStatementChange))} {netStatementChange >= 0 ? 'Dr' : 'Cr'}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                <span>Closing Balance</span>
                <Wallet size={14} className={closingBalType === 'Dr' ? 'text-indigo-400' : 'text-amber-400'} />
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', closingBalType === 'Dr' ? 'text-white' : 'text-amber-400')}>{formatCurrency(closingBalance)} {closingBalType}</div>
            </div>
          </div>

          {/* Document count summary strip */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs">
            <span className="text-slate-400 font-semibold">Documents for</span>
            <span className="text-indigo-400 font-bold">{selectedLedger}</span>
            <span className="text-slate-600">—</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
              <Receipt size={13} />
              <span>Invoices: {filteredStatementTxns.filter(t => t.vType === 'sale').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
              <ShoppingBag size={13} />
              <span>Bills: {filteredStatementTxns.filter(t => t.vType === 'purchase').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-600/30 text-slate-300 font-medium">
              <Truck size={13} />
              <span>Challans: {filteredStatementTxns.filter(t => t.vType === 'challan').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
              <CreditCard size={13} />
              <span>Receipts/Pmts: {filteredStatementTxns.filter(t => ['receipt','payment'].includes(t.vType)).length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
              <FileCheck size={13} />
              <span>Vouchers: {filteredStatementTxns.filter(t => ['journal','contra','debit_note','credit_note'].includes(t.vType)).length}</span>
            </span>
            <span className="ml-auto text-slate-500">Total: <strong className="text-white">{filteredStatementTxns.length}</strong></span>
          </div>

          {/* Interactive Navigation Hint */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
            <span className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span>Click on any transaction row or voucher number to open the bill or voucher to modify it.</span>
            </span>
            <span className="hidden sm:inline text-[11px] text-indigo-400 font-mono">Click to Edit</span>
          </div>

          {/* Sub-sections */}
          <div className="space-y-3">
            <Section
              title="Sales Invoices"
              icon={Receipt}
              iconColor="text-blue-400"
              badgeBg="bg-blue-500/10 border-blue-500/20"
              transactions={filteredStatementTxns.filter(t => t.vType === 'sale')}
            >
              <div className="overflow-x-auto">
                <TransactionTable txns={filteredStatementTxns.filter(t => t.vType === 'sale')} />
              </div>
            </Section>

            <Section
              title="Purchase Bills"
              icon={ShoppingBag}
              iconColor="text-purple-400"
              badgeBg="bg-purple-500/10 border-purple-500/20"
              transactions={filteredStatementTxns.filter(t => t.vType === 'purchase')}
            >
              <div className="overflow-x-auto">
                <TransactionTable txns={filteredStatementTxns.filter(t => t.vType === 'purchase')} />
              </div>
            </Section>

            <Section
              title="Delivery Challans"
              icon={Truck}
              iconColor="text-slate-300"
              badgeBg="bg-slate-500/10 border-slate-600/30"
              transactions={filteredStatementTxns.filter(t => t.vType === 'challan')}
            >
              <div className="overflow-x-auto">
                <TransactionTable txns={filteredStatementTxns.filter(t => t.vType === 'challan')} />
              </div>
            </Section>

            <Section
              title="Receipts & Payments"
              icon={CreditCard}
              iconColor="text-emerald-400"
              badgeBg="bg-emerald-500/10 border-emerald-500/20"
              transactions={filteredStatementTxns.filter(t => ['receipt','payment'].includes(t.vType))}
            >
              <div className="overflow-x-auto">
                <TransactionTable txns={filteredStatementTxns.filter(t => ['receipt','payment'].includes(t.vType))} />
              </div>
            </Section>

            <Section
              title="Accounting Vouchers (Journal / Cash-Bank Transfer / Notes)"
              icon={FileCheck}
              iconColor="text-amber-400"
              badgeBg="bg-amber-500/10 border-amber-500/20"
              transactions={filteredStatementTxns.filter(t => ['journal','contra','debit_note','credit_note'].includes(t.vType))}
            >
              <div className="overflow-x-auto">
                <TransactionTable txns={filteredStatementTxns.filter(t => ['journal','contra','debit_note','credit_note'].includes(t.vType))} />
              </div>
            </Section>
          </div>

          {/* Full Chronological Ledger View */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border-b border-slate-800">
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <BookOpen size={14} className="text-indigo-400" />
                </div>
                <span>Full Chronological Ledger —</span>
                <span className="text-indigo-400 font-bold">{selectedLedger}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{filteredStatementTxns.length} entries</span>
              </div>
              <div className="text-xs text-slate-500">Period: {fromDate || 'Start'} → {toDate || 'Present'}</div>
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
                    <th className="text-center px-3 py-3 font-medium w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredStatementTxns.map((txn, idx) => (
                    <tr
                      key={txn.id || idx}
                      onClick={() => handleNavigateToTransaction(txn)}
                      className="hover:bg-indigo-500/10 cursor-pointer transition group"
                      title={`Click to open and modify ${txn.vType?.toUpperCase()} ${txn.vNo}`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-400 group-hover:text-slate-300">{txn.date}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', TYPE_BADGES[txn.vType?.toLowerCase()] || 'bg-slate-800 text-slate-400 border-slate-700')}>{txn.vType}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-400 group-hover:text-indigo-300 font-medium">
                        <span className="inline-flex items-center gap-1 underline underline-offset-2">
                          {txn.vNo}
                          <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-sm truncate group-hover:text-white">{txn.narration || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-medium">{txn.debit > 0 ? formatCurrency(txn.debit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-400 font-medium">{txn.credit > 0 ? formatCurrency(txn.credit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">{formatCurrency(txn.runningBalance)} <span className="text-[10px] text-slate-400">{txn.balanceType}</span></td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNavigateToTransaction(txn)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition"
                          title={`Open & modify ${txn.vNo}`}
                        >
                          <span>Edit</span>
                          <ExternalLink size={10} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStatementTxns.length === 0 && (
                    <tr><td colSpan={8} className="p-10 text-center text-slate-500">No transactions found for {selectedLedger} in the selected period.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/90 border-t border-slate-700 text-white font-bold text-xs">
                    <td colSpan={4} className="px-4 py-3 uppercase">Total Movement</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(totalStatementDr)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-400">{formatCurrency(totalStatementCr)}</td>
                    <td colSpan={2} className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(closingBalance)} {closingBalType}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-white">
              <h3 className="text-base sm:text-lg font-bold text-white">Create New Ledger</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Ledger Name *</label>
                  <input type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Group *</label>
                  <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500">
                    <optgroup label="Assets (Cash, Bank, Debtors, Current & Fixed Assets)">
                      {groupedAccountOptions.Asset.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Liabilities (Creditors, Loans, Capital, Duties & Taxes)">
                      {groupedAccountOptions.Liability.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Income (Sales, Revenue, Operating & Other Income)">
                      {groupedAccountOptions.Income.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Expenses (Purchases, Operating & Administrative Expenses)">
                      {groupedAccountOptions.Expense.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md">Save</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {editModalLedger &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-white">
              <h3 className="text-base sm:text-lg font-bold text-white">Edit Ledger Account</h3>
              <form onSubmit={confirmEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Ledger / Account Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Group *</label>
                  <select
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    <optgroup label="Assets (Cash, Bank, Debtors, Current & Fixed Assets)">
                      {groupedAccountOptions.Asset.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Liabilities (Creditors, Loans, Capital, Duties & Taxes)">
                      {groupedAccountOptions.Liability.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Income (Sales, Revenue, Operating & Other Income)">
                      {groupedAccountOptions.Income.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Expenses (Purchases, Operating & Administrative Expenses)">
                      {groupedAccountOptions.Expense.map((g) => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {(editModalLedger.group.toLowerCase().includes('debtor') || editModalLedger.group.toLowerCase().includes('creditor') || editModalLedger.group.toLowerCase().includes('both')) && (
                  <div className="pt-1">
                    <Link
                      to={`/masters/parties?search=${encodeURIComponent(editModalLedger.name)}`}
                      onClick={() => setEditModalLedger(null)}
                      className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
                    >
                      <ExternalLink size={13} /> Edit Full Customer/Supplier Master (GST, DL, Address, Credit)
                    </Link>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button type="button" onClick={() => setEditModalLedger(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md">Update Ledger</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {deleteConfirmLedger &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-white">
              <h3 className="text-base sm:text-lg font-bold text-rose-400">Confirm Deletion</h3>
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <strong className="text-white">{deleteConfirmLedger.name}</strong>?
              </p>
              <div className="text-xs text-slate-400">
                Ledgers linked to existing posted transactions cannot be deleted.
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmLedger(null)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-md disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Ledger'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
