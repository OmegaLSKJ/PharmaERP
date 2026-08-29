import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Ledger {
  id: string
  name: string
  group: string
  balance: number
  type: 'Dr' | 'Cr'
}

export default function LedgerList() {
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('Sundry Debtors')
  const addToast = useUIStore((s) => s.addToast)

  useEffect(() => {
    getErp<Ledger[]>('accounts').then(setLedgers).catch((e) => addToast(e.message, 'error'))
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

  const filtered = ledgers.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Ledger Master</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Chart of accounts and general ledger management</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> New Ledger
        </button>
      </div>

      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md shadow-xs">
        <Search className="text-slate-400 shrink-0" size={18} />
        <input
          type="text"
          placeholder="Search ledgers by name or group..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-slate-500"
        />
      </div>

      {/* Horizontal Scroller Container */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[650px] w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-3.5">Ledger Name</th>
              <th className="p-3.5">Group</th>
              <th className="p-3.5 text-right">Balance</th>
              <th className="p-3.5">Dr/Cr</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                  No ledgers matching "{search}"
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/30 text-slate-300 transition">
                  <td className="p-3.5 font-medium text-white">{l.name}</td>
                  <td className="p-3.5 text-slate-400 text-xs">{l.group}</td>
                  <td className={`p-3.5 text-right font-mono font-semibold ${l.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{l.balance.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3.5 text-xs font-mono">{l.type}</td>
                  <td className="p-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        aria-label={`Edit ${l.name}`}
                        onClick={() => editLedger(l)}
                        className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-800 rounded transition"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        aria-label={`Delete ${l.name}`}
                        onClick={() => removeLedger(l)}
                        className="p-1.5 hover:text-rose-400 text-slate-400 hover:bg-rose-950/30 rounded transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Group *</label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
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
        </div>
      )}
    </div>
  )
}
