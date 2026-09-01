import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2, X, AlertTriangle, Check, FlaskConical } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Salt {
  id: string
  code?: string
  name: string
  composition: string
  itemcount: number
  category: string
}

const CAT_COLORS: Record<string, string> = {
  Antibiotic: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  Analgesic: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Antiallergic: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  Antidiabetic: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Gastrointestinal: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  Respiratory: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
}

export default function SaltMaster() {
  const [salts, setSalts] = useState<Salt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add/Edit modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedSalt, setSelectedSalt] = useState<Salt | null>(null)
  const [name, setName] = useState('')
  const [comp, setComp] = useState('')
  const [cat, setCat] = useState('Antibiotic')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete modal state
  const [deletingSalt, setDeletingSalt] = useState<Salt | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showToast = useUIStore((s) => s.showToast)

  const loadData = () => {
    setLoading(true)
    getErp<Salt[]>('salts')
      .then((rows) => setSalts(rows || []))
      .catch((e) => showToast(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const openAddModal = () => {
    setModalMode('add')
    setSelectedSalt(null)
    setName('')
    setComp('')
    setCat('Antibiotic')
  }

  const openEditModal = (salt: Salt) => {
    setModalMode('edit')
    setSelectedSalt(salt)
    setName(salt.name)
    setComp(salt.composition || '')
    setCat(salt.category || 'Antibiotic')
  }

  const saveSalt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast('Salt name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      if (modalMode === 'add') {
        const created = await postErp<Salt>('salts', {
          name: name.trim(),
          composition: comp.trim(),
          category: cat,
        })
        setSalts((rows) => [created, ...rows])
        showToast('Salt created successfully.')
      } else if (modalMode === 'edit' && selectedSalt) {
        await patchErp('salts', selectedSalt.id, {
          name: name.trim(),
          composition: comp.trim(),
          category: cat,
        })
        setSalts((rows) =>
          rows.map((row) =>
            row.id === selectedSalt.id ? { ...row, name: name.trim(), composition: comp.trim(), category: cat } : row
          )
        )
        showToast('Salt updated successfully.')
      }
      setModalMode(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save salt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingSalt) return
    try {
      setIsDeleting(true)
      await deleteErp('salts', deletingSalt.id)
      setSalts((rows) => rows.filter((row) => row.id !== deletingSalt.id))
      showToast(`Salt "${deletingSalt.name}" deleted.`)
      setDeletingSalt(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete salt.')
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return salts.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.composition || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
    )
  }, [salts, search])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Salt / Composition Master</h1>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              {filtered.length} Generic Salts
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">Generic drug lookup, therapeutic categories and molecule definitions</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} />
          Add Salt
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by salt, composition, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[650px] w-full text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <th className="text-left px-4 py-3 font-semibold">Code / ID</th>
              <th className="text-left px-4 py-3 font-semibold">Salt Name</th>
              <th className="text-left px-4 py-3 font-semibold">Composition</th>
              <th className="text-left px-4 py-3 font-semibold">Category</th>
              <th className="text-right px-4 py-3 font-semibold">Items</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 animate-pulse">
                  Loading salts…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No salts found matching your search criteria.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-4 py-3 font-mono text-slate-400 group-hover:text-indigo-300">
                    {s.code || s.id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                    <FlaskConical size={14} className="text-slate-500" />
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{s.composition || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold',
                        CAT_COLORS[s.category] || 'bg-slate-800 text-slate-300 border border-slate-700'
                      )}
                    >
                      {s.category || 'General'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">{s.itemcount ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => openEditModal(s)}
                        className="p-1.5 hover:text-amber-400 text-slate-400 hover:bg-slate-800 rounded transition"
                        title="Edit Salt"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setDeletingSalt(s)}
                        className="p-1.5 hover:text-rose-400 text-slate-400 hover:bg-slate-800 rounded transition"
                        title="Delete Salt"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setModalMode(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 relative shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {modalMode === 'add' ? 'Add Salt / Composition' : 'Edit Salt / Composition'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveSalt} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Salt Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Composition</label>
                <input
                  type="text"
                  placeholder="e.g. N-(4-hydroxyphenyl)acetamide"
                  value={comp}
                  onChange={(e) => setComp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Category</label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-indigo-500"
                >
                  {Object.keys(CAT_COLORS).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : modalMode === 'add' ? 'Save Salt' : 'Update Salt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSalt && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setDeletingSalt(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Salt</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingSalt.name}"</span>?
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSalt(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
