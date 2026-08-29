import { useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Salt { id: string; name: string; composition: string; itemcount: number; category: string }

const CAT_COLORS: Record<string, string> = {
  Antibiotic: 'bg-blue-500/10 text-blue-400', Analgesic: 'bg-emerald-500/10 text-emerald-400',
  Antiallergic: 'bg-purple-500/10 text-purple-400', Antidiabetic: 'bg-amber-500/10 text-amber-400',
  Gastrointestinal: 'bg-rose-500/10 text-rose-400', Respiratory: 'bg-cyan-500/10 text-cyan-400',
}

export default function SaltMaster() {
  const [salts, setSalts] = useState<Salt[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [comp, setComp] = useState('')
  const [cat, setCat] = useState('Antibiotic')
  const addToast = useUIStore((s) => s.addToast)
  useEffect(() => { getErp<Salt[]>('salts').then(setSalts).catch((e) => addToast(e.message, 'error')) }, [addToast])
  const filtered = salts.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.composition || '').toLowerCase().includes(search.toLowerCase()))
  const saveSalt = async (e: React.FormEvent) => { e.preventDefault(); try { const created = await postErp<Salt>('salts', { name, composition: comp, category: cat }); setSalts((rows) => [...rows, created]); setName(''); setComp(''); setShowModal(false); addToast('Salt saved', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to save salt', 'error') } }
  const editSalt = async (salt: Salt) => { const nextName = window.prompt('Salt name', salt.name); if (!nextName) return; const nextComposition = window.prompt('Composition', salt.composition) ?? salt.composition; try { await patchErp('salts', salt.id, { name: nextName, composition: nextComposition, category: salt.category }); setSalts((rows) => rows.map((row) => row.id === salt.id ? { ...row, name: nextName, composition: nextComposition } : row)); addToast('Salt updated', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to update salt', 'error') } }
  const removeSalt = async (salt: Salt) => { if (!window.confirm(`Delete ${salt.name}?`)) return; try { await deleteErp('salts', salt.id); setSalts((rows) => rows.filter((row) => row.id !== salt.id)); addToast('Salt deleted', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to delete salt', 'error') } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Salt / Composition Master</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} salts | Generic drug lookup</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"><Plus size={16} /> Add Salt</button>
      </div>
      <div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by salt or composition..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500" /></div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[650px] w-full text-xs">
          <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Code</th><th className="text-left px-4 py-3 font-medium">Salt Name</th><th className="text-left px-4 py-3 font-medium">Composition</th><th className="text-left px-4 py-3 font-medium">Category</th><th className="text-right px-4 py-3 font-medium">Items</th><th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map(s => (<tr key={s.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 font-mono text-slate-400">{s.id}</td>
              <td className="px-4 py-3 font-medium text-white">{s.name}</td>
              <td className="px-4 py-3 text-slate-400">{s.composition}</td>
              <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', CAT_COLORS[s.category])}>{s.category}</span></td>
              <td className="px-4 py-3 text-right">{s.itemcount}</td>
              <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><button aria-label={`Edit ${s.name}`} onClick={() => editSalt(s)} className="p-1 hover:text-white text-slate-400"><Edit2 size={14} /></button><button aria-label={`Delete ${s.name}`} onClick={() => removeSalt(s)} className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={14} /></button></div></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      {showModal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-4">Add Salt / Composition</h3>
        <form onSubmit={saveSalt} className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Salt Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Composition</label>
            <input type="text" required value={comp} onChange={(e) => setComp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
              {Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md">Save</button></div>
        </form></div></div>)}
    </div>
  )
}
