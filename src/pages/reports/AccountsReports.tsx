import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Landmark, Printer, RefreshCw } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { getErp } from '../../lib/erpApi'
import { exportVisibleTables } from '../../lib/download'
import PrintHeader from '../../components/layout/PrintHeader'
import { useUIStore } from '../../store/uiStore'

type Account = { id: string; code?: string; name: string; group?: string; balance?: number; type?: string }
type VoucherLine = { ledger?: string; debit?: number; credit?: number; narration?: string }
type Voucher = { id: string; number?: string; voucher_number?: string; type?: string; voucher_type?: string; date?: string; voucher_date?: string; narration?: string; lines?: VoucherLine[] }
type Invoice = { id: string; party?: string; date?: string; total?: number; status?: string }
type Series = { id: string; doc?: string; prefix?: string; suffix?: string; nextNo?: number; active?: boolean }
type Row = Record<string, string | number>

const reports = [
  ['cash-bank', 'Cash & Bank Book'], ['all-ledgers', 'All Ledgers'], ['debtors', 'Sundry Debtors'], ['creditors', 'Sundry Creditors'],
  ['expenses', 'Expenses'], ['advances', 'Loans & Advances'], ['loan-liabilities', 'Loan Liabilities'], ['sales', 'Sale Book'],
  ['purchases', 'Purchase Book'], ['depreciation', 'Depreciation Statement'], ['monthly-debtors', 'Monthly Debtors Statement'],
  ['monthly-abstract', 'Monthly Abstract'], ['bill-adjustment', 'Bill Adjustment'], ['series', 'Series / Memorandum A/c'],
  ['holiday-entries', 'Entries Made on Holidays'], ['accounts', 'List of Accounts'],
] as const
type ReportKey = typeof reports[number][0]

const groupText = (account: Account) => `${account.name} ${account.group || ''}`.toLowerCase()
const number = (value: unknown) => Number(value || 0)
const voucherDate = (voucher: Voucher) => voucher.date || voucher.voucher_date || ''
const voucherNumber = (voucher: Voucher) => voucher.number || voucher.voucher_number || voucher.id
const voucherType = (voucher: Voucher) => voucher.type || voucher.voucher_type || 'Journal'

