import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface HsnItem { id: string; code: string; description: string; gstRate: number; type: 'Goods' | 'Services' }

export default function HsnList() {
  const [items, setItems] = useState<HsnItem[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [gst, setGst] = useState(12)
  const [type, setType] = useState<'Goods' | 'Services'>('Goods')
  const showToast = useUIStore((state) => state.showToast)
  useEffect(() => { getErp<any[]>('hsn').then((rows) => setItems(rows.map((row) => ({ id: row.id, code: row.code, description: row.description ?? '', gstRate: Number(row.gst_rate), type: row.code?.startsWith('99') ? 'Services' : 'Goods' })))).catch((error) => showToast(error instanceof Error ? error.message : 'Could not load HSN codes.')) }, [showToast])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) return
    try { const row = await postErp<any>('hsn', { code, description: name, gst_rate: gst }); setItems([...items, { id: row.id, code: row.code, description: row.description ?? '', gstRate: Number(row.gst_rate), type }]); setName(''); setCode(''); setGst(12); setShowModal(false); showToast('HSN / SAC saved.') } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save HSN code.') }
  }
  const removeItem = async (id: string) => { try { await deleteErp('hsn', id); setItems((current) => current.filter((item) => item.id !== id)); showToast('HSN / SAC deleted.') } catch (error) { showToast(error instanceof Error ? error.message : 'Could not delete HSN code.') } }
  const editItem = async (item: HsnItem) => { const description = window.prompt('HSN / SAC description', item.description); if (!description) return; const rate = Number(window.prompt('GST rate', String(item.gstRate))); if (!Number.isFinite(rate)) return; try { await patchErp('hsn', item.id, { description, gst_rate: rate }); setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, description, gstRate: rate } : row)); showToast('HSN / SAC updated.') } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update HSN code.') } }

  const filtered = items.filter(i => i.description.toLowerCase().includes(search.toLowerCase()) || i.code.includes(search))

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HSN / SAC Master</h1>
          <p className="text-sm text-slate-400 mt-1">Harmonized System of Nomenclature & Service Accounting Codes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Plus size={16} /> Add HSN / SAC
        </button>
      </div>
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md mb-6">
        <Search className="text-slate-400" size={18} />
        <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-white text-sm w-full" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-4">HSN / SAC Code</th>
              <th className="p-4">Description</th>
              <th className="p-4">Type</th>
              <th className="p-4">GST Rate</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {filtered.map(i => (
              <tr key={i.id} className="hover:bg-slate-900/30 text-slate-300">
                <td className="p-4 font-mono font-medium text-slate-400">{i.code}</td>
                <td className="p-4 font-medium text-white">{i.description}</td>
                <td className="p-4">{i.type}</td>
                <td className="p-4 text-emerald-400">{i.gstRate}%</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button aria-label={`Edit ${i.code}`} onClick={() => editItem(i)} className="p-1 hover:text-white text-slate-400 transition"><Edit2 size={16} /></button>
                    <button onClick={() => removeItem(i.id)} className="p-1 hover:text-rose-400 text-slate-400 transition"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-bold text-white mb-4">Add New HSN / SAC</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Code</label>
                <input type="text" required placeholder="e.g. 30049011" value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
                <input type="text" required placeholder="e.g. Paracetamol preparations" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as 'Goods' | 'Services')} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500">
                    <option value="Goods">Goods</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GST Rate (%)</label>
                  <input type="number" required value={gst} onChange={(e) => setGst(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md">Save HSN / SAC</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
