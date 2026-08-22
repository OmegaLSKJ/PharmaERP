import { useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'

interface Ledger { id: string; name: string; group: string; balance: number; type: 'Dr' | 'Cr' }

const DEFAULT_LEDGERS: Ledger[] = [
  { id: '1', name: 'MediCare Pharma', group: 'Sundry Debtors', balance: 125000, type: 'Dr' },
  { id: '2', name: 'HealthFirst Distributors', group: 'Sundry Debtors', balance: -45000, type: 'Cr' },
  { id: '3', name: 'Sun Pharma Industries', group: 'Sundry Creditors', balance: 230000, type: 'Cr' },
  { id: '4', name: 'Cipla Ltd', group: 'Sundry Creditors', balance: 560000, type: 'Cr' },
  { id: '5', name: 'GST Output CGST', group: 'Tax - CGST', balance: 97200, type: 'Cr' },
  { id: '6', name: 'GST Output SGST', group: 'Tax - SGST', balance: 97200, type: 'Cr' },
  { id: '7', name: 'GST Output IGST', group: 'Tax - IGST', balance: 48600, type: 'Cr' },
  { id: '8', name: 'Sales Account', group: 'Sales Account', balance: 8100000, type: 'Cr' },
  { id: '9', name: 'Purchase Account', group: 'Purchase Account', balance: 6500000, type: 'Dr' },
  { id: '10', name: 'Cash in Hand', group: 'Cash', balance: 350000, type: 'Dr' },
  { id: '11', name: 'HDFC Bank Current', group: 'Bank', balance: 2840000, type: 'Dr' },
]

export default function LedgerList() {
  const [ledgers, setLedgers] = useState<Ledger[]>(DEFAULT_LEDGERS)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('Sundry Debtors')

  const groups = ['Sundry Debtors', 'Sundry Creditors', 'Tax - CGST', 'Tax - SGST', 'Tax - IGST', 'Sales Account', 'Purchase Account', 'Cash', 'Bank', 'Suspense Account']

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    setLedgers([...ledgers, { id: Date.now().toString(), name, group, balance: 0, type: 'Dr' }])
    setName(''); setShowModal(false)
  }

  const filtered = ledgers.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ledger Master</h1>
          <p className="text-sm text-slate-400 mt-1">Chart of accounts and general ledger management</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> New Ledger
        </button>
      </div>
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md mb-6">
        <Search className="text-slate-400" size={18} />
        <input type="text" placeholder="Search ledgers..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-white text-sm w-full" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-4">Ledger Name</th>
              <th className="p-4">Group</th>
              <th className="p-4 text-right">Balance</th>
              <th className="p-4">Dr/Cr</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-slate-900/30 text-slate-300">
                <td className="p-4 font-medium text-white">{l.name}</td>
                <td className="p-4 text-slate-400">{l.group}</td>
                <td className={`p-4 text-right font-mono ${l.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {l.balance.toLocaleString('en-IN')}
                </td>
                <td className="p-4">{l.type}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-1 hover:text-white text-slate-400 transition"><Edit2 size={16} /></button>
                    <button className="p-1 hover:text-rose-400 text-slate-400 transition"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Create New Ledger</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Ledger Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Account Group</label>
                <select value={group} onChange={(e) => setGroup(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md">Save Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
