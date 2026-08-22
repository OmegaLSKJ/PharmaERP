import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Warehouse } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Location { id: string; name: string; type: string; address: string; capacity: number; used: number; status: string }

const TYPE_STYLE: Record<string, string> = {
  'Store Room': 'bg-blue-500/10 text-blue-400', Godown: 'bg-purple-500/10 text-purple-400', 'Block Room': 'bg-amber-500/10 text-amber-400',
}

export default function LocationMaster() {
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('Store Room')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState(0)
  const addToast = useUIStore((s) => s.addToast)
  useEffect(() => { getErp<Location[]>('warehouses').then(setLocations).catch((e) => addToast(e.message, 'error')) }, [addToast])
  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase()))
  const saveLocation = async (e: React.FormEvent) => { e.preventDefault(); try { const created = await postErp<Location>('warehouses', { name, type, address, capacity }); setLocations((rows) => [...rows, created]); setName(''); setAddress(''); setCapacity(0); setShowModal(false); addToast('Location saved', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to save location', 'error') } }
  const editLocation = async (location: Location) => { const nextName = window.prompt('Location name', location.name); if (!nextName) return; try { await patchErp('warehouses', location.id, { name: nextName }); setLocations((rows) => rows.map((row) => row.id === location.id ? { ...row, name: nextName } : row)); addToast('Location updated', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to update location', 'error') } }
  const removeLocation = async (location: Location) => { if (!window.confirm(`Delete ${location.name}?`)) return; try { await deleteErp('warehouses', location.id); setLocations((rows) => rows.filter((row) => row.id !== location.id)); addToast('Location deleted', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to delete location', 'error') } }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Location / Godown Master</h1>
          <p className="text-sm text-slate-400 mt-1">{filtered.length} locations | Store, Godown & Block Room management</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"><Plus size={16} /> Add Location</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map(l => {
          const pct = Math.round((l.used / l.capacity) * 100)
          return (<div key={l.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Warehouse size={16} className="text-indigo-400" /><span className="text-sm font-semibold text-white">{l.name}</span></div>
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TYPE_STYLE[l.type])}>{l.type}</span>
            </div>
            <div className="text-xs text-slate-400 mb-3">{l.address}</div>
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Capacity</span><span className="text-slate-300">{l.used.toLocaleString()} / {l.capacity.toLocaleString()}</span></div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={cn('h-full rounded-full transition-all', pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: pct + '%' }} /></div>
            </div>
            <div className="flex items-center justify-between text-xs"><span className={cn('font-semibold', pct > 80 ? 'text-rose-400' : pct > 60 ? 'text-amber-400' : 'text-emerald-400')}>{pct}% utilized</span>
              <div className="flex gap-1"><button aria-label={`Edit ${l.name}`} onClick={() => editLocation(l)} className="p-1 hover:text-white text-slate-400"><Edit2 size={12} /></button><button aria-label={`Delete ${l.name}`} onClick={() => removeLocation(l)} className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={12} /></button></div>
            </div>
          </div>)
        })}
      </div>
      {showModal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-4">Add Location</h3>
        <form onSubmit={saveLocation} className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"><option>Store Room</option><option>Godown</option><option>Block Room</option></select></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Address</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capacity (units)</label><input type="number" min="0" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md">Save</button></div>
        </form></div></div>)}
    </div>
  )
}