export default function AccountsReports() {
  const [active, setActive] = useState<ReportKey>('cash-bank')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [sales, setSales] = useState<Invoice[]>([])
  const [purchases, setPurchases] = useState<Invoice[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useUIStore((state) => state.addToast)

  const load = async () => {
    setLoading(true)
    try {
      const [accountRows, voucherRows, saleRows, purchaseRows, seriesRows] = await Promise.all([
        getErp<Account[]>('accounts'), getErp<Voucher[]>('vouchers'), getErp<Invoice[]>('sales'), getErp<Invoice[]>('purchases'), getErp<Series[]>('series'),
      ])
      setAccounts(accountRows || [])
      setVouchers(voucherRows || [])
      setSales(saleRows || [])
      setPurchases(purchaseRows || [])
      setSeries(seriesRows || [])
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not load account reports.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const { title, columns, rows, total } = useMemo(() => {
    const reportTitle = reports.find(([key]) => key === active)?.[1] || 'Accounts Report'
    const accountRows = (filter: (account: Account) => boolean): Row[] => accounts.filter(filter).map((account) => ({
      code: account.code || '—', account: account.name, group: account.group || 'Unclassified', balance: number(account.balance), nature: account.type || '—',
    }))
    const invoiceRows = (invoices: Invoice[]): Row[] => invoices.filter((row) => row.status !== 'cancelled').map((row) => ({
      date: row.date || '—', document: row.id, party: row.party || 'Cash Customer', amount: number(row.total),
    }))
    const amountFor = (voucher: Voucher) => (voucher.lines || []).reduce((sum, line) => sum + Math.max(number(line.debit), number(line.credit)), 0) / 2

    if (active === 'cash-bank') {
      const cashAccounts = accounts.filter((account) => /cash|bank/.test(groupText(account)))
      const names = new Set(cashAccounts.map((account) => account.name.toLowerCase()))
      return { title: reportTitle, columns: ['date', 'voucher', 'type', 'narration', 'debit', 'credit'], rows: vouchers.flatMap((voucher) => (voucher.lines || [])
        .filter((line) => names.has(String(line.ledger || '').toLowerCase()))
        .map((line) => ({ date: voucherDate(voucher), voucher: voucherNumber(voucher), type: voucherType(voucher), narration: line.narration || voucher.narration || '—', debit: number(line.debit), credit: number(line.credit) }))), total: cashAccounts.reduce((sum, account) => sum + number(account.balance), 0) }
    }
    if (active === 'all-ledgers' || active === 'accounts') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows(() => true), total: accounts.reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'debtors') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows((account) => /debtor|customer|receivable/.test(groupText(account))), total: accounts.filter((account) => /debtor|customer|receivable/.test(groupText(account))).reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'creditors') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows((account) => /creditor|supplier|payable/.test(groupText(account))), total: accounts.filter((account) => /creditor|supplier|payable/.test(groupText(account))).reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'expenses') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows((account) => /expense|depreciation/.test(groupText(account))), total: accounts.filter((account) => /expense|depreciation/.test(groupText(account))).reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'advances') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows((account) => /(advance|loan)/.test(groupText(account)) && !/liabilit/.test(groupText(account))), total: accounts.filter((account) => /(advance|loan)/.test(groupText(account)) && !/liabilit/.test(groupText(account))).reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'loan-liabilities') return { title: reportTitle, columns: ['code', 'account', 'group', 'nature', 'balance'], rows: accountRows((account) => /loan|liabilit/.test(groupText(account))), total: accounts.filter((account) => /loan|liabilit/.test(groupText(account))).reduce((sum, account) => sum + number(account.balance), 0) }
    if (active === 'sales') return { title: reportTitle, columns: ['date', 'document', 'party', 'amount'], rows: invoiceRows(sales), total: sales.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + number(row.total), 0) }
    if (active === 'purchases') return { title: reportTitle, columns: ['date', 'document', 'party', 'amount'], rows: invoiceRows(purchases), total: purchases.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + number(row.total), 0) }
    if (active === 'depreciation') return { title: reportTitle, columns: ['date', 'voucher', 'narration', 'debit', 'credit'], rows: vouchers.flatMap((voucher) => (voucher.lines || []).filter((line) => /depreciation/i.test(`${line.ledger || ''} ${line.narration || ''} ${voucher.narration || ''}`)).map((line) => ({ date: voucherDate(voucher), voucher: voucherNumber(voucher), narration: line.narration || voucher.narration || 'Depreciation', debit: number(line.debit), credit: number(line.credit) }))), total: 0 }
    if (active === 'monthly-debtors') {
      const aggregate = new Map<string, number>()
      sales.filter((row) => row.status !== 'cancelled').forEach((row) => { const key = `${String(row.date || '').slice(0, 7) || 'Undated'} · ${row.party || 'Cash Customer'}`; aggregate.set(key, (aggregate.get(key) || 0) + number(row.total)) })
      return { title: reportTitle, columns: ['period', 'party', 'sales'], rows: [...aggregate.entries()].map(([key, value]) => { const [period, party] = key.split(' · '); return { period, party, sales: value } }), total: [...aggregate.values()].reduce((sum, value) => sum + value, 0) }
    }
    if (active === 'monthly-abstract') {
      const aggregate = new Map<string, { debit: number; credit: number }>()
      vouchers.forEach((voucher) => { const key = String(voucherDate(voucher)).slice(0, 7) || 'Undated'; const current = aggregate.get(key) || { debit: 0, credit: 0 }; (voucher.lines || []).forEach((line) => { current.debit += number(line.debit); current.credit += number(line.credit) }); aggregate.set(key, current) })
      return { title: reportTitle, columns: ['period', 'debit', 'credit'], rows: [...aggregate.entries()].sort().map(([period, value]) => ({ period, ...value })), total: 0 }
    }
    if (active === 'bill-adjustment') return { title: reportTitle, columns: ['date', 'voucher', 'type', 'narration', 'amount'], rows: vouchers.filter((voucher) => /receipt|payment/i.test(voucherType(voucher))).map((voucher) => ({ date: voucherDate(voucher), voucher: voucherNumber(voucher), type: voucherType(voucher), narration: voucher.narration || '—', amount: amountFor(voucher) })), total: vouchers.filter((voucher) => /receipt|payment/i.test(voucherType(voucher))).reduce((sum, voucher) => sum + amountFor(voucher), 0) }
    if (active === 'series') return { title: reportTitle, columns: ['document', 'prefix', 'suffix', 'nextNumber', 'status'], rows: series.map((entry) => ({ document: entry.doc || '—', prefix: entry.prefix || '—', suffix: entry.suffix || '—', nextNumber: number(entry.nextNo), status: entry.active ? 'Active' : 'Inactive' })), total: 0 }
    const holidayRows = vouchers.filter((voucher) => { const day = new Date(voucherDate(voucher)).getDay(); return day === 0 || day === 6 }).map((voucher) => ({ date: voucherDate(voucher), voucher: voucherNumber(voucher), type: voucherType(voucher), narration: voucher.narration || '—', amount: amountFor(voucher) }))
    return { title: reportTitle, columns: ['date', 'voucher', 'type', 'narration', 'amount'], rows: holidayRows, total: holidayRows.reduce((sum, row) => sum + number(row.amount), 0) }
  }, [accounts, active, purchases, sales, series, vouchers])

  return <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
    <PrintHeader title={title} />
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><Landmark className="text-blue-500" size={22}/><h1 className="text-2xl font-bold text-foreground">Accounts Report Centre</h1></div><p className="text-sm text-muted-foreground mt-1">Live accounting, ledger, sales and purchase reports based on posted ERP data.</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-secondary"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-secondary"><Printer size={15}/>Print</button><button onClick={() => exportVisibleTables(`accounts-${active}`, useUIStore.getState().company)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"><Download size={15}/>Excel</button></div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 no-print">{reports.map(([key, label]) => <button key={key} onClick={() => setActive(key)} className={`text-left rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${active === key ? 'bg-blue-600 text-white border-blue-500' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>{label}</button>)}</div>
    <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm"><div className="px-4 py-3 border-b border-border flex items-center justify-between"><h2 className="font-semibold text-foreground">{title}</h2><span className="text-xs text-muted-foreground">{rows.length} records</span></div><table className="min-w-[700px] w-full text-xs"><thead className="bg-secondary/40 text-muted-foreground uppercase"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left font-semibold">{column.replace(/([A-Z])/g, ' $1')}</th>)}</tr></thead><tbody className="divide-y divide-border">{loading ? <tr><td colSpan={columns.length} className="p-8 text-center text-muted-foreground">Loading live report…</td></tr> : rows.map((row, index) => <tr key={index} className="hover:bg-secondary/30">{columns.map((column) => { const value = (row as Row)[column]; const isAmount = /amount|balance|debit|credit|sales/.test(column); return <td key={column} className={`px-4 py-3 ${isAmount ? 'text-right font-mono' : ''}`}>{typeof value === 'number' && isAmount ? formatCurrency(value) : value}</td> })}</tr>)}{!loading && !rows.length && <tr><td colSpan={columns.length} className="p-8 text-center text-muted-foreground">No posted records are available for this report yet.</td></tr>}</tbody>{total !== 0 && <tfoot><tr className="bg-secondary/30 font-bold"><td colSpan={Math.max(1, columns.length - 1)} className="px-4 py-3">Total</td><td className="px-4 py-3 text-right font-mono">{formatCurrency(total)}</td></tr></tfoot>}</table></div>
    {active === 'holiday-entries' && <p className="text-xs text-muted-foreground">Weekend entries are shown here. Add a holiday calendar to distinguish statutory holidays from weekends.</p>}
    {active === 'depreciation' && <p className="text-xs text-muted-foreground">This report becomes active when depreciation vouchers or depreciation ledgers are posted.</p>}
  </div>
}
