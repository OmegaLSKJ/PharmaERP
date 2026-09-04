import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Landmark,
  Banknote,
  ArrowRightLeft,
  Save,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  FileText,
  X,
  Calendar,
  Hash,
  Layers,
  Zap,
  History,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Building2,
  UserCheck
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import VoucherPrint, { VoucherPrintData } from '../../components/accounting/VoucherPrint'

interface VoucherLine {
  id: string
  ledger: string
  physicalVchNo?: string
  debit: number
  credit: number
  narration: string
}

interface PartyItem {
  id: string
  code?: string
  name: string
  type?: 'customer' | 'supplier' | 'both'
  balance?: number
}

interface AccountItem {
  id?: string
  code?: string
  name: string
  group?: string
  type?: string
  balance?: number
}

interface SavedVoucher {
  id: string
  number?: string
  voucher_number?: string
  type?: string
  voucher_type?: string
  party?: string
  date?: string
  voucher_date?: string
  total?: number
  narration?: string
  lines?: VoucherLine[]
}

const DEFAULT_CASH_ACCOUNTS = ['Cash Account', 'Cash in Hand', 'Petty Cash']
const DEFAULT_BANK_ACCOUNTS = ['HDFC Bank', 'State Bank of India (SBI)', 'ICICI Bank', 'Axis Bank']
const AMOUNT_PRESETS = [500, 1000, 2000, 5000, 10000, 25000, 50000]

function generateVoucherNo(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(10000 + Math.random() * 90000)
  return `VCH-${year}-${rand}`
}

