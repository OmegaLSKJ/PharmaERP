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
  'Store Room': 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold shadow-2xs',
  Godown: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold shadow-2xs',
  'Block Room': 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs'
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
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Location / Godown Master</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {filtered.length} locations | Store, Godown &amp; Block Room management
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filtered.map((l) => {
          const cap = l.capacity || 1
          const pct = Math.min(100, Math.round(((l.used || 0) / cap) * 100))
          return (
            <div key={l.id} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">{l.name}</span>
                </div>
                <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold', TYPE_STYLE[l.type] || 'bg-muted text-foreground border border-border')}>
                  {l.type}
                </span>
              </div>
              <div className="text-xs text-muted-foreground min-h-[1.5rem]">{l.address || 'No address provided'}</div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="text-foreground font-mono font-medium">
                    {(l.used || 0).toLocaleString()} / {cap.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <span
                  className={cn(
                    'font-semibold',
                    pct > 80 ? 'text-rose-600 dark:text-rose-400' : pct > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                  )}
                >
                  {pct}% utilized
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${l.name}`}
                    onClick={() => openEdit(l)}
                    className="p-1.5 hover:text-foreground text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${l.name}`}
                    onClick={() => setDeletingLoc(l)}
                    className="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-muted-foreground hover:bg-muted rounded transition cursor-pointer"
                  >
                    <Trash2 size={14} />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
            onClick={() => setModalMode(null)}
          >
            <div
              className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl text-card-foreground space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">
                  {modalMode === 'add' ? 'Add Location / Godown' : 'Edit Location / Godown'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveLocation} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                    placeholder="e.g. Central Warehouse"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option>Store Room</option>
                    <option>Godown</option>
                    <option>Block Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                    placeholder="e.g. Sector 4, Industrial Area"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Capacity (units)</label>
                  <input
                    type="number"
                    min="0"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg shadow-xs transition"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
            onClick={() => setDeletingLoc(null)}
          >
            <div
              className="bg-card border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-card-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-full border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Delete Location</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingLoc.name}"</span>?
              </p>
              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingLoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={removeLocation}
                  className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-xs transition"
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
