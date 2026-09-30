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
  ExternalLink,
  Calendar,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'
import { cn, formatCurrency, formatDate, getTxnDateTime } from '../../../lib/utils'
import { exportVisibleTables } from '../../../lib/download'
import PrintHeader from '../../../components/layout/PrintHeader'
import accountGroupMaster from '../../../data/accountGroupMasterData.json'
import { openTransactionWindow } from '../../../lib/windowUtils'

interface Ledger {
  id: string
  name: string
  group: string
  balance: number
  type: 'Dr' | 'Cr'
  openingBalance?: number
  openingType?: 'Dr' | 'Cr'
  txnCount?: number
  totalDr?: number
  totalCr?: number
  lastActivityDate?: string
  lastActivityTime?: string
  companyName?: string
  city?: string
  station?: string
  associatedCompanies?: string[]
}

interface StatementEntry {
  id: string
  party: string
  date: string
  time?: string
  timestamp?: string
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
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-secondary/30 hover:bg-secondary/60 transition"
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
          <div className={cn('p-1.5 rounded-lg border flex items-center justify-center', badgeBg)}>
            <Icon size={16} className={iconColor} />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">{title}</span>
          <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-mono text-muted-foreground">
            {transactions.length}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
          {dr > 0 && <span className="text-emerald-500 dark:text-emerald-400">Dr: {formatCurrency(dr)}</span>}
          {cr > 0 && <span className="text-rose-500 dark:text-rose-400">Cr: {formatCurrency(cr)}</span>}
        </div>
      </button>
      {isOpen && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

interface LedgerSectionProps {
  title: string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  badgeBg: string
  ledgers: Ledger[]
  children: React.ReactNode
  defaultOpen?: boolean
}

const LedgerSection = ({ title, subtitle, icon: Icon, iconColor, badgeBg, ledgers, children, defaultOpen = true }: LedgerSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const totalDr = ledgers.reduce((s, l) => s + (l.totalDr || 0), 0)
  const totalCr = ledgers.reduce((s, l) => s + (l.totalCr || 0), 0)
  const totalTxns = ledgers.reduce((s, l) => s + (l.txnCount || 0), 0)
  if (ledgers.length === 0) return null
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-secondary/30 hover:bg-secondary/60 transition"
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
          <div className={cn('p-1.5 rounded-lg border flex items-center justify-center', badgeBg)}>
            <Icon size={16} className={iconColor} />
          </div>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-sm text-foreground tracking-tight leading-tight">{title}</span>
            {subtitle && <span className="text-[10px] text-muted-foreground leading-tight">{subtitle}</span>}
          </div>
          <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-mono text-muted-foreground">
            {ledgers.length} ledger{ledgers.length !== 1 ? 's' : ''}
          </span>
          {totalTxns > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono text-indigo-400">
              {totalTxns} txn{totalTxns !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
          {totalDr > 0 && <span className="text-emerald-500 dark:text-emerald-400">Dr: {formatCurrency(totalDr)}</span>}
          {totalCr > 0 && <span className="text-rose-500 dark:text-rose-400">Cr: {formatCurrency(totalCr)}</span>}
        </div>
      </button>
      {isOpen && <div className="border-t border-border overflow-x-auto">{children}</div>}
    </div>
  )
}

export default function LedgerList() {
  const [activeTab, setActiveTab] = useState<'masters' | 'statement' | 'all-transactions'>('masters')
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
  const [ledgerSort, setLedgerSort] = useState<'newer' | 'name' | 'balance'>('newer')
  const [statementSortKey, setStatementSortKey] = useState<'date' | 'amount' | 'debit' | 'credit'>('date')
  const [statementSortDir, setStatementSortDir] = useState<'asc' | 'desc'>('desc')

  // All Transactions (Chronological) Tab State
  const [allTxnSearch, setAllTxnSearch] = useState('')
  const [allTxnTypeFilter, setAllTxnTypeFilter] = useState('all')
  const [allTxnFromDate, setAllTxnFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [allTxnToDate, setAllTxnToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [allTxnSortDir, setAllTxnSortDir] = useState<'desc' | 'asc'>('desc')

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
      openTransactionWindow(`/transactions/sale/edit/${encoded}`)
    } else if (
      type === 'purchase' ||
      type === 'purchases' ||
      type === 'bill' ||
      rawNo.toUpperCase().startsWith('PB') ||
      rawNo.toUpperCase().startsWith('PUR')
    ) {
      openTransactionWindow(`/transactions/purchase/edit/${encoded}`)
    } else if (type === 'sale-return' || type === 'sale_return') {
      openTransactionWindow(`/transactions/sale-return`)
    } else if (type === 'purchase-return' || type === 'purchase_return') {
      openTransactionWindow(`/transactions/purchase-return`)
    } else if (type === 'challan') {
      openTransactionWindow(`/transactions/sale/challan`)
    } else {
      // Vouchers: Receipt, Payment, Journal, Contra, Notes
      const party = encodeURIComponent(t.party || selectedLedger || '')
      openTransactionWindow(`/accounting/vouchers?vNo=${encoded}&type=${encodeURIComponent(type)}&party=${party}`)
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
        const partyMap: Record<string, any> = {}
        parties.forEach((p) => {
          if (p.name) partyMap[p.name.trim().toLowerCase()] = p
          if (p.id) partyMap[p.id.toLowerCase()] = p
        })

        const partyLedgers: Ledger[] = parties.map((p) => ({
          id: p.id,
          name: p.name,
          group: p.accountGroup || (p.type === 'supplier' ? 'Sundry Creditors' : p.type === 'both' ? 'Sundry Debtors & Creditors' : 'Sundry Debtors'),
          openingBalance: Number(p.openingBalance ?? 0),
          openingType: (p.openingType || (Number(p.balance || 0) < 0 ? 'Cr' : 'Dr')) as 'Dr' | 'Cr',
          balance: Math.abs(Number(p.balance || 0)),
          type: Number(p.balance || 0) < 0 ? 'Cr' : 'Dr',
          companyName: p.name,
          city: p.city || '',
          station: p.station || p.city || '',
          associatedCompanies: [p.name]
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

        // Precompute distinct company sets by transaction category
        const allSalesCompanies = Array.from(new Set(validRows.filter(r => (r.vType === 'sale' || r.vType === 'sales') && r.party).map(r => r.party.trim())))
        const allPurchaseCompanies = Array.from(new Set(validRows.filter(r => (r.vType === 'purchase' || r.vType === 'purchases') && r.party).map(r => r.party.trim())))
        const allVoucherCompanies = Array.from(new Set(validRows.filter(r => ['receipt', 'payment', 'journal', 'contra'].includes((r.vType || '').toLowerCase()) && r.party).map(r => r.party.trim())))
        const allChallanCompanies = Array.from(new Set(validRows.filter(r => r.vType === 'challan' && r.party).map(r => r.party.trim())))

        // Compute balances and totals directly connected to all real transactions for each ledger
        const ledgerTxnTotals: Record<string, { dr: number; cr: number; net: number; count: number; lastDate: string; lastTime: string; companies: Set<string> }> = {}
        validRows.forEach((row) => {
          const partyKey = (row.party || '').trim().toLowerCase()
          if (!partyKey) return
          if (!ledgerTxnTotals[partyKey]) ledgerTxnTotals[partyKey] = { dr: 0, cr: 0, net: 0, count: 0, lastDate: '', lastTime: '', companies: new Set() }
          const drVal = Number(row.debit) || 0
          const crVal = Number(row.credit) || 0
          ledgerTxnTotals[partyKey].dr += drVal
          ledgerTxnTotals[partyKey].cr += crVal
          ledgerTxnTotals[partyKey].net += drVal - crVal
          ledgerTxnTotals[partyKey].count += 1
          if (row.party) ledgerTxnTotals[partyKey].companies.add(row.party.trim())
          // Track the most recent date for last activity
          const rowDate = (row.date || '').slice(0, 10)
          if (!ledgerTxnTotals[partyKey].lastDate || rowDate > ledgerTxnTotals[partyKey].lastDate) {
            ledgerTxnTotals[partyKey].lastDate = rowDate
            ledgerTxnTotals[partyKey].lastTime = (row as any).time || ''
          }
        })

        const updatedCombined = combined.map((ledger) => {
          const key = ledger.name.trim().toLowerCase()
          const txnData = ledgerTxnTotals[key]
          const matchedParty = partyMap[key]
          const g = ledger.group.toLowerCase()

          let associated: string[] = []
          if (matchedParty) {
            associated = [matchedParty.name]
          } else if (g.includes('sale') || g.includes('income')) {
            associated = allSalesCompanies
          } else if (g.includes('purchase') || g.includes('expense')) {
            associated = allPurchaseCompanies
          } else if (g.includes('challan')) {
            associated = allChallanCompanies
          } else if (g.includes('cash') || g.includes('bank') || g.includes('duty') || g.includes('tax') || g.includes('capital')) {
            associated = allVoucherCompanies
          } else if (txnData && txnData.companies.size > 0) {
            associated = Array.from(txnData.companies)
          }

          const compName = matchedParty?.name || (associated.length === 1 ? associated[0] : ledger.name)
          const compCity = matchedParty?.city || ''
          const compStation = matchedParty?.station || matchedParty?.city || ''

          if (txnData && txnData.count > 0) {
            // Apply transactions to Opening Balance (not the already-calculated balance)
            const opBal = Number(ledger.openingBalance ?? 0)
            const opType = ledger.openingType ?? 'Dr'
            const initialNet = (opType === 'Cr' ? -1 : 1) * opBal
            const finalNet = initialNet + txnData.net
            return {
              ...ledger,
              balance: Math.abs(finalNet),
              type: finalNet < 0 ? ('Cr' as const) : ('Dr' as const),
              txnCount: txnData.count,
              totalDr: txnData.dr,
              totalCr: txnData.cr,
              lastActivityDate: txnData.lastDate,
              lastActivityTime: txnData.lastTime,
              companyName: compName,
              city: compCity,
              station: compStation,
              associatedCompanies: associated
            }
          }
          return {
            ...ledger,
            txnCount: 0,
            totalDr: 0,
            totalCr: 0,
            lastActivityDate: '',
            lastActivityTime: '',
            companyName: compName,
            city: compCity,
            station: compStation,
            associatedCompanies: associated
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
    const filtered = ledgers.filter((l) => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase())
      const matchGroup = groupFilter === 'ALL' || l.group.toLowerCase() === groupFilter.toLowerCase()
      const matchBalance = !hideZeroBalances || (Number(l.balance) || 0) > 0
      return matchSearch && matchGroup && matchBalance
    })
    // Sort by lastActivityDate descending (newer first); fallback to balance desc
    return [...filtered].sort((a, b) => {
      const dA = a.lastActivityDate || ''
      const dB = b.lastActivityDate || ''
      if (dA && dB) return dB.localeCompare(dA)
      if (dA) return -1
      if (dB) return 1
      return (b.balance || 0) - (a.balance || 0)
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
    const opBal = Number(selectedLedgerObj?.openingBalance ?? 0)
    const opType = selectedLedgerObj?.openingType ?? 'Dr'
    let currentBal = (opType === 'Cr' ? -1 : 1) * opBal
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
  }, [statementEntries, selectedLedger, selectedLedgerObj])

  const filteredStatementTxns = useMemo(() => {
    const filtered = partyTransactions.filter((txn) => {
      const matchSearch =
        txn.vNo.toLowerCase().includes(statementSearch.toLowerCase()) ||
        txn.narration.toLowerCase().includes(statementSearch.toLowerCase()) ||
        txn.vType.toLowerCase().includes(statementSearch.toLowerCase())
      const matchType = typeFilter === 'all' || txn.vType.toLowerCase() === typeFilter.toLowerCase()
      const matchDate = (!fromDate || txn.date >= fromDate) && (!toDate || txn.date <= toDate)
      return matchSearch && matchType && matchDate
    })
    return [...filtered].sort((a, b) => {
      if (statementSortKey === 'date') {
        const tA = new Date(a.date || '1970-01-01').getTime()
        const tB = new Date(b.date || '1970-01-01').getTime()
        return statementSortDir === 'asc' ? tA - tB : tB - tA
      }
      if (statementSortKey === 'amount') {
        const amtA = Math.max(a.debit, a.credit)
        const amtB = Math.max(b.debit, b.credit)
        return statementSortDir === 'asc' ? amtA - amtB : amtB - amtA
      }
      if (statementSortKey === 'debit') {
        return statementSortDir === 'asc' ? a.debit - b.debit : b.debit - a.debit
      }
      if (statementSortKey === 'credit') {
        return statementSortDir === 'asc' ? a.credit - b.credit : b.credit - a.credit
      }
      return 0
    })
  }, [partyTransactions, statementSearch, typeFilter, fromDate, toDate, statementSortKey, statementSortDir])

  const totalStatementDr = filteredStatementTxns.reduce((s, t) => s + t.debit, 0)
  const totalStatementCr = filteredStatementTxns.reduce((s, t) => s + t.credit, 0)
  const netStatementChange = totalStatementDr - totalStatementCr
  // IMPORTANT: Closing balance must always come from the CHRONOLOGICAL end (partyTransactions asc)
  // not the display-sorted array, to keep running balance correct.
  const closingBalance =
    partyTransactions.length > 0
      ? partyTransactions[partyTransactions.length - 1].runningBalance
      : selectedLedgerObj?.balance || 0
  const closingBalType =
    partyTransactions.length > 0
      ? partyTransactions[partyTransactions.length - 1].balanceType
      : selectedLedgerObj?.type || 'Dr'

  // Chronological All Transactions List (Newest to Oldest)
  const chronologicalAllTxns = useMemo(() => {
    const filtered = statementEntries.filter((txn) => {
      const matchSearch =
        !allTxnSearch ||
        txn.vNo.toLowerCase().includes(allTxnSearch.toLowerCase()) ||
        (txn.party || '').toLowerCase().includes(allTxnSearch.toLowerCase()) ||
        txn.narration.toLowerCase().includes(allTxnSearch.toLowerCase()) ||
        txn.vType.toLowerCase().includes(allTxnSearch.toLowerCase())
      const matchType = allTxnTypeFilter === 'all' || txn.vType.toLowerCase() === allTxnTypeFilter.toLowerCase()
      const matchDate = (!allTxnFromDate || txn.date >= allTxnFromDate) && (!allTxnToDate || txn.date <= allTxnToDate)
      return matchSearch && matchType && matchDate
    })

    return [...filtered].sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      if (dateA !== dateB) {
        return allTxnSortDir === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)
      }
      const timeA = (a as any).time || ''
      const timeB = (b as any).time || ''
      if (timeA && timeB) {
        return allTxnSortDir === 'desc' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB)
      }
      return (b.id || '').localeCompare(a.id || '')
    })
  }, [statementEntries, allTxnSearch, allTxnTypeFilter, allTxnFromDate, allTxnToDate, allTxnSortDir])

  const totalAllTxnDr = chronologicalAllTxns.reduce((s, t) => s + (Number(t.debit) || 0), 0)
  const totalAllTxnCr = chronologicalAllTxns.reduce((s, t) => s + (Number(t.credit) || 0), 0)
  const netAllTxnDiff = totalAllTxnDr - totalAllTxnCr

  const TransactionTable = ({ txns }: { txns: any[] }) => (
    <table className="w-full text-xs text-left min-w-[850px]">
      <thead>
        <tr className="bg-secondary/50 text-muted-foreground border-b border-border uppercase tracking-wider">
          <th className="px-4 py-3 font-medium w-36">Date &amp; Time</th>
          <th className="px-4 py-3 font-medium w-24">Type</th>
          <th className="px-4 py-3 font-medium w-32">Voucher No</th>
          <th className="px-4 py-3 font-medium w-48">Company / Party</th>
          <th className="px-4 py-3 font-medium">Narration</th>
          <th className="px-4 py-3 font-medium text-right w-28">Debit (₹)</th>
          <th className="px-4 py-3 font-medium text-right w-28">Credit (₹)</th>
          <th className="px-4 py-3 font-medium text-right w-32">Running Bal</th>
          <th className="px-3 py-3 font-medium text-center w-20">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border text-foreground">
        {txns.length === 0 && (
          <tr><td colSpan={9} className="p-6 text-center text-muted-foreground italic">No records found.</td></tr>
        )}
        {txns.map((t, i) => {
          const dt = getTxnDateTime(t.date, t.time, t.id || t.vNo)
          const compName = t.party || selectedLedger || '-'
          return (
          <tr
            key={t.id || i}
            onClick={() => handleNavigateToTransaction(t)}
            className="hover:bg-secondary/40 cursor-pointer transition group"
            title={`Click to open and modify ${t.vType?.toUpperCase()} ${t.vNo}`}
          >
            <td className="px-4 py-2.5 group-hover:text-foreground">
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 font-mono text-foreground text-[11px]">
                  <Calendar size={10} className="text-indigo-500 shrink-0" />{dt.date}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-muted-foreground text-[10px]">
                  <Clock size={9} className="shrink-0" />{dt.time}
                </span>
              </div>
            </td>
            <td className="px-4 py-2.5">
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', TYPE_BADGES[t.vType?.toLowerCase()] || 'bg-secondary text-muted-foreground border-border')}>
                {t.vType}
              </span>
            </td>
            <td className="px-4 py-2.5 font-mono text-indigo-600 dark:text-indigo-400 group-hover:underline font-medium text-[11px]">
              <span className="inline-flex items-center gap-1 underline underline-offset-2">
                {t.vNo}
                <ExternalLink size={11} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
              </span>
            </td>
            <td className="px-4 py-2.5 font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Building2 size={12} className="text-indigo-500 shrink-0" />
                <span className="truncate max-w-[190px]" title={compName}>{compName}</span>
              </span>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate group-hover:text-foreground">{t.narration || '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 font-medium">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground text-[11px]">
              {formatCurrency(t.runningBalance)} <span className="text-[9px] text-muted-foreground">{t.balanceType}</span>
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
        )})}
      </tbody>
    </table>
  )

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-white flex items-center gap-2">
            <Landmark className="text-indigo-600 dark:text-indigo-400" size={24} /> Ledger &amp; Party Master
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Chart of accounts, customer/supplier ledgers and party-wise financial statements</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Small compact zero-value delete button */}
          <button
            onClick={handleForceRemoveZeroValueTxns}
            disabled={purging}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-md text-[11px] font-medium transition disabled:opacity-50 cursor-pointer shadow-none"
            title="Delete and force remove all accounts and transactions with no value (0 txns & ₹0 balance) from Chart of Accounts"
          >
            <Trash2 size={12} className={cn(purging && 'animate-spin', 'text-rose-400 shrink-0')} />
            <span>{purging ? 'Deleting...' : 'Delete Zero-Value'}</span>
          </button>
          {activeTab === 'statement' || activeTab === 'all-transactions' ? (
            <>
              {/* Clean, high-contrast, professional Print Statement button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                title="Print statement in Borgang Drug Distributors branding style"
              >
                <Printer size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Print {activeTab === 'all-transactions' ? 'Transactions' : 'Statement'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportVisibleTables(
                    activeTab === 'all-transactions' ? 'all-transactions-chronological' : `statement-${selectedLedger || 'party'}`,
                    useUIStore.getState().company
                  )
                }
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <Download size={15} /> Export CSV
              </button>
            </>
          ) : (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition cursor-pointer">
              <Plus size={16} /> New Ledger
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border gap-2 no-print">
        <button
          onClick={() => setActiveTab('masters')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer',
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
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer',
            activeTab === 'statement'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-foreground'
          )}
        >
          <FileText size={15} /> Party-Wise Statement
        </button>
        <button
          onClick={() => setActiveTab('all-transactions')}
          className={cn(
            'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer',
            activeTab === 'all-transactions'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-foreground'
          )}
        >
          <BookOpen size={15} /> All Transactions (Chronological)
        </button>
      </div>

      {activeTab === 'masters' && (
        <div className="space-y-4 no-print">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-3 py-2 max-w-md w-full shadow-xs">
              <Search className="text-muted-foreground shrink-0" size={16} />
              <input type="text" placeholder="Search ledgers by name or group..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-foreground text-xs sm:text-sm w-full placeholder:text-muted-foreground/60" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none bg-card border border-border rounded-lg px-3 py-1.5 hover:bg-secondary/50">
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={(e) => setHideZeroBalances(e.target.checked)}
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500 bg-background"
                />
                <span>Hide Zero Balance (₹0)</span>
              </label>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none max-w-[220px]">
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

          {filteredLedgers.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm shadow-xs">
              No ledgers found matching your search or filter.
            </div>
          ) : (() => {
            // Define sub-section buckets
            const SALES_GROUPS = ['Sales Accounts', 'Sales', 'Sales Returns', 'Direct Income', 'Indirect Income', 'Other Income']
            const PURCHASE_GROUPS = ['Purchase Accounts', 'Purchases', 'Purchase Returns', 'Direct Expenses', 'Indirect Expenses', 'Manufacturing Expenses', 'Cost of Goods Sold']
            const DEBTOR_GROUPS = ['Sundry Debtors', 'Sundry Debtors & Creditors']
            const CREDITOR_GROUPS = ['Sundry Creditors']
            const VOUCHER_GROUPS = ['Cash-in-Hand', 'CASH-IN-HAND', 'Bank Accounts', 'BANK ACCOUNTS', 'Bank OCC A/C', 'BANK OCC A/C', 'Investments', 'Current Investments', 'Loans & Advances (Asset)', 'Loans (Liability)', 'Duties & Taxes', 'Provision & Contingencies', 'Reserves & Surplus', 'Capital Account', 'CAPITAL ACCOUNT']

            const normalize = (s: string) => s.trim().toLowerCase()

            const salesLedgers = filteredLedgers.filter(l => SALES_GROUPS.some(g => normalize(l.group) === normalize(g)))
            const purchaseLedgers = filteredLedgers.filter(l => PURCHASE_GROUPS.some(g => normalize(l.group) === normalize(g)))
            const debtorLedgers = filteredLedgers.filter(l => DEBTOR_GROUPS.some(g => normalize(l.group) === normalize(g)))
            const creditorLedgers = filteredLedgers.filter(l => CREDITOR_GROUPS.some(g => normalize(l.group) === normalize(g)))
            const voucherLedgers = filteredLedgers.filter(l => VOUCHER_GROUPS.some(g => normalize(l.group) === normalize(g)))
            const assignedIds = new Set([
              ...salesLedgers, ...purchaseLedgers, ...debtorLedgers,
              ...creditorLedgers, ...voucherLedgers
            ].map(l => l.id))
            const otherLedgers = filteredLedgers.filter(l => !assignedIds.has(l.id))

            const LedgerTable = ({ rows }: { rows: Ledger[] }) => (
              <table className="min-w-[1100px] w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2.5">Ledger Name</th>
                    <th className="px-4 py-2.5">Company / Party Details</th>
                    <th className="px-4 py-2.5">Account Group</th>
                    <th className="px-4 py-2.5 text-center">Txns</th>
                    <th className="px-4 py-2.5 text-right">Total Debit</th>
                    <th className="px-4 py-2.5 text-right">Total Credit</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5 text-center">Dr/Cr</th>
                    <th className="px-4 py-2.5">Last Activity</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((l) => {
                    const dt = getTxnDateTime(l.lastActivityDate, l.lastActivityTime, l.id)
                    const isPartyLedger = ['sundry debtors', 'sundry creditors', 'sundry debtors & creditors'].includes(l.group.toLowerCase())
                    return (
                      <tr key={l.id} className="hover:bg-secondary/40 text-foreground transition group">
                        <td className="px-4 py-2.5 font-medium">
                          <button
                            onClick={() => openPartyStatement(l.name)}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition text-left"
                            title="Click to view all connected transactions"
                          >
                            {l.name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          {isPartyLedger ? (
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Building2 size={12} className="text-indigo-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{l.companyName || l.name}</span>
                              {l.city && (
                                <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border shrink-0">
                                  {l.city}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                              <Building2 size={11} className="text-indigo-400 shrink-0" />
                              <span
                                className="truncate max-w-[200px]"
                                title={l.associatedCompanies && l.associatedCompanies.length > 0 ? l.associatedCompanies.join(', ') : 'Direct accounts'}
                              >
                                {l.associatedCompanies && l.associatedCompanies.length > 0
                                  ? l.associatedCompanies.slice(0, 2).join(', ') + (l.associatedCompanies.length > 2 ? ` (+${l.associatedCompanies.length - 2} parties)` : '')
                                  : 'Direct / Internal'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-[11px]">{l.group}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            (l.txnCount || 0) > 0
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'text-muted-foreground'
                          )}>
                            {l.txnCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {(l.totalDr || 0) > 0 ? formatCurrency(l.totalDr || 0) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                          {(l.totalCr || 0) > 0 ? formatCurrency(l.totalCr || 0) : '-'}
                        </td>
                        <td className={cn('px-4 py-2.5 text-right font-mono font-semibold', l.type === 'Dr' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                          ₹{l.balance.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', l.type === 'Dr' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
                            {l.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {l.lastActivityDate ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-foreground text-[11px]">
                                <Calendar size={10} className="text-indigo-500 shrink-0" />{dt.date}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-muted-foreground text-[10px]">
                                <Clock size={9} className="shrink-0" />{dt.time}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">No activity</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => openPartyStatement(l.name)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium transition cursor-pointer"
                              title="View Statement & Transactions"
                            >
                              <FileText size={12} /> Statement
                            </button>
                            <button onClick={() => editLedger(l)} className="p-1 text-muted-foreground hover:text-foreground transition cursor-pointer" title="Edit"><Edit2 size={12}/></button>
                            <button onClick={() => removeLedger(l)} className="p-1 text-muted-foreground hover:text-rose-500 transition cursor-pointer" title="Delete"><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )

            return (
              <div className="space-y-3">
                <LedgerSection
                  title="Sales & Income Accounts"
                  subtitle="Revenue, direct income, sales returns"
                  icon={TrendingUp}
                  iconColor="text-blue-400"
                  badgeBg="bg-blue-500/10 border-blue-500/20"
                  ledgers={salesLedgers}
                >
                  <LedgerTable rows={salesLedgers} />
                </LedgerSection>

                <LedgerSection
                  title="Purchase & Expense Accounts"
                  subtitle="Cost of goods, direct & indirect expenses"
                  icon={TrendingDown}
                  iconColor="text-purple-400"
                  badgeBg="bg-purple-500/10 border-purple-500/20"
                  ledgers={purchaseLedgers}
                >
                  <LedgerTable rows={purchaseLedgers} />
                </LedgerSection>

                <LedgerSection
                  title="Customer Ledgers (Sundry Debtors)"
                  subtitle="Parties who owe money — trade receivables"
                  icon={Users}
                  iconColor="text-emerald-400"
                  badgeBg="bg-emerald-500/10 border-emerald-500/20"
                  ledgers={debtorLedgers}
                >
                  <LedgerTable rows={debtorLedgers} />
                </LedgerSection>

                <LedgerSection
                  title="Supplier Ledgers (Sundry Creditors)"
                  subtitle="Parties to whom money is owed — trade payables"
                  icon={Building2}
                  iconColor="text-amber-400"
                  badgeBg="bg-amber-500/10 border-amber-500/20"
                  ledgers={creditorLedgers}
                >
                  <LedgerTable rows={creditorLedgers} />
                </LedgerSection>

                <LedgerSection
                  title="Voucher & Cash / Bank Accounts"
                  subtitle="Cash-in-hand, bank, capital, duties, reserves — used in voucher entries"
                  icon={Wallet}
                  iconColor="text-cyan-400"
                  badgeBg="bg-cyan-500/10 border-cyan-500/20"
                  ledgers={voucherLedgers}
                >
                  <LedgerTable rows={voucherLedgers} />
                </LedgerSection>

                <LedgerSection
                  title="Other Accounts"
                  subtitle="Miscellaneous accounts not classified in the above sections"
                  icon={FolderTree}
                  iconColor="text-slate-400"
                  badgeBg="bg-slate-500/10 border-slate-500/20"
                  ledgers={otherLedgers}
                  defaultOpen={false}
                >
                  <LedgerTable rows={otherLedgers} />
                </LedgerSection>
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'statement' && (
        <div className="space-y-4 no-print">
          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Select Party / Ledger</label>
                <select value={selectedLedger} onChange={(e) => setSelectedLedger(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground font-bold outline-none text-sm mt-1 focus:border-indigo-500">
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
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">From Date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground outline-none text-sm mt-1 focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">To Date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2 text-foreground outline-none text-sm mt-1 focus:border-indigo-500" />
              </div>
            </div>
            {/* Type filter + search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filter:</span>
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
                      'px-2.5 py-1 rounded text-[10px] font-medium transition border cursor-pointer',
                      typeFilter === key
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search voucher / narration..." value={statementSearch} onChange={e => setStatementSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs outline-none focus:border-indigo-500 w-56 placeholder:text-muted-foreground/60" />
              </div>
            </div>
          </div>

          {/* Sort Controls Bar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-secondary/30 border border-border rounded-xl no-print">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
              <ArrowUpDown size={11} /> Sort:
            </span>
            {([
              { key: 'date', label: 'Date', asc: '↑ Older First', desc: '↓ Newer First' },
              { key: 'amount', label: 'Amount', asc: '↑ Low→High', desc: '↓ High→Low' },
              { key: 'debit', label: 'Debit', asc: '↑ Low→High', desc: '↓ High→Low' },
              { key: 'credit', label: 'Credit', asc: '↑ Low→High', desc: '↓ High→Low' },
            ] as const).map(({ key, label, asc, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (statementSortKey === key) {
                    setStatementSortDir(statementSortDir === 'asc' ? 'desc' : 'asc')
                  } else {
                    setStatementSortKey(key)
                    setStatementSortDir(key === 'date' ? 'desc' : 'desc')
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold border transition cursor-pointer',
                  statementSortKey === key
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
                {statementSortKey === key ? (
                  statementSortDir === 'desc' ? (
                    <ArrowDown size={10} />
                  ) : (
                    <ArrowUp size={10} />
                  )
                ) : (
                  <ArrowUpDown size={10} className="opacity-40" />
                )}
                {statementSortKey === key && (
                  <span className="text-[9px] opacity-80">{statementSortDir === 'desc' ? desc : asc}</span>
                )}
              </button>
            ))}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Total Debit</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(totalStatementDr)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Total Credit</span>
                <TrendingDown size={14} className="text-rose-500" />
              </div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">{formatCurrency(totalStatementCr)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Net Movement</span>
                <Scale size={14} className={netStatementChange >= 0 ? 'text-emerald-500' : 'text-amber-500'} />
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', netStatementChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{formatCurrency(Math.abs(netStatementChange))} {netStatementChange >= 0 ? 'Dr' : 'Cr'}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Closing Balance</span>
                <Wallet size={14} className={closingBalType === 'Dr' ? 'text-indigo-500' : 'text-amber-500'} />
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', closingBalType === 'Dr' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400')}>{formatCurrency(closingBalance)} {closingBalType}</div>
            </div>
          </div>

          {/* Document count summary strip */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-3 bg-card border border-border rounded-xl text-xs shadow-xs">
            <span className="text-muted-foreground font-semibold">Documents for</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedLedger}</span>
            <span className="text-muted-foreground/60">—</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">
              <Receipt size={13} />
              <span>Invoices: {filteredStatementTxns.filter(t => t.vType === 'sale').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-medium">
              <ShoppingBag size={13} />
              <span>Bills: {filteredStatementTxns.filter(t => t.vType === 'purchase').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-foreground font-medium">
              <Truck size={13} />
              <span>Challans: {filteredStatementTxns.filter(t => t.vType === 'challan').length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
              <CreditCard size={13} />
              <span>Receipts/Pmts: {filteredStatementTxns.filter(t => ['receipt','payment'].includes(t.vType)).length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
              <FileCheck size={13} />
              <span>Vouchers: {filteredStatementTxns.filter(t => ['journal','contra','debit_note','credit_note'].includes(t.vType)).length}</span>
            </span>
            <span className="ml-auto text-muted-foreground">Total: <strong className="text-foreground">{filteredStatementTxns.length}</strong></span>
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
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="flex items-center justify-between p-3.5 bg-secondary/30 border-b border-border">
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <BookOpen size={14} className="text-indigo-400" />
                </div>
                <span>Full Chronological Ledger —</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedLedger}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">{filteredStatementTxns.length} entries</span>
              </div>
              <div className="text-xs text-muted-foreground">Period: {fromDate || 'Start'} → {toDate || 'Present'}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[750px]">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium w-36">Date &amp; Time</th>
                    <th className="text-left px-4 py-3 font-medium w-24">Voucher Type</th>
                    <th className="text-left px-4 py-3 font-medium w-32">Voucher / Ref No</th>
                    <th className="text-left px-4 py-3 font-medium w-48">Company / Party</th>
                    <th className="text-left px-4 py-3 font-medium">Particulars / Narration</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Debit (Dr ₹)</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Credit (Cr ₹)</th>
                    <th className="text-right px-4 py-3 font-medium w-36">Running Balance</th>
                    <th className="text-center px-3 py-3 font-medium w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredStatementTxns.map((txn, idx) => {
                    const dt = getTxnDateTime(txn.date, txn.time, txn.id || txn.vNo)
                    const compName = txn.party || selectedLedger || '-'
                    return (
                    <tr
                      key={txn.id || idx}
                      onClick={() => handleNavigateToTransaction(txn)}
                      className="hover:bg-secondary/40 cursor-pointer transition group"
                      title={`Click to open and modify ${txn.vType?.toUpperCase()} ${txn.vNo}`}
                    >
                      <td className="px-4 py-3 group-hover:text-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 font-mono text-foreground text-[11px]">
                            <Calendar size={10} className="text-indigo-500 shrink-0" />{dt.date}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-muted-foreground text-[10px]">
                            <Clock size={9} className="shrink-0" />{dt.time}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', TYPE_BADGES[txn.vType?.toLowerCase()] || 'bg-secondary text-muted-foreground border-border')}>{txn.vType}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 group-hover:underline font-medium">
                        <span className="inline-flex items-center gap-1 underline underline-offset-2">
                          {txn.vNo}
                          <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Building2 size={12} className="text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[190px]" title={compName}>{compName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-sm truncate group-hover:text-foreground">{txn.narration || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">{txn.debit > 0 ? formatCurrency(txn.debit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-medium">{txn.credit > 0 ? formatCurrency(txn.credit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{formatCurrency(txn.runningBalance)} <span className="text-[10px] text-muted-foreground">{txn.balanceType}</span></td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNavigateToTransaction(txn)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition cursor-pointer"
                          title={`Open & modify ${txn.vNo}`}
                        >
                          <span>Edit</span>
                          <ExternalLink size={10} />
                        </button>
                      </td>
                    </tr>
                  )})}
                  {filteredStatementTxns.length === 0 && (
                    <tr><td colSpan={9} className="p-10 text-center text-muted-foreground">No transactions found for {selectedLedger} in the selected period.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 border-t border-border text-foreground font-bold text-xs">
                    <td colSpan={5} className="px-4 py-3 uppercase">Total Movement</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalStatementDr)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">{formatCurrency(totalStatementCr)}</td>
                    <td colSpan={2} className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(closingBalance)} {closingBalType}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: All Transactions (Chronological: Newest to Oldest) */}
      {activeTab === 'all-transactions' && (
        <div className="space-y-4 no-print">
          {/* Filters Bar */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Search All Transactions</label>
                <div className="relative mt-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by voucher no, company, narration..."
                    value={allTxnSearch}
                    onChange={(e) => setAllTxnSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs outline-none focus:border-indigo-500 placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">From Date</label>
                <input
                  type="date"
                  value={allTxnFromDate}
                  onChange={(e) => setAllTxnFromDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground outline-none text-xs mt-1 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">To Date</label>
                <input
                  type="date"
                  value={allTxnToDate}
                  onChange={(e) => setAllTxnToDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground outline-none text-xs mt-1 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Type filter buttons & sort toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">Filter Type:</span>
                {[
                  { key: 'all', label: 'All Transactions' },
                  { key: 'sale', label: 'Sales' },
                  { key: 'purchase', label: 'Purchases' },
                  { key: 'challan', label: 'Challans' },
                  { key: 'receipt', label: 'Receipts' },
                  { key: 'payment', label: 'Payments' },
                  { key: 'journal', label: 'Journals' },
                  { key: 'contra', label: 'Contra / Bank' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAllTxnTypeFilter(key)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition border cursor-pointer',
                      allTxnTypeFilter === key
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sort Order Toggle */}
              <button
                type="button"
                onClick={() => setAllTxnSortDir(allTxnSortDir === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground transition cursor-pointer"
                title="Toggle chronological sorting"
              >
                <ArrowUpDown size={12} className="text-indigo-400" />
                <span>Sort: {allTxnSortDir === 'desc' ? 'Newest → Oldest (Chronological)' : 'Oldest → Newest'}</span>
                {allTxnSortDir === 'desc' ? <ArrowDown size={11} className="text-indigo-400" /> : <ArrowUp size={11} className="text-indigo-400" />}
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Total Transactions</span>
                <BookOpen size={14} className="text-indigo-400" />
              </div>
              <div className="text-lg font-bold text-foreground font-mono mt-1">{chronologicalAllTxns.length}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Total Debit</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(totalAllTxnDr)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Total Credit</span>
                <TrendingDown size={14} className="text-rose-500" />
              </div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">{formatCurrency(totalAllTxnCr)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
                <span>Net Difference</span>
                <Scale size={14} className={netAllTxnDiff >= 0 ? 'text-emerald-500' : 'text-amber-500'} />
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', netAllTxnDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                {formatCurrency(Math.abs(netAllTxnDiff))} {netAllTxnDiff >= 0 ? 'Dr' : 'Cr'}
              </div>
            </div>
          </div>

          {/* Chronological Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="flex items-center justify-between p-3.5 bg-secondary/30 border-b border-border">
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <BookOpen size={14} className="text-indigo-400" />
                </div>
                <span>All Transactions (Date-Wise Chronological Order: Newest to Oldest)</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">{chronologicalAllTxns.length} entries</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Period: {allTxnFromDate || 'Start'} → {allTxnToDate || 'Present'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium w-36">Date &amp; Time</th>
                    <th className="text-left px-4 py-3 font-medium w-24">Voucher Type</th>
                    <th className="text-left px-4 py-3 font-medium w-32">Voucher / Ref No</th>
                    <th className="text-left px-4 py-3 font-medium w-48">Company / Party</th>
                    <th className="text-left px-4 py-3 font-medium">Particulars / Narration</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Debit (Dr ₹)</th>
                    <th className="text-right px-4 py-3 font-medium w-32">Credit (Cr ₹)</th>
                    <th className="text-center px-3 py-3 font-medium w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {chronologicalAllTxns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-muted-foreground italic">
                        No transactions found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    chronologicalAllTxns.map((txn, idx) => {
                      const dt = getTxnDateTime(txn.date, (txn as any).time, txn.id || txn.vNo)
                      const compName = txn.party || '-'
                      return (
                        <tr
                          key={txn.id || idx}
                          onClick={() => handleNavigateToTransaction(txn)}
                          className="hover:bg-secondary/40 cursor-pointer transition group"
                          title={`Click to open and modify ${txn.vType?.toUpperCase()} ${txn.vNo}`}
                        >
                          <td className="px-4 py-3 group-hover:text-foreground">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-foreground text-[11px]">
                                <Calendar size={10} className="text-indigo-500 shrink-0" />{dt.date}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-muted-foreground text-[10px]">
                                <Clock size={9} className="shrink-0" />{dt.time}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border', TYPE_BADGES[txn.vType?.toLowerCase()] || 'bg-secondary text-muted-foreground border-border')}>
                              {txn.vType}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 group-hover:underline font-medium">
                            <span className="inline-flex items-center gap-1 underline underline-offset-2">
                              {txn.vNo}
                              <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition shrink-0" />
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Building2 size={12} className="text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[190px]" title={compName}>{compName}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-sm truncate group-hover:text-foreground">{txn.narration || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                            {Number(txn.debit) > 0 ? formatCurrency(Number(txn.debit)) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-medium">
                            {Number(txn.credit) > 0 ? formatCurrency(Number(txn.credit)) : '-'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigateToTransaction(txn)
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition cursor-pointer"
                              title={`Open & modify ${txn.vNo}`}
                            >
                              <span>Edit</span>
                              <ExternalLink size={10} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 border-t border-border text-foreground font-bold text-xs">
                    <td colSpan={5} className="px-4 py-3 uppercase">Total ({chronologicalAllTxns.length} Transactions)</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAllTxnDr)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">{formatCurrency(totalAllTxnCr)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          DEDICATED PRINT DOCUMENT — BORGANG DRUG DISTRIBUTORS BRANDING STYLE
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block w-full max-w-full overflow-hidden box-border text-black bg-white select-text">
        {activeTab === 'all-transactions' ? (
          <div>
            <PrintHeader
              title="ALL TRANSACTIONS REGISTER (CHRONOLOGICAL)"
              subtitle={`Period: ${allTxnFromDate || 'Start'} to ${allTxnToDate || 'Present'} | Total: ${chronologicalAllTxns.length} Transactions`}
            />

            {/* Audit Summary Box */}
            <div className="border border-black p-2.5 mb-2.5 bg-gray-50/50 text-[10px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#0c2f66]">Audit Scope: Complete Transactions Log</div>
                  <div className="text-gray-700">Chronological Sequence: Newest to Oldest</div>
                  <div className="text-gray-700">Active Filter: {allTxnTypeFilter.toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-700">Audit Period: <span className="font-bold text-black">{allTxnFromDate || 'Start'} to {allTxnToDate || 'Present'}</span></div>
                  <div className="font-semibold text-gray-700">Total Entries: <span className="font-mono font-bold text-black">{chronologicalAllTxns.length}</span></div>
                  <div className="font-semibold text-gray-700">
                    Net Movement: <span className="font-mono font-bold text-black">{formatCurrency(Math.abs(netAllTxnDiff))} {netAllTxnDiff >= 0 ? 'Dr' : 'Cr'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Chronological Transactions Table with Automatic Fit to Page */}
            <table className="w-full table-fixed text-[8pt] border-collapse border border-black mb-3">
              <thead>
                <tr className="bg-gray-100 text-black border-b border-black font-bold uppercase text-[7.5pt]">
                  <th className="border-r border-black p-1 text-center w-[4%]">#</th>
                  <th className="border-r border-black p-1 text-left w-[14%]">Date &amp; Time</th>
                  <th className="border-r border-black p-1 text-center w-[7%]">Type</th>
                  <th className="border-r border-black p-1 text-left w-[12%]">Voucher No</th>
                  <th className="border-r border-black p-1 text-left w-[24%]">Company / Party</th>
                  <th className="border-r border-black p-1 text-left w-[19%]">Particulars / Narration</th>
                  <th className="border-r border-black p-1 text-right w-[10%]">Debit (Dr ₹)</th>
                  <th className="p-1 text-right w-[10%]">Credit (Cr ₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {chronologicalAllTxns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500 italic">No transactions found.</td>
                  </tr>
                ) : (
                  chronologicalAllTxns.map((t, idx) => {
                    const dt = getTxnDateTime(t.date, (t as any).time, t.id || t.vNo)
                    const comp = t.party || '-'
                    return (
                      <tr key={t.id || idx} className="border-b border-gray-200">
                        <td className="border-r border-black p-1 text-center font-mono text-[7.5pt]">{idx + 1}</td>
                        <td className="border-r border-black p-1 font-mono text-[7.5pt] leading-tight">{dt.date} {dt.time}</td>
                        <td className="border-r border-black p-1 text-center uppercase font-semibold text-[7.5pt]">{t.vType}</td>
                        <td className="border-r border-black p-1 font-mono font-bold text-[7.5pt] break-all">{t.vNo}</td>
                        <td className="border-r border-black p-1 font-medium break-words text-[7.5pt]">{comp}</td>
                        <td className="border-r border-black p-1 break-words text-[7.5pt]">{t.narration || '-'}</td>
                        <td className="border-r border-black p-1 text-right font-mono font-semibold text-[7.5pt] whitespace-nowrap">
                          {Number(t.debit) > 0 ? formatCurrency(Number(t.debit)) : '-'}
                        </td>
                        <td className="p-1 text-right font-mono font-semibold text-[7.5pt] whitespace-nowrap">
                          {Number(t.credit) > 0 ? formatCurrency(Number(t.credit)) : '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-[1.5px] border-black bg-gray-100 font-bold text-[8.5pt]">
                  <td colSpan={6} className="border-r border-black p-1.5 text-right uppercase">
                    Total ({chronologicalAllTxns.length} Transactions)
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono text-emerald-800 whitespace-nowrap text-[8pt]">
                    {formatCurrency(totalAllTxnDr)}
                  </td>
                  <td className="p-1 text-right font-mono text-rose-800 whitespace-nowrap text-[8pt]">
                    {formatCurrency(totalAllTxnCr)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signatory Footer */}
            <div className="grid grid-cols-2 pt-4 text-[9px] border-t border-black mt-3">
              <div>
                <div className="text-gray-700 font-bold uppercase text-[9.5px]">Borgang Drug Distributors &bull; Biswanath, Assam</div>
                <div className="text-gray-500 text-[8.5px] mt-0.5 leading-tight">
                  This report is an authentic, system-generated transaction register.<br/>
                  All transactions reflected herein are subject to Biswanath Jurisdiction.
                </div>
              </div>
              <div className="text-right flex flex-col justify-end">
                <div className="font-bold text-[10px] text-[#0c2f66] uppercase mb-7">For BORGANG DRUG DISTRIBUTORS</div>
                <div className="font-semibold text-gray-800 border-t border-gray-400 inline-block pt-1 ml-auto w-44 text-center">
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <PrintHeader
              title="STATEMENT OF ACCOUNTS / PARTY LEDGER"
              subtitle={`Party: ${selectedLedger || 'All Ledgers'} | Period: ${fromDate || 'Start'} to ${toDate || 'Present'}`}
            />

            {/* Party & Financial Summary Box in Borgang Drug Distributors Style */}
            <div className="border border-black p-2.5 mb-2.5 bg-gray-50/50 text-[10px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-black uppercase text-[#0c2f66]">{selectedLedger}</div>
                  <div className="text-gray-700 font-medium mt-0.5">Account Group: {selectedLedgerObj?.group || 'Sundry Debtors'}</div>
                  {selectedLedgerObj?.city && <div className="text-gray-700 font-medium">Station / City: {selectedLedgerObj.city}</div>}
                  {selectedLedgerObj?.companyName && selectedLedgerObj.companyName !== selectedLedger && (
                    <div className="text-gray-700">Trade Entity: {selectedLedgerObj.companyName}</div>
                  )}
                </div>
                <div className="text-right space-y-0.5">
                  <div className="font-medium text-gray-700">Statement Period: <span className="font-bold text-black">{fromDate || 'Start'} to {toDate || 'Present'}</span></div>
                  <div className="font-medium text-gray-700">Opening Balance: <span className="font-mono font-bold text-black">{formatCurrency(selectedLedgerObj?.openingBalance || 0)} {selectedLedgerObj?.openingType || 'Dr'}</span></div>
                  <div className="font-medium text-gray-700">Total Debit (Dr): <span className="font-mono font-bold text-emerald-800">{formatCurrency(totalStatementDr)}</span></div>
                  <div className="font-medium text-gray-700">Total Credit (Cr): <span className="font-mono font-bold text-rose-800">{formatCurrency(totalStatementCr)}</span></div>
                  <div className="font-bold text-black text-[11px] pt-0.5 border-t border-gray-300">
                    Closing Balance: <span className="font-mono text-[#0c2f66]">{formatCurrency(closingBalance)} {closingBalType}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Chronological Transactions Table with Automatic Fit to Page */}
            <table className="w-full table-fixed text-[8pt] border-collapse border border-black mb-3">
              <thead>
                <tr className="bg-gray-100 text-black border-b border-black font-bold uppercase text-[7.5pt]">
                  <th className="border-r border-black p-1 text-center w-[4%]">#</th>
                  <th className="border-r border-black p-1 text-left w-[14%]">Date &amp; Time</th>
                  <th className="border-r border-black p-1 text-center w-[7%]">Type</th>
                  <th className="border-r border-black p-1 text-left w-[12%]">Voucher No</th>
                  <th className="border-r border-black p-1 text-left w-[27%]">Particulars / Narration</th>
                  <th className="border-r border-black p-1 text-right w-[12%]">Debit (Dr ₹)</th>
                  <th className="border-r border-black p-1 text-right w-[12%]">Credit (Cr ₹)</th>
                  <th className="p-1 text-right w-[12%]">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {/* Initial Opening Balance Line */}
                <tr className="bg-gray-50/70 border-b border-gray-300 font-semibold italic text-gray-700">
                  <td className="border-r border-black p-1 text-center font-mono text-[7.5pt]">0</td>
                  <td className="border-r border-black p-1 font-mono text-[7.5pt]">{fromDate || 'Opening'}</td>
                  <td className="border-r border-black p-1 text-center uppercase text-[7.5pt]">OP-BAL</td>
                  <td className="border-r border-black p-1 font-mono text-[7.5pt]">—</td>
                  <td className="border-r border-black p-1 break-words text-[7.5pt]">Opening Balance Brought Forward</td>
                  <td className="border-r border-black p-1 text-right font-mono text-[7.5pt] whitespace-nowrap">
                    {selectedLedgerObj?.openingType === 'Dr' && Number(selectedLedgerObj.openingBalance) > 0 ? formatCurrency(Number(selectedLedgerObj.openingBalance || 0)) : '-'}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono text-[7.5pt] whitespace-nowrap">
                    {selectedLedgerObj?.openingType === 'Cr' && Number(selectedLedgerObj.openingBalance) > 0 ? formatCurrency(Number(selectedLedgerObj.openingBalance || 0)) : '-'}
                  </td>
                  <td className="p-1 text-right font-mono font-bold text-gray-900 text-[7.5pt] whitespace-nowrap">
                    {formatCurrency(selectedLedgerObj?.openingBalance || 0)} {selectedLedgerObj?.openingType || 'Dr'}
                  </td>
                </tr>

                {filteredStatementTxns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500 italic">No transactions found for this party in the selected period.</td>
                  </tr>
                ) : (
                  filteredStatementTxns.map((t, idx) => {
                    const dt = getTxnDateTime(t.date, t.time, t.id || t.vNo)
                    return (
                      <tr key={t.id || idx} className="border-b border-gray-200">
                        <td className="border-r border-black p-1 text-center font-mono text-[7.5pt]">{idx + 1}</td>
                        <td className="border-r border-black p-1 font-mono text-[7.5pt] leading-tight">{dt.date} {dt.time}</td>
                        <td className="border-r border-black p-1 text-center uppercase font-semibold text-[7.5pt]">{t.vType}</td>
                        <td className="border-r border-black p-1 font-mono font-bold text-[7.5pt] break-all">{t.vNo}</td>
                        <td className="border-r border-black p-1 break-words text-[7.5pt]">{t.narration || '-'}</td>
                        <td className="border-r border-black p-1 text-right font-mono font-semibold text-[7.5pt] whitespace-nowrap">
                          {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                        </td>
                        <td className="border-r border-black p-1 text-right font-mono font-semibold text-[7.5pt] whitespace-nowrap">
                          {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                        </td>
                        <td className="p-1 text-right font-mono font-bold text-[7.5pt] whitespace-nowrap">
                          {formatCurrency(t.runningBalance)} {t.balanceType}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-[1.5px] border-black bg-gray-100 font-bold text-[8.5pt]">
                  <td colSpan={5} className="border-r border-black p-1.5 text-right uppercase">
                    Total Movement ({filteredStatementTxns.length} Transactions)
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono text-emerald-800 whitespace-nowrap text-[8pt]">
                    {formatCurrency(totalStatementDr)}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono text-rose-800 whitespace-nowrap text-[8pt]">
                    {formatCurrency(totalStatementCr)}
                  </td>
                  <td className="p-1 text-right font-mono font-extrabold text-[#0c2f66] whitespace-nowrap text-[8pt]">
                    {formatCurrency(closingBalance)} {closingBalType}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Declaration and Signatory Block */}
            <div className="grid grid-cols-2 pt-4 text-[9px] border-t border-black mt-3">
              <div>
                <div className="text-gray-700 font-bold uppercase text-[9.5px]">Terms &amp; Conditions:</div>
                <div className="text-gray-500 text-[8.5px] mt-0.5 leading-tight">
                  1. Kindly check this statement and notify us of any discrepancy within 7 days.<br/>
                  2. All payments must be made by crossed cheque / NEFT / RTGS in favour of Borgang Drug Distributors.<br/>
                  3. Subject to Biswanath Jurisdiction only.
                </div>
              </div>
              <div className="text-right flex flex-col justify-end">
                <div className="font-bold text-[10px] text-[#0c2f66] uppercase mb-7">For BORGANG DRUG DISTRIBUTORS</div>
                <div className="font-semibold text-gray-800 border-t border-gray-400 inline-block pt-1 ml-auto w-44 text-center">
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-foreground">
              <h3 className="text-base sm:text-lg font-bold text-foreground">Create New Ledger</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ledger Name *</label>
                  <input type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account Group *</label>
                  <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-sm outline-none focus:border-indigo-500">
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
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-xs cursor-pointer">Save</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {editModalLedger &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-foreground">
              <h3 className="text-base sm:text-lg font-bold text-foreground">Edit Ledger Account</h3>
              <form onSubmit={confirmEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ledger / Account Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account Group *</label>
                  <select
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-sm outline-none focus:border-indigo-500"
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
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-sm outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {(editModalLedger.group.toLowerCase().includes('debtor') || editModalLedger.group.toLowerCase().includes('creditor') || editModalLedger.group.toLowerCase().includes('both')) && (
                  <div className="pt-1">
                    <Link
                      to={`/masters/parties?search=${encodeURIComponent(editModalLedger.name)}`}
                      onClick={() => setEditModalLedger(null)}
                      className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      <ExternalLink size={13} /> Edit Full Customer/Supplier Master (GST, DL, Address, Credit)
                    </Link>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button type="button" onClick={() => setEditModalLedger(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-xs cursor-pointer">Update Ledger</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {deleteConfirmLedger &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[9999]">
            <div className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-foreground">
              <h3 className="text-base sm:text-lg font-bold text-rose-500">Confirm Deletion</h3>
              <p className="text-sm text-foreground">
                Are you sure you want to delete <strong className="text-foreground">{deleteConfirmLedger.name}</strong>?
              </p>
              <div className="text-xs text-muted-foreground">
                Ledgers linked to existing posted transactions cannot be deleted.
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmLedger(null)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
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
