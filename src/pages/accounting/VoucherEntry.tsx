import { useState } from 'react'
import { Save, Search } from 'lucide-react'
import { useEffect } from 'react'
import { cn, formatCurrency } from '../../lib/utils'
import { getErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface VoucherLine { id: string; ledger: string; debit: number; credit: number; narration: string }

const VOUCHER_TYPES = ['Receipt', 'Payment', 'Debit Note', 'Credit Note', 'Contra', 'Journal']
export default function VoucherEntry() {
  const [vType, setVType] = useState('Receipt')
  const [vNo, setVNo] = useState('')
  const [vDate, setVDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [partyLedger, setPartyLedger] = useState('')
  const [bankLedger, setBankLedger] = useState('')
  const [ledgerList, setLedgerList] = useState<string[]>([])
  const [lines, setLines] = useState<VoucherLine[]>([])
  const [narration, setNarration] = useState('')
  const [showLedgerSearch, setShowLedgerSearch] = useState(false)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)
  useEffect(() => { Promise.all([getErp<any[]>('accounts'), getErp<any[]>('parties')]).then(([accounts, parties]) => setLedgerList([...accounts.map((row) => row.name), ...parties.map((row) => row.name)])) .catch((error) => showToast(error.message)) }, [showToast])

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), ledger: '', debit: 0, credit: 0, narration: '' }])
  }

  const updateLine = (id: string, field: keyof VoucherLine, value: string | number) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id))

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const isBalanced = totalDebit === totalCredit && totalDebit > 0
  const saveVoucher = async () => { try { setSaving(true); const saved = await postErp<{ id: string }>('vouchers', { id: vNo, type: vType, date: vDate, narration, lines }); showToast(`Voucher ${saved.id} posted to ledgers.`); setLines([]); setNarration('') } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save voucher.') } finally { setSaving(false) } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Voucher Entry</h1>
          <p className="text-sm text-slate-400 mt-1">Create accounting vouchers &bull; Receipt, Payment, Journal, Contra</p>
        </div>
        <button onClick={saveVoucher} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition text-white', isBalanced ? 'bg-blue-700 hover:bg-blue-600' : 'bg-slate-700 cursor-not-allowed opacity-50')} disabled={!isBalanced || saving}>
          <Save size={16} /> {saving ? 'Posting…' : 'Save Voucher'}
        </button>
      </div>

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Voucher Type</label>
            <select value={vType} onChange={(e) => setVType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
              {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Voucher No.</label>
            <input type="text" value={vNo} onChange={(e) => setVNo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date</label>
            <input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Party Ledger</label>
            <select value={partyLedger} onChange={(e) => setPartyLedger(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
              <option value="">Select ledger...</option>
              {ledgerList.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Voucher Lines */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Voucher Lines</h3>
          <button onClick={addLine} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">+ Add Line</button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium w-8">#</th>
              <th className="text-left px-4 py-3 font-medium">Ledger</th>
              <th className="text-right px-4 py-3 font-medium">Debit</th>
              <th className="text-right px-4 py-3 font-medium">Credit</th>
              <th className="text-left px-4 py-3 font-medium">Narration</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {lines.map((line, idx) => (
              <tr key={line.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                <td className="px-4 py-2">
                  <select value={line.ledger} onChange={(e) => updateLine(line.id, 'ledger', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500">
                    <option value="">Select...</option>
                    {ledgerList.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-right"><input type="number" value={line.debit || ''} onChange={(e) => updateLine(line.id, 'debit', Number(e.target.value))} className="w-28 bg-slate-950 border border-slate-800 rounded p-1.5 text-right text-white outline-none focus:border-indigo-500" placeholder="0" /></td>
                <td className="px-4 py-2 text-right"><input type="number" value={line.credit || ''} onChange={(e) => updateLine(line.id, 'credit', Number(e.target.value))} className="w-28 bg-slate-950 border border-slate-800 rounded p-1.5 text-right text-white outline-none focus:border-indigo-500" placeholder="0" /></td>
                <td className="px-4 py-2"><input type="text" value={line.narration} onChange={(e) => updateLine(line.id, 'narration', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500" placeholder="Optional" /></td>
                <td className="px-4 py-2"><button onClick={() => removeLine(line.id)} className="text-slate-500 hover:text-rose-400 text-xs">x</button></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No lines. Click "+ Add Line" to start.</td></tr>}
          </tbody>
        </table>
        <div className="border-t border-slate-800 p-4 flex justify-between items-center">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Narration</label>
            <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} className="w-full md:w-96 bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" placeholder="Enter narration..." />
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm text-slate-400">Total Debit: <span className="font-mono text-white">{formatCurrency(totalDebit)}</span></div>
            <div className="text-sm text-slate-400">Total Credit: <span className="font-mono text-white">{formatCurrency(totalCredit)}</span></div>
            <div className={cn('text-sm font-bold', isBalanced ? 'text-emerald-400' : 'text-rose-400')}>
              {isBalanced ? 'Balanced' : `Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