export default function VoucherEntry() {
  const [searchParams] = useSearchParams()
  const showToast = useUIStore((s) => s.showToast)
  const incrementLedgerVersion = useUIStore((s) => s.incrementLedgerVersion)

  // ── Mode: Quick 1-Click vs Multi-Line ──────────────────────────
  const [activeTab, setActiveTab] = useState<'quick' | 'multiline'>('quick')

  // ── Common Voucher Meta ───────────────────────────────────────
  const [vType, setVType] = useState<'Receipt' | 'Payment' | 'Contra' | 'Journal'>('Receipt')
  const [vNo, setVNo] = useState(generateVoucherNo)
  const [vDate, setVDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [physicalVchNo, setPhysicalVchNo] = useState('')
  const [chequeRef, setChequeRef] = useState('')

  // ── Quick Entry State ─────────────────────────────────────────
  const [selectedParty, setSelectedParty] = useState('')
  const [selectedCashBank, setSelectedCashBank] = useState('Cash in Hand')
  const [amount, setAmount] = useState<number | ''>('')
  const [contraTarget, setContraTarget] = useState('HDFC Bank')
  const [userNarration, setUserNarration] = useState('')

  // ── Multi-Line State ──────────────────────────────────────────
  const [lines, setLines] = useState<VoucherLine[]>([])
  const [multiNarration, setMultiNarration] = useState('')

  // ── Master Data State ─────────────────────────────────────────
  const [parties, setParties] = useState<PartyItem[]>([])
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [cashAccounts, setCashAccounts] = useState<string[]>(DEFAULT_CASH_ACCOUNTS)
  const [bankAccounts, setBankAccounts] = useState<string[]>(DEFAULT_BANK_ACCOUNTS)
  const [recentVouchers, setRecentVouchers] = useState<SavedVoucher[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Print Modal State ─────────────────────────────────────────
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printDataOverride, setPrintDataOverride] = useState<VoucherPrintData | null>(null)

  // ── Party Filter/Search State ─────────────────────────────────
  const [partySearch, setPartySearch] = useState('')

  const amountInputRef = useRef<HTMLInputElement>(null)

  // ── Load Master Data & Recent Vouchers ─────────────────────────
  const loadMasterData = async () => {
    setLoadingData(true)
    try {
      const [fetchedAccounts, fetchedParties, fetchedVouchers] = await Promise.all([
        getErp<AccountItem[]>('accounts').catch(() => []),
        getErp<PartyItem[]>('parties').catch(() => []),
        getErp<SavedVoucher[]>('vouchers').catch(() => [])
      ])

      // Extract cash and bank accounts
      const cashList: string[] = []
      const bankList: string[] = []

      fetchedAccounts.forEach((acc) => {
        const grp = (acc.group || '').toLowerCase()
        const n = acc.name.toLowerCase()
        if (grp.includes('cash') || n.includes('cash')) {
          cashList.push(acc.name)
        } else if (grp.includes('bank') || n.includes('bank')) {
          bankList.push(acc.name)
        }
      })

      const finalCash = Array.from(new Set([...cashList, ...DEFAULT_CASH_ACCOUNTS]))
      const finalBank = Array.from(new Set([...bankList, ...DEFAULT_BANK_ACCOUNTS]))

      setCashAccounts(finalCash)
      setBankAccounts(finalBank)
      setAccounts(fetchedAccounts)
      setParties(fetchedParties)

      // Set default cash/bank account if needed
      if (finalCash.length > 0 && !selectedCashBank) {
        setSelectedCashBank(finalCash[0])
      }
      if (finalBank.length > 0 && !contraTarget) {
        setContraTarget(finalBank[0])
      }

      if (Array.isArray(fetchedVouchers)) {
        setRecentVouchers(fetchedVouchers.slice(0, 8))
      }
    } catch (err: any) {
      console.warn('Error loading master data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadMasterData()
  }, [])

  // ── URL Search Params Handling ────────────────────────────────
  useEffect(() => {
    const qVNo = searchParams.get('vNo')
    const qType = searchParams.get('type')
    const qParty = searchParams.get('party')
    const qAmount = searchParams.get('amount')

    if (qVNo) setVNo(qVNo)
    if (qType) {
      const formatted = (qType.charAt(0).toUpperCase() + qType.slice(1).toLowerCase()) as any
      if (['Receipt', 'Payment', 'Contra', 'Journal'].includes(formatted)) {
        setVType(formatted)
      }
    }
    if (qParty) setSelectedParty(qParty)
    if (qAmount && !isNaN(Number(qAmount))) setAmount(Number(qAmount))
  }, [searchParams])

  // ── Categorized Party Lists ───────────────────────────────────
  const customerList = useMemo(
    () => parties.filter((p) => p.type === 'customer' || p.type === 'both' || !p.type),
    [parties]
  )
  const supplierList = useMemo(
    () => parties.filter((p) => p.type === 'supplier' || p.type === 'both'),
    [parties]
  )
  const generalLedgers = useMemo(
    () =>
      accounts
        .filter((a) => !cashAccounts.includes(a.name) && !bankAccounts.includes(a.name))
        .map((a) => a.name),
    [accounts, cashAccounts, bankAccounts]
  )

  // Selected party info (balance etc.)
  const selectedPartyObj = useMemo(
    () => parties.find((p) => p.name.toLowerCase() === selectedParty.toLowerCase()),
    [parties, selectedParty]
  )

  // Selected cash/bank account info
  const selectedCashBankObj = useMemo(
    () => accounts.find((a) => a.name.toLowerCase() === selectedCashBank.toLowerCase()),
    [accounts, selectedCashBank]
  )

  // ── Dynamic Auto Narration ────────────────────────────────────
  const defaultNarration = useMemo(() => {
    const amtStr = amount ? formatCurrency(Number(amount)) : '₹0'
    const docRef = physicalVchNo ? ` (Phys Vch: ${physicalVchNo})` : ''
    const chq = chequeRef ? ` [Ref: ${chequeRef}]` : ''

    if (vType === 'Receipt') {
      return selectedParty
        ? `Received ${amtStr} from ${selectedParty} via ${selectedCashBank}${docRef}${chq}`
        : `Cash/Bank receipt via ${selectedCashBank}${docRef}${chq}`
    } else if (vType === 'Payment') {
      return selectedParty
        ? `Paid ${amtStr} to ${selectedParty} from ${selectedCashBank}${docRef}${chq}`
        : `Cash/Bank payment from ${selectedCashBank}${docRef}${chq}`
    } else if (vType === 'Contra') {
      return `Transfer of ${amtStr} from ${selectedCashBank} to ${contraTarget}${docRef}${chq}`
    } else {
      return selectedParty
        ? `Journal adjustment of ${amtStr} for ${selectedParty}${docRef}`
        : `Journal voucher entry${docRef}`
    }
  }, [vType, amount, selectedParty, selectedCashBank, contraTarget, physicalVchNo, chequeRef])

  const effectiveNarration = userNarration.trim() ? userNarration : defaultNarration

  // ── Multi-Line Calculations ───────────────────────────────────
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const lineDiff = Math.abs(totalDebit - totalCredit)
  const isMultiBalanced = lines.length >= 2 && totalDebit > 0 && lineDiff < 0.001

  // ── Multi-Line Operations ─────────────────────────────────────
  const addLine = (defaultLedger = '', defaultDebit = 0, defaultCredit = 0) => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        ledger: defaultLedger,
        physicalVchNo: physicalVchNo || '',
        debit: defaultDebit,
        credit: defaultCredit,
        narration: ''
      }
    ])
  }

  const updateLine = (id: string, field: keyof VoucherLine, value: string | number) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const autoBalanceMultiLine = (target: 'cash' | 'bank') => {
    if (lineDiff <= 0) {
      showToast('Voucher lines are already balanced!')
      return
    }
    const acc = target === 'cash' ? cashAccounts[0] || 'Cash Account' : bankAccounts[0] || 'HDFC Bank'
    if (totalDebit > totalCredit) {
      addLine(acc, 0, lineDiff)
    } else {
      addLine(acc, lineDiff, 0)
    }
    showToast(`Balanced with ${acc} (₹${lineDiff.toFixed(2)})`)
  }

  // ── Quick Entry Balanced Lines Preview ────────────────────────
  const quickBuiltLines: VoucherLine[] = useMemo(() => {
    const numAmt = Number(amount) || 0
    if (numAmt <= 0) return []

    const partyName = selectedParty || (vType === 'Payment' ? 'Supplier Account' : 'Customer Account')
    const cashAcc = selectedCashBank || 'Cash in Hand'

    if (vType === 'Receipt') {
      return [
        {
          id: 'q1',
          ledger: cashAcc,
          debit: numAmt,
          credit: 0,
          physicalVchNo,
          narration: chequeRef ? `Ref: ${chequeRef}` : 'Received in cash/bank'
        },
        {
          id: 'q2',
          ledger: partyName,
          debit: 0,
          credit: numAmt,
          physicalVchNo,
          narration: 'Account credit / receipt'
        }
      ]
    } else if (vType === 'Payment') {
      return [
        {
          id: 'q1',
          ledger: partyName,
          debit: numAmt,
          credit: 0,
          physicalVchNo,
          narration: 'Account debit / payment'
        },
        {
          id: 'q2',
          ledger: cashAcc,
          debit: 0,
          credit: numAmt,
          physicalVchNo,
          narration: chequeRef ? `Ref: ${chequeRef}` : 'Paid via cash/bank'
        }
      ]
    } else if (vType === 'Contra') {
      return [
        {
          id: 'q1',
          ledger: contraTarget || 'HDFC Bank',
          debit: numAmt,
          credit: 0,
          physicalVchNo,
          narration: 'Contra deposit / transfer'
        },
        {
          id: 'q2',
          ledger: cashAcc,
          debit: 0,
          credit: numAmt,
          physicalVchNo,
          narration: 'Contra withdrawal / transfer'
        }
      ]
    } else {
      return [
        {
          id: 'q1',
          ledger: cashAcc,
          debit: numAmt,
          credit: 0,
          physicalVchNo,
          narration: 'Journal Debit'
        },
        {
          id: 'q2',
          ledger: partyName,
          debit: 0,
          credit: numAmt,
          physicalVchNo,
          narration: 'Journal Credit'
        }
      ]
    }
  }, [vType, amount, selectedParty, selectedCashBank, contraTarget, physicalVchNo, chequeRef])

  // ── Unified Save Handler ──────────────────────────────────────
  const handleSaveVoucher = async () => {
    let finalLines: VoucherLine[] = []
    let finalTotal = 0
    let primaryPartyName = ''

    if (activeTab === 'quick') {
      const numAmt = Number(amount)
      if (!numAmt || numAmt <= 0) {
        showToast('Please enter a valid amount greater than zero.')
        amountInputRef.current?.focus()
        return
      }

      if (vType !== 'Contra' && !selectedParty.trim()) {
        showToast('Please select a Party / Company for this voucher.')
        return
      }

      if (!selectedCashBank.trim()) {
        showToast('Please select a Cash or Bank account.')
        return
      }

      finalLines = quickBuiltLines
      finalTotal = numAmt
      primaryPartyName = vType === 'Contra' ? `${selectedCashBank} ➔ ${contraTarget}` : selectedParty
    } else {
      // Multi-line mode validation
      if (lines.length < 2) {
        showToast('Multi-line vouchers require at least 2 lines.')
        return
      }

      const emptyLedger = lines.some((l) => !l.ledger || !l.ledger.trim())
      if (emptyLedger) {
        showToast('All voucher lines must have a Ledger Account selected.')
        return
      }

      if (totalDebit <= 0 || totalCredit <= 0) {
        showToast('Total Debit and Credit must be greater than zero.')
        return
      }

      if (lineDiff > 0.001) {
        showToast(
          `Voucher is not balanced! Total Debit (${formatCurrency(totalDebit)}) != Total Credit (${formatCurrency(totalCredit)}). Difference: ${formatCurrency(lineDiff)}`
        )
        return
      }

      finalLines = lines
      finalTotal = totalDebit
      primaryPartyName =
        lines.find((l) => !cashAccounts.includes(l.ledger) && !bankAccounts.includes(l.ledger))?.ledger ||
        selectedParty ||
        'General Voucher'
    }

    try {
      setSaving(true)

      const payload = {
        id: vNo,
        number: vNo,
        voucher_number: vNo,
        type: vType,
        voucher_type: vType.toLowerCase(),
        date: vDate,
        voucher_date: vDate,
        party: primaryPartyName,
        cashAccount: selectedCashBank,
        amount: finalTotal,
        total: finalTotal,
        physicalVoucherNo: physicalVchNo || '',
        physical_voucher_no: physicalVchNo || '',
        chequeRef: chequeRef || '',
        narration: activeTab === 'quick' ? effectiveNarration : multiNarration || effectiveNarration,
        lines: finalLines
      }

      const saved = await postErp<{ id: string }>('vouchers', payload)
      const savedNumber = saved?.id || vNo

      showToast(`✓ ${vType} Voucher ${savedNumber} posted successfully! (${formatCurrency(finalTotal)})`)
      incrementLedgerVersion()

      // Add to recent vouchers
      setRecentVouchers((prev) => [
        {
          id: savedNumber,
          number: savedNumber,
          type: vType,
          party: primaryPartyName,
          date: vDate,
          total: finalTotal,
          narration: payload.narration,
          lines: finalLines
        },
        ...prev.slice(0, 9)
      ])

      // Reset form
      setAmount('')
      setUserNarration('')
      setPhysicalVchNo('')
      setChequeRef('')
      setLines([])
      setMultiNarration('')
      setVNo(generateVoucherNo())
    } catch (err: any) {
      console.error('Error saving voucher:', err)
      setVNo(generateVoucherNo())
      showToast(err.message || 'Could not save voucher.')
    } finally {
      setSaving(false)
    }
  }

  // ── Print Preview Preparation ─────────────────────────────────
  const handleOpenPrint = (v?: SavedVoucher) => {
    if (v) {
      setPrintDataOverride({
        voucherType: v.type || v.voucher_type || 'Receipt',
        voucherNo: v.number || v.voucher_number || v.id,
        voucherDate: v.date || v.voucher_date || vDate,
        partyAccount: v.party,
        totalAmount: Number(v.total) || 0,
        narration: v.narration,
        lines: (v.lines || []).map((l, i) => ({
          sNo: i + 1,
          ledger: l.ledger,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration
        }))
      })
    } else {
      const currentTotal = activeTab === 'quick' ? Number(amount) || 0 : totalDebit
      const currentLines = activeTab === 'quick' ? quickBuiltLines : lines
      setPrintDataOverride({
        voucherType: vType,
        voucherNo: vNo,
        voucherDate: vDate,
        physicalVoucherNo: physicalVchNo || undefined,
        paymentMode: selectedCashBank,
        primaryAccount: selectedCashBank,
        partyAccount: selectedParty,
        bankRefNo: chequeRef || undefined,
        lines: currentLines.map((l, i) => ({
          sNo: i + 1,
          ledger: l.ledger,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration
        })),
        totalAmount: currentTotal,
        narration: effectiveNarration
      })
    }
    setShowPrintModal(true)
  }

  // Keyboard shortcut Alt+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        handleOpenPrint()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [vType, vNo, vDate, physicalVchNo, selectedCashBank, selectedParty, chequeRef, amount, lines, activeTab])

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Landmark size={22} />
            </span>
            Voucher Entry
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            One-click direct Cash &amp; Bank entries &bull; Receipts, Payments, Contra &amp; Journals
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print button */}
          <button
            type="button"
            onClick={() => handleOpenPrint()}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            title="Print Preview (Alt+P)"
          >
            <Printer size={14} className="text-indigo-400" />
            <span>Print Voucher</span>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-black/30 rounded border border-slate-700">
              Alt+P
            </kbd>
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={() => {
              setAmount('')
              setSelectedParty('')
              setUserNarration('')
              setPhysicalVchNo('')
              setChequeRef('')
              setLines([])
              setVNo(generateVoucherNo())
              showToast('Form cleared')
            }}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            Clear Form
          </button>
        </div>
      </div>

      {/* ── Voucher Type Selector & Mode Tabs ───────────────────────── */}
      <div className="no-print bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Voucher Types */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
            <button
              type="button"
              onClick={() => setVType('Receipt')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer',
                vType === 'Receipt'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-950'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              )}
            >
              <TrendingDown size={16} className={vType === 'Receipt' ? 'text-emerald-400' : 'text-slate-500'} />
              <span>Receipt (Cash In)</span>
            </button>

            <button
              type="button"
              onClick={() => setVType('Payment')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer',
                vType === 'Payment'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm shadow-rose-950'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              )}
            >
              <TrendingUp size={16} className={vType === 'Payment' ? 'text-rose-400' : 'text-slate-500'} />
              <span>Payment (Cash Out)</span>
            </button>

            <button
              type="button"
              onClick={() => setVType('Contra')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer',
                vType === 'Contra'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-950'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              )}
            >
              <ArrowRightLeft size={16} className={vType === 'Contra' ? 'text-blue-400' : 'text-slate-500'} />
              <span>Contra (Transfer)</span>
            </button>

            <button
              type="button"
              onClick={() => setVType('Journal')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer',
                vType === 'Journal'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm shadow-purple-950'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              )}
            >
              <FileText size={16} className={vType === 'Journal' ? 'text-purple-400' : 'text-slate-500'} />
              <span>Journal (General)</span>
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activeTab === 'quick'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Zap size={13} />
              <span>Quick Entry</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('multiline')
                if (lines.length === 0 && Number(amount) > 0) {
                  setLines(quickBuiltLines)
                }
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                activeTab === 'multiline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Layers size={13} />
              <span>Multi-Line Grid</span>
            </button>
          </div>
        </div>

        {/* Common Metadata Row: Voucher No, Date, Phys No, Ref */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Voucher No.
            </label>
            <div className="relative">
              <input
                type="text"
                value={vNo}
                onChange={(e) => setVNo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-mono font-medium outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Voucher Date
            </label>
            <input
              type="date"
              value={vDate}
              onChange={(e) => setVDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Physical / Manual Vch No. <span className="text-slate-500 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. PV-101 / Book #4"
              value={physicalVchNo}
              onChange={(e) => setPhysicalVchNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Cheque / UTR / Ref No. <span className="text-slate-500 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. CHQ-99120 / NEFT..."
              value={chequeRef}
              onChange={(e) => setChequeRef(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* ── TAB 1: QUICK 1-CLICK ENTRY PANEL ───────────────────────── */}
      {activeTab === 'quick' && (
        <div className="no-print space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/20 border border-indigo-500/20 rounded-2xl p-5 shadow-lg shadow-indigo-950/20 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Zap size={16} />
                </span>
                <span className="text-sm font-bold text-white tracking-tight">
                  {vType === 'Receipt' && 'Cash / Bank Receipt Entry'}
                  {vType === 'Payment' && 'Cash / Bank Payment Entry'}
                  {vType === 'Contra' && 'Bank & Cash Transfer (Contra)'}
                  {vType === 'Journal' && 'Journal Adjustment Entry'}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Instant Auto-Balance
                </span>
              </div>

              {selectedPartyObj && (
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Party Balance:</span>
                  <span
                    className={cn(
                      'font-mono font-semibold px-2 py-0.5 rounded-lg border',
                      (selectedPartyObj.balance || 0) >= 0
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    )}
                  >
                    {formatCurrency(Math.abs(selectedPartyObj.balance || 0))}{' '}
                    {(selectedPartyObj.balance || 0) >= 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
              )}
            </div>

            {/* Main Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Party Selection (For Receipt, Payment, Journal) */}
              {vType !== 'Contra' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Party / Company / Customer</span>
                    {selectedPartyObj && (
                      <span className="text-[10px] text-indigo-400 sm:hidden">
                        Bal: {formatCurrency(Math.abs(selectedPartyObj.balance || 0))}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedParty}
                      onChange={(e) => setSelectedParty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition font-medium"
                    >
                      <option value="">Select Party / Ledger...</option>
                      {customerList.length > 0 && (
                        <optgroup label="👥 Customers (Sundry Debtors)">
                          {customerList.map((c) => (
                            <option key={c.id || c.name} value={c.name}>
                              {c.name} {c.balance !== undefined ? `(${formatCurrency(c.balance)})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {supplierList.length > 0 && (
                        <optgroup label="🏢 Suppliers (Sundry Creditors)">
                          {supplierList.map((s) => (
                            <option key={s.id || s.name} value={s.name}>
                              {s.name} {s.balance !== undefined ? `(${formatCurrency(s.balance)})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {generalLedgers.length > 0 && (
                        <optgroup label="📑 General Ledgers">
                          {generalLedgers.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
              ) : (
                /* Source Account for Contra */
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Transfer From (Source Account)
                  </label>
                  <select
                    value={selectedCashBank}
                    onChange={(e) => setSelectedCashBank(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition font-medium"
                  >
                    <optgroup label="💵 Cash Accounts">
                      {cashAccounts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🏦 Bank Accounts">
                      {bankAccounts.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Cash / Bank Account Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {vType === 'Contra'
                    ? 'Transfer To (Destination Account)'
                    : vType === 'Receipt'
                      ? 'Received In (Cash / Bank)'
                      : 'Paid From (Cash / Bank)'}
                </label>
                <select
                  value={vType === 'Contra' ? contraTarget : selectedCashBank}
                  onChange={(e) => (vType === 'Contra' ? setContraTarget(e.target.value) : setSelectedCashBank(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition font-medium"
                >
                  {vType === 'Contra' ? (
                    <>
                      <optgroup label="🏦 Bank Accounts">
                        {bankAccounts.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="💵 Cash Accounts">
                        {cashAccounts.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <optgroup label="💵 Cash Accounts">
                        {cashAccounts.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🏦 Bank Accounts">
                        {bankAccounts.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveVoucher()
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-white font-mono text-base font-bold outline-none focus:border-indigo-500 transition placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Amount Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mr-1">
                Quick Preset:
              </span>
              {AMOUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition cursor-pointer',
                    amount === p
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  )}
                >
                  +{p.toLocaleString('en-IN')}
                </button>
              ))}
              {selectedPartyObj && selectedPartyObj.balance && selectedPartyObj.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(Math.abs(selectedPartyObj.balance || 0))}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                >
                  Full Due ({formatCurrency(Math.abs(selectedPartyObj.balance || 0))})
                </button>
              )}
            </div>

            {/* Narration Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Narration / Description
              </label>
              <input
                type="text"
                value={userNarration}
                onChange={(e) => setUserNarration(e.target.value)}
                placeholder={defaultNarration}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 placeholder:text-slate-500"
              />
            </div>

            {/* ── Live Balanced Preview Box ────────────────────────────── */}
            {Number(amount) > 0 && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Live Accounting Double-Entry Preview
                  </span>
                  <span className="font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono text-[11px]">
                    ✓ Balanced ({formatCurrency(Number(amount))})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {/* Line 1: Debit */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/15 px-1.5 py-0.5 rounded mr-2">
                        DR
                      </span>
                      <span className="text-white font-medium">{quickBuiltLines[0]?.ledger}</span>
                    </div>
                    <span className="font-bold text-emerald-300">
                      {formatCurrency(quickBuiltLines[0]?.debit || 0)}
                    </span>
                  </div>

                  {/* Line 2: Credit */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/15 px-1.5 py-0.5 rounded mr-2">
                        CR
                      </span>
                      <span className="text-white font-medium">{quickBuiltLines[1]?.ledger}</span>
                    </div>
                    <span className="font-bold text-rose-300">
                      {formatCurrency(quickBuiltLines[1]?.credit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Big Primary Action Button ────────────────────────────── */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveVoucher}
                disabled={saving || !Number(amount) || (vType !== 'Contra' && !selectedParty)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition shadow-lg cursor-pointer',
                  Number(amount) > 0 && (vType === 'Contra' || selectedParty)
                    ? vType === 'Receipt'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                      : vType === 'Payment'
                        ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/40'
                        : vType === 'Contra'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-950/40'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                )}
              >
                <Save size={18} />
                <span>
                  {saving
                    ? 'Posting to Ledger…'
                    : Number(amount) > 0
                      ? vType === 'Receipt'
                        ? `Save & Post Receipt (${formatCurrency(Number(amount))})`
                        : vType === 'Payment'
                          ? `Save & Post Payment (${formatCurrency(Number(amount))})`
                          : vType === 'Contra'
                            ? `Save & Post Bank Transfer (${formatCurrency(Number(amount))})`
                            : `Save & Post Journal Entry (${formatCurrency(Number(amount))})`
                      : 'Enter Amount to Save Voucher'}
                </span>
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-2">
                Tip: Press <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Enter</kbd> in
                the amount field to instantly save and post to ledger!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: MULTI-LINE JOURNAL GRID ─────────────────────────── */}
      {activeTab === 'multiline' && (
        <div className="no-print space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Multi-Line Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-slate-800 gap-2 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Voucher Debit &amp; Credit Lines</h3>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                  {lines.length} lines
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    addLine(
                      cashAccounts[0] || 'Cash Account',
                      lineDiff > 0 && totalDebit < totalCredit ? lineDiff : 0,
                      lineDiff > 0 && totalCredit < totalDebit ? lineDiff : 0
                    )
                  }
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  <Banknote size={13} /> + Cash Line
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addLine(
                      bankAccounts[0] || 'HDFC Bank',
                      lineDiff > 0 && totalDebit < totalCredit ? lineDiff : 0,
                      lineDiff > 0 && totalCredit < totalDebit ? lineDiff : 0
                    )
                  }
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  <Landmark size={13} /> + Bank Line
                </button>
                <button
                  type="button"
                  onClick={() => addLine()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Plus size={14} /> Add Line
                </button>
              </div>
            </div>

            {/* Lines Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold w-64">Ledger Account</th>
                    <th className="text-left px-3 py-3 font-semibold w-36">Physical Vch No.</th>
                    <th className="text-right px-4 py-3 font-semibold w-32">Debit (Dr ₹)</th>
                    <th className="text-right px-4 py-3 font-semibold w-32">Credit (Cr ₹)</th>
                    <th className="text-left px-4 py-3 font-semibold">Line Narration</th>
                    <th className="w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={line.ledger}
                          onChange={(e) => updateLine(line.id, 'ledger', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500 font-medium"
                        >
                          <option value="">Select Ledger Account...</option>
                          <optgroup label="💵 Cash Accounts">
                            {cashAccounts.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🏦 Bank Accounts">
                            {bankAccounts.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="👥 Customers (Sundry Debtors)">
                            {customerList.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🏢 Suppliers (Sundry Creditors)">
                            {supplierList.map((s) => (
                              <option key={s.name} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="📑 General Accounts">
                            {generalLedgers.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          placeholder="e.g. PV-101"
                          value={line.physicalVchNo || ''}
                          onChange={(e) => updateLine(line.id, 'physicalVchNo', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono text-xs outline-none focus:border-indigo-500 placeholder:text-slate-600"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) =>
                            updateLine(line.id, 'debit', e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-right text-white font-mono outline-none focus:border-indigo-500"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) =>
                            updateLine(line.id, 'credit', e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-right text-white font-mono outline-none focus:border-indigo-500"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={line.narration}
                          onChange={(e) => updateLine(line.id, 'narration', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white outline-none focus:border-indigo-500"
                          placeholder="Line remarks..."
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                          title="Remove line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        <p className="font-medium text-slate-300">No voucher lines added yet.</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Click "+ Cash Line", "+ Bank Line", or "+ Add Line" to begin.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary & Save */}
            <div className="border-t border-slate-800 p-4 bg-slate-900/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-1/2">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  General Narration
                </label>
                <input
                  type="text"
                  value={multiNarration}
                  onChange={(e) => setMultiNarration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs outline-none focus:border-indigo-500"
                  placeholder="e.g. Payment towards Invoice via RTGS..."
                />
              </div>

              <div className="w-full md:w-auto flex flex-col sm:flex-row items-end sm:items-center gap-5 justify-end">
                <div className="space-y-1 text-right text-xs">
                  <div className="text-slate-400 flex items-center justify-end gap-3">
                    <span>Total Debit:</span>
                    <span className="font-mono font-semibold text-white text-sm">{formatCurrency(totalDebit)}</span>
                  </div>
                  <div className="text-slate-400 flex items-center justify-end gap-3">
                    <span>Total Credit:</span>
                    <span className="font-mono font-semibold text-white text-sm">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  {isMultiBalanced ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-semibold text-xs">
                      <CheckCircle2 size={16} /> Balanced ({formatCurrency(totalDebit)})
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-semibold text-xs">
                        <AlertCircle size={16} /> Difference: {formatCurrency(lineDiff)}
                      </div>
                      {lineDiff > 0 && (
                        <div className="flex gap-2 justify-end text-[10px]">
                          <button
                            type="button"
                            onClick={() => autoBalanceMultiLine('cash')}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Auto-Balance Cash
                          </button>
                          <span className="text-slate-600">&bull;</span>
                          <button
                            type="button"
                            onClick={() => autoBalanceMultiLine('bank')}
                            className="text-blue-400 hover:underline cursor-pointer"
                          >
                            Auto-Balance Bank
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveVoucher}
                    disabled={saving || !isMultiBalanced}
                    className={cn(
                      'flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-semibold shadow-md transition text-white cursor-pointer',
                      isMultiBalanced
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    )}
                  >
                    <Save size={15} /> {saving ? 'Posting…' : 'Post Voucher'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECENT VOUCHERS QUICK LOG (Peace of Mind) ───────────────── */}
      <div className="no-print bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Recent Posted Vouchers</h3>
          </div>
          <button
            type="button"
            onClick={loadMasterData}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
          >
            <RefreshCw size={12} className={loadingData ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {recentVouchers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[650px]">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 font-semibold">Date</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Voucher No.</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Party / Account</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Amount (₹)</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentVouchers.map((v) => {
                  const vTypeStr = (v.type || v.voucher_type || 'Receipt').toUpperCase()
                  const isRcpt = vTypeStr.includes('RECEIPT')
                  const isPmt = vTypeStr.includes('PAYMENT')
                  const isCntra = vTypeStr.includes('CONTRA')
                  return (
                    <tr key={v.id || v.number} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2 text-slate-400 font-mono">
                        {v.date || v.voucher_date || '-'}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-indigo-300">
                        {v.number || v.voucher_number || v.id}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-semibold border',
                            isRcpt && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            isPmt && 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                            isCntra && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                            !isRcpt && !isPmt && !isCntra && 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          )}
                        >
                          {v.type || v.voucher_type || 'VOUCHER'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-white max-w-[200px] truncate">
                        {v.party || 'General Account'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-200">
                        {formatCurrency(Number(v.total) || 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Posted
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenPrint(v)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          title="Print this voucher"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            No recent vouchers posted yet. Complete an entry above to see it listed here immediately.
          </div>
        )}
      </div>

      {/* ── Voucher Print Preview Modal ─────────────────────────────── */}
      {showPrintModal && printDataOverride && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 overflow-y-auto"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Printer size={16} className="text-indigo-400" /> Voucher Print Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Print (Ctrl+P)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="bg-white text-black p-4 rounded-xl shadow-inner">
              <VoucherPrint data={printDataOverride} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
