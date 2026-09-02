import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Edit2, Trash2, Warehouse, X, AlertTriangle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Location {
  id: string
  name: string
  type: string
  address: string
  capacity: number
  used: number
  status: string
}

const TYPE_STYLE: Record<string, string> = {
  'Store Room': 'bg-blue-500/10 text-blue-400',
  Godown: 'bg-purple-500/10 text-purple-400',
  'Block Room': 'bg-amber-500/10 text-amber-400'
}

export default function LocationMaster() {
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(null)
  const [deletingLoc, setDeletingLoc] = useState<Location | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('Store Room')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState(0)

  const addToast = useUIStore((s) => s.addToast)

  useEffect(() => {
    getErp<Location[]>('warehouses')
      .then(setLocations)
      .catch((e) => addToast(e.message, 'error'))
  }, [addToast])

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setSelectedLoc(null)
    setName('')
    setType('Store Room')
    setAddress('')
    setCapacity(1000)
    setModalMode('add')
  }

  const openEdit = (l: Location) => {
    setSelectedLoc(l)
    setName(l.name)
    setType(l.type || 'Store Room')
    setAddress(l.address || '')
    setCapacity(l.capacity || 0)
    setModalMode('edit')
  }

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalMode === 'add') {
        const created = await postErp<Location>('warehouses', { name, type, address, capacity })
        setLocations((rows) => [...rows, created])
        addToast('Location added successfully', 'success')
      } else if (modalMode === 'edit' && selectedLoc) {
        await patchErp('warehouses', selectedLoc.id, { name, type, address, capacity })
        setLocations((rows) =>
          rows.map((row) => (row.id === selectedLoc.id ? { ...row, name, type, address, capacity } : row))
        )
        addToast('Location updated successfully', 'success')
      }
      setModalMode(null)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to save location', 'error')
    }
  }

  const removeLocation = async () => {
    if (!deletingLoc) return
    try {
      await deleteErp('warehouses', deletingLoc.id)
      setLocations((rows) => rows.filter((row) => row.id !== deletingLoc.id))
      addToast('Location deleted', 'success')
      setDeletingLoc(null)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to delete location', 'error')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Location / Godown Master</h1>
          <p className="text-sm text-slate-400 mt-1">
            {filtered.length} locations | Store, Godown &amp; Block Room management
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map((l) => {
          const cap = l.capacity || 1
          const pct = Math.min(100, Math.round(((l.used || 0) / cap) * 100))
          return (
            <div key={l.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse size={16} className="text-indigo-400" />
                  <span className="text-sm font-semibold text-white">{l.name}</span>
                </div>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TYPE_STYLE[l.type] || 'bg-slate-800 text-slate-300')}>
                  {l.type}
                </span>
              </div>
              <div className="text-xs text-slate-400 min-h-[1.5rem]">{l.address || 'No address provided'}</div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Capacity</span>
                  <span className="text-slate-300">
                    {(l.used || 0).toLocaleString()} / {cap.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                <span
                  className={cn(
                    'font-semibold',
                    pct > 80 ? 'text-rose-400' : pct > 60 ? 'text-amber-400' : 'text-emerald-400'
                  )}
                >
                  {pct}% utilized
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${l.name}`}
                    onClick={() => openEdit(l)}
                    className="p-1 hover:text-amber-400 text-slate-400 hover:bg-slate-800 rounded transition"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${l.name}`}
                    onClick={() => setDeletingLoc(l)}
                    className="p-1 hover:text-rose-400 text-slate-400 hover:bg-slate-800 rounded transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modalMode &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={() => setModalMode(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md p-6 relative shadow-2xl text-white space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {modalMode === 'add' ? 'Add Location / Godown' : 'Edit Location / Godown'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveLocation} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
                    placeholder="e.g. Central Warehouse"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    <option>Store Room</option>
                    <option>Godown</option>
                    <option>Block Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
                    placeholder="e.g. Sector 4, Industrial Area"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capacity (units)</label>
                  <input
                    type="number"
                    min="0"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition"
                  >
                    {modalMode === 'add' ? 'Save Location' : 'Update Location'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {deletingLoc &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={() => setDeletingLoc(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Location</h3>
                  <p className="text-xs text-slate-400">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Are you sure you want to delete <span className="font-semibold text-white">"{deletingLoc.name}"</span>?
              </p>
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingLoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={removeLocation}
                  className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-md transition"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
