import { useState, useEffect, useMemo } from 'react'
import { Save, Banknote, Landmark, Plus, ArrowRightLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface VoucherLine {
  id: string
  ledger: string
  physicalVchNo?: string
  debit: number
  credit: number
  narration: string
}

interface AccountItem {
  id?: string
  name: string
  group?: string
  type?: string
}

const VOUCHER_TYPES = ['Receipt', 'Payment', 'Contra', 'Journal', 'Debit Note', 'Credit Note']

const DEFAULT_CASH_ACCOUNTS = ['Cash Account', 'Cash in Hand', 'Petty Cash']
const DEFAULT_BANK_ACCOUNTS = ['HDFC Bank', 'State Bank of India (SBI)', 'ICICI Bank', 'Axis Bank']

export default function VoucherEntry() {
  const [vType, setVType] = useState('Receipt')
  const [vNo, setVNo] = useState(() => `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
  const [physicalVoucherNo, setPhysicalVoucherNo] = useState('')
  const [vDate, setVDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payMode, setPayMode] = useState<'all' | 'cash' | 'bank'>('all')
  const [cashBankLedger, setCashBankLedger] = useState('Cash Account')
  const [partyLedger, setPartyLedger] = useState('')
  const [quickAmount, setQuickAmount] = useState<number | ''>('')
  const [bankRefNo, setBankRefNo] = useState('')
  const [lines, setLines] = useState<VoucherLine[]>([])
  const [narration, setNarration] = useState('')
  const [saving, setSaving] = useState(false)

  const [cashAccounts, setCashAccounts] = useState<string[]>(DEFAULT_CASH_ACCOUNTS)
  const [bankAccounts, setBankAccounts] = useState<string[]>(DEFAULT_BANK_ACCOUNTS)
  const [customerLedgers, setCustomerLedgers] = useState<string[]>([])
  const [supplierLedgers, setSupplierLedgers] = useState<string[]>([])
  const [generalLedgers, setGeneralLedgers] = useState<string[]>([])

  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    Promise.all([
      getErp<AccountItem[]>('accounts').catch(() => []),
      getErp<any[]>('parties').catch(() => [])
    ]).then(([accounts, parties]) => {
      const fetchedCash: string[] = []
      const fetchedBank: string[] = []
      const fetchedGeneral: string[] = []

      accounts.forEach((acc) => {
        const group = (acc.group || '').toLowerCase()
        const name = acc.name
        if (group.includes('cash') || name.toLowerCase().includes('cash')) {
          fetchedCash.push(name)
        } else if (group.includes('bank') || name.toLowerCase().includes('bank')) {
          fetchedBank.push(name)
        } else {
          fetchedGeneral.push(name)
        }
      })

      const finalCash = Array.from(new Set([...fetchedCash, ...DEFAULT_CASH_ACCOUNTS]))
      const finalBank = Array.from(new Set([...fetchedBank, ...DEFAULT_BANK_ACCOUNTS]))
      
      setCashAccounts(finalCash)
      setBankAccounts(finalBank)

      const customers = parties.filter((p) => p.type === 'customer' || !p.type).map((p) => p.name)
      const suppliers = parties.filter((p) => p.type === 'supplier').map((p) => p.name)

      setCustomerLedgers(customers.length ? customers : ['Apollo Pharmacy', 'MedPlus Chemist'])
      setSupplierLedgers(suppliers.length ? suppliers : ['Cipla Logistics', 'Sun Pharma Ltd'])
      setGeneralLedgers(fetchedGeneral.length ? fetchedGeneral : ['Discount Allowed', 'Discount Received', 'Sales Account', 'Purchase Account'])
    }).catch((error) => {
      showToast(error.message)
    })
  }, [showToast])

  // Set default initial cash/bank ledger
  useEffect(() => {
    if (payMode === 'cash' && cashAccounts.length) {
      setCashBankLedger(cashAccounts[0])
    } else if (payMode === 'bank' && bankAccounts.length) {
      setCashBankLedger(bankAccounts[0])
    }
  }, [payMode, cashAccounts, bankAccounts])

  const addLine = (defaultLedger = '', defaultDebit = 0, defaultCredit = 0) => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        ledger: defaultLedger,
        physicalVchNo: physicalVoucherNo || '',
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

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const diff = Math.abs(totalDebit - totalCredit)
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  // Helper to add balanced Cash & Bank or Party lines from Quick Entry
  const handleApplyQuickEntry = () => {
    const amt = Number(quickAmount)
    if (!amt || amt <= 0) {
      showToast('Please enter a valid amount')
      return
    }
    const accLedger = cashBankLedger || cashAccounts[0]
    const pLedger = partyLedger || (vType === 'Payment' ? supplierLedgers[0] : customerLedgers[0]) || 'General Party'
    const docRef = physicalVoucherNo || ''

    if (vType === 'Receipt') {
      // Debit Cash/Bank, Credit Party
      setLines([
        { id: Date.now().toString() + '1', ledger: accLedger, physicalVchNo: docRef, debit: amt, credit: 0, narration: bankRefNo ? `Ref: ${bankRefNo}` : 'Received via Cash/Bank' },
        { id: Date.now().toString() + '2', ledger: pLedger, physicalVchNo: docRef, debit: 0, credit: amt, narration: 'Received against invoice/account' }
      ])
      if (!narration) setNarration(`Received ${formatCurrency(amt)} from ${pLedger} via ${accLedger}`)
    } else if (vType === 'Payment') {
      // Debit Party, Credit Cash/Bank
      setLines([
        { id: Date.now().toString() + '1', ledger: pLedger, physicalVchNo: docRef, debit: amt, credit: 0, narration: 'Payment made' },
        { id: Date.now().toString() + '2', ledger: accLedger, physicalVchNo: docRef, debit: 0, credit: amt, narration: bankRefNo ? `Ref: ${bankRefNo}` : 'Paid via Cash/Bank' }
      ])
      if (!narration) setNarration(`Paid ${formatCurrency(amt)} to ${pLedger} from ${accLedger}`)
    } else if (vType === 'Contra') {
      // Transfer
      setLines([
        { id: Date.now().toString() + '1', ledger: bankAccounts[0] || 'HDFC Bank', physicalVchNo: docRef, debit: amt, credit: 0, narration: 'Contra Deposit' },
        { id: Date.now().toString() + '2', ledger: cashAccounts[0] || 'Cash Account', physicalVchNo: docRef, debit: 0, credit: amt, narration: 'Contra Withdrawal' }
      ])
      if (!narration) setNarration(`Contra transfer of ${formatCurrency(amt)}`)
    }
    showToast('Voucher lines generated!')
  }

  // Quick Contra Presets
  const applyContraPreset = (type: 'cash_to_bank' | 'bank_to_cash' | 'bank_to_bank') => {
    const amt = Number(quickAmount) || 10000
    const cashAcc = cashAccounts[0] || 'Cash Account'
    const bankAcc1 = bankAccounts[0] || 'HDFC Bank'
    const bankAcc2 = bankAccounts[1] || 'State Bank of India (SBI)'

    if (type === 'cash_to_bank') {
      setLines([
        { id: Date.now().toString() + '1', ledger: bankAcc1, debit: amt, credit: 0, narration: 'Cash deposited into bank' },
        { id: Date.now().toString() + '2', ledger: cashAcc, debit: 0, credit: amt, narration: 'Cash deposited' }
      ])
      setNarration(`Cash deposit of ${formatCurrency(amt)} into ${bankAcc1}`)
    } else if (type === 'bank_to_cash') {
      setLines([
        { id: Date.now().toString() + '1', ledger: cashAcc, debit: amt, credit: 0, narration: 'Cash withdrawn from bank' },
        { id: Date.now().toString() + '2', ledger: bankAcc1, debit: 0, credit: amt, narration: 'Cash withdrawal' }
      ])
      setNarration(`Cash withdrawal of ${formatCurrency(amt)} from ${bankAcc1}`)
    } else if (type === 'bank_to_bank') {
      setLines([
        { id: Date.now().toString() + '1', ledger: bankAcc2, debit: amt, credit: 0, narration: 'Bank transfer received' },
        { id: Date.now().toString() + '2', ledger: bankAcc1, debit: 0, credit: amt, narration: 'Bank transfer sent' }
      ])
      setNarration(`Transfer of ${formatCurrency(amt)} from ${bankAcc1} to ${bankAcc2}`)
    }
    showToast('Contra preset applied.')
  }

  const handleAutoBalance = (target: 'cash' | 'bank') => {
    if (diff <= 0) {
      showToast('Voucher is already balanced!')
      return
    }
    const defaultLedger = target === 'cash' ? cashAccounts[0] || 'Cash Account' : bankAccounts[0] || 'HDFC Bank'
    if (totalDebit > totalCredit) {
      addLine(defaultLedger, 0, diff)
    } else {
      addLine(defaultLedger, diff, 0)
    }
  }

  const getLedgerTypeBadge = (ledgerName: string) => {
    if (cashAccounts.includes(ledgerName)) return { label: 'Cash', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
    if (bankAccounts.includes(ledgerName)) return { label: 'Bank', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }
    if (customerLedgers.includes(ledgerName)) return { label: 'Customer', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' }
    if (supplierLedgers.includes(ledgerName)) return { label: 'Supplier', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
    return { label: 'General', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' }
  }

  const saveVoucher = async () => {
    let currentLines = [...lines]

    // If no lines in table, but user entered details in Quick Entry Helper
    if (currentLines.length === 0) {
      const amt = Number(quickAmount)
      if (amt > 0) {
        const accLedger = cashBankLedger || cashAccounts[0] || 'Cash Account'
        const pLedger = partyLedger || (vType === 'Payment' ? supplierLedgers[0] : customerLedgers[0]) || 'General Party'

        if (vType === 'Receipt') {
          currentLines = [
            { id: Date.now().toString() + '1', ledger: accLedger, debit: amt, credit: 0, narration: bankRefNo ? `Ref: ${bankRefNo}` : 'Received via Cash/Bank' },
            { id: Date.now().toString() + '2', ledger: pLedger, debit: 0, credit: amt, narration: 'Received against invoice/account' }
          ]
        } else if (vType === 'Payment') {
          currentLines = [
            { id: Date.now().toString() + '1', ledger: pLedger, debit: amt, credit: 0, narration: 'Payment made' },
            { id: Date.now().toString() + '2', ledger: accLedger, debit: 0, credit: amt, narration: bankRefNo ? `Ref: ${bankRefNo}` : 'Paid via Cash/Bank' }
          ]
        } else if (vType === 'Contra') {
          currentLines = [
            { id: Date.now().toString() + '1', ledger: bankAccounts[0] || 'HDFC Bank', debit: amt, credit: 0, narration: 'Contra Deposit' },
            { id: Date.now().toString() + '2', ledger: cashAccounts[0] || 'Cash Account', debit: 0, credit: amt, narration: 'Contra Withdrawal' }
          ]
        } else {
          currentLines = [
            { id: Date.now().toString() + '1', ledger: accLedger, debit: amt, credit: 0, narration: 'Journal Debit' },
            { id: Date.now().toString() + '2', ledger: pLedger, debit: 0, credit: amt, narration: 'Journal Credit' }
          ]
        }
        setLines(currentLines)
        if (!narration) {
          setNarration(
            vType === 'Receipt'
              ? `Received ${formatCurrency(amt)} from ${pLedger} via ${accLedger}`
              : `Paid ${formatCurrency(amt)} to ${pLedger} from ${accLedger}`
          )
        }
      } else {
        showToast('Please enter an amount and add voucher debit & credit lines before saving.')
        return
      }
    }

    // Validate debit vs credit balance
    const deb = currentLines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const cred = currentLines.reduce((s, l) => s + (Number(l.credit) || 0), 0)

    if (deb <= 0 || cred <= 0) {
      showToast('Voucher amount must be greater than zero.')
      return
    }

    if (Math.abs(deb - cred) > 0.001) {
      showToast(
        `Voucher is unbalanced! Total Debit (${formatCurrency(deb)}) does not match Total Credit (${formatCurrency(cred)}). Difference: ${formatCurrency(Math.abs(deb - cred))}`
      )
      return
    }

    const missingLedger = currentLines.some((l) => !l.ledger || !l.ledger.trim())
    if (missingLedger) {
      showToast('All voucher lines must have a Ledger Account selected.')
      return
    }

    try {
      setSaving(true)
      const primaryParty =
        currentLines.find((l) => !cashAccounts.includes(l.ledger) && !bankAccounts.includes(l.ledger))?.ledger ||
        partyLedger ||
        'General Party'
      const saved = await postErp<{ id: string }>('vouchers', {
        id: vNo,
        number: vNo,
        physical_voucher_no: physicalVoucherNo || '',
        physicalVoucherNo: physicalVoucherNo || '',
        type: vType,
        voucher_type: vType.toLowerCase(),
        date: vDate,
        voucher_date: vDate,
        party: primaryParty,
        narration: narration || (physicalVoucherNo ? `${vType} voucher ${vNo} (Phys: ${physicalVoucherNo})` : `${vType} voucher ${vNo}`),
        total: deb,
        lines: currentLines
      })
      showToast(`Voucher ${saved.id || vNo} posted successfully!`)
      setLines([])
      setNarration('')
      setQuickAmount('')
      setBankRefNo('')
      setPartyLedger('')
      setPhysicalVoucherNo('')
      setVNo(`VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save voucher.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Landmark className="text-indigo-400" size={24} /> Voucher Entry
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Record Cash &amp; Bank transactions &bull; Receipts, Payments, Contra &amp; Journals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLines([])}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition border border-slate-700"
          >
            Clear Lines
          </button>
          <button
            onClick={saveVoucher}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition text-white',
              isBalanced || (lines.length === 0 && Number(quickAmount) > 0)
                ? 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
            )}
          >
            <Save size={16} /> {saving ? 'Posting…' : 'Save Voucher'}
          </button>
        </div>
      </div>

      {/* Main Voucher Parameters Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Voucher Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Voucher Type</label>
            <select
              value={vType}
              onChange={(e) => setVType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-medium"
            >
              {VOUCHER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher Number (System Auto) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Voucher No.</label>
            <input
              type="text"
              value={vNo}
              onChange={(e) => setVNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Physical Voucher Number (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase">Physical Vch No.</label>
              <span className="text-[10px] text-indigo-400 font-medium lowercase">optional</span>
            </div>
            <input
              type="text"
              placeholder="e.g. PV-0492 / Book #1"
              value={physicalVoucherNo}
              onChange={(e) => setPhysicalVoucherNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Voucher Date</label>
            <input
              type="date"
              value={vDate}
              onChange={(e) => setVDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {/* Payment / Account Mode Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Mode</label>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setPayMode('all')}
                className={cn(
                  'flex-1 py-1 px-2 text-xs font-semibold rounded transition text-center',
                  payMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPayMode('cash')}
                className={cn(
                  'flex-1 py-1 px-2 text-xs font-semibold rounded flex items-center justify-center gap-1 transition',
                  payMode === 'cash' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <Banknote size={13} /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPayMode('bank')}
                className={cn(
                  'flex-1 py-1 px-2 text-xs font-semibold rounded flex items-center justify-center gap-1 transition',
                  payMode === 'bank' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <Landmark size={13} /> Bank
              </button>
            </div>
          </div>
        </div>

        {/* Quick Voucher Builder / Cash & Bank Header Section */}
        <div className="pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-4 -mb-4 p-4 rounded-b-xl">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <RefreshCw size={13} className="text-indigo-400" />
            Quick Entry Helper (Cash &amp; Bank)
          </div>

          {vType === 'Contra' ? (
            /* Contra Preset Shortcuts */
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <input
                  type="number"
                  placeholder="Transfer Amount"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => applyContraPreset('cash_to_bank')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-medium transition"
              >
                <Banknote size={14} /> Deposit: Cash &rarr; Bank
              </button>
              <button
                type="button"
                onClick={() => applyContraPreset('bank_to_cash')}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs font-medium transition"
              >
                <Landmark size={14} /> Withdraw: Bank &rarr; Cash
              </button>
              <button
                type="button"
                onClick={() => applyContraPreset('bank_to_bank')}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 rounded-lg text-xs font-medium transition"
              >
                <ArrowRightLeft size={14} /> Bank &rarr; Bank Transfer
              </button>
            </div>
          ) : (
            /* Receipt / Payment / Journal Quick Builder */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Cash / Bank Account
                </label>
                <select
                  value={cashBankLedger}
                  onChange={(e) => setCashBankLedger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
                >
                  {(payMode === 'all' || payMode === 'cash') && (
                    <optgroup label="💵 Cash Accounts">
                      {cashAccounts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(payMode === 'all' || payMode === 'bank') && (
                    <optgroup label="🏦 Bank Accounts">
                      {bankAccounts.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Party / Secondary Ledger
                </label>
                <select
                  value={partyLedger}
                  onChange={(e) => setPartyLedger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">Select Party / Ledger...</option>
                  <optgroup label="👥 Customers">
                    {customerLedgers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🏢 Suppliers">
                    {supplierLedgers.map((s) => (
                      <option key={s} value={s}>
                        {s}
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
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Cheque / Ref No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-4491 / UTR"
                  value={bankRefNo}
                  onChange={(e) => setBankRefNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleApplyQuickEntry}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Generate Lines
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voucher Lines Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-slate-800 gap-2 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Voucher Debit &amp; Credit Lines</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
              {lines.length} lines
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addLine(cashAccounts[0] || 'Cash Account', diff > 0 && totalDebit < totalCredit ? diff : 0, diff > 0 && totalCredit < totalDebit ? diff : 0)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
            >
              <Banknote size={13} /> + Cash Line
            </button>
            <button
              type="button"
              onClick={() => addLine(bankAccounts[0] || 'HDFC Bank', diff > 0 && totalDebit < totalCredit ? diff : 0, diff > 0 && totalCredit < totalDebit ? diff : 0)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition"
            >
              <Landmark size={13} /> + Bank Line
            </button>
            <button
              type="button"
              onClick={() => addLine()}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
            >
              <Plus size={14} /> Add Line
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold w-10">#</th>
                <th className="text-left px-4 py-3 font-semibold w-64">Ledger Account (Cash / Bank / Party)</th>
                <th className="text-left px-2 py-3 font-semibold w-24">Type</th>
                <th className="text-left px-3 py-3 font-semibold w-36">Physical Vch No.</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Debit (Dr ₹)</th>
                <th className="text-right px-4 py-3 font-semibold w-32">Credit (Cr ₹)</th>
                <th className="text-left px-4 py-3 font-semibold">Line Narration</th>
                <th className="w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {lines.map((line, idx) => {
                const badge = getLedgerTypeBadge(line.ledger)
                return (
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
                          {customerLedgers.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🏢 Suppliers (Sundry Creditors)">
                          {supplierLedgers.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="📑 General &amp; Expense Ledgers">
                          {generalLedgers.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="px-2 py-2.5">
                      {line.ledger ? (
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold border', badge.color)}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">-</span>
                      )}
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
                        onChange={(e) => updateLine(line.id, 'debit', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-right text-white font-mono outline-none focus:border-indigo-500"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        value={line.credit || ''}
                        onChange={(e) => updateLine(line.id, 'credit', e.target.value === '' ? 0 : Number(e.target.value))}
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
                        placeholder="Line narration or reference..."
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                        title="Remove line"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                )
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <p className="font-medium text-slate-300">No voucher lines entered yet.</p>
                    {Number(quickAmount) > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-indigo-400">
                          Ready to generate balanced debit/credit lines for {formatCurrency(Number(quickAmount))}.
                        </p>
                        <button
                          type="button"
                          onClick={handleApplyQuickEntry}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
                        >
                          Click to Generate Lines ({formatCurrency(Number(quickAmount))})
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 space-y-2">
                        <p>
                          Enter an Amount above and click &ldquo;Generate Lines&rdquo;, or use quick actions below:
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => addLine(cashAccounts[0] || 'Cash Account')}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs"
                          >
                            + Cash Line
                          </button>
                          <button
                            type="button"
                            onClick={() => addLine(bankAccounts[0] || 'HDFC Bank')}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs"
                          >
                            + Bank Line
                          </button>
                          <button
                            type="button"
                            onClick={() => addLine()}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs"
                          >
                            + Custom Line
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Narration and Real-Time Balancing */}
        <div className="border-t border-slate-800 p-4 bg-slate-900/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-1/2">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">General Narration</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500"
              placeholder="e.g. Payment made towards Invoice #SI-0092 via RTGS"
            />
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row items-end sm:items-center gap-6 justify-end">
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

            <div className="text-right">
              {isBalanced ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg font-semibold text-xs">
                  <CheckCircle2 size={16} /> Balanced ({formatCurrency(totalDebit)})
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg font-semibold text-xs">
                    <AlertCircle size={16} /> Difference: {formatCurrency(diff)}
                  </div>
                  {diff > 0 && (
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => handleAutoBalance('cash')}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        Balance via Cash
                      </button>
                      <span className="text-slate-600 text-[10px]">&bull;</span>
                      <button
                        type="button"
                        onClick={() => handleAutoBalance('bank')}
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        Balance via Bank
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

