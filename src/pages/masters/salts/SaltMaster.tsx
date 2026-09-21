import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  Antibiotic: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold shadow-2xs',
  Analgesic: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs',
  Antiallergic: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold shadow-2xs',
  Antidiabetic: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold shadow-2xs',
  Gastrointestinal: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold shadow-2xs',
  Respiratory: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-semibold shadow-2xs',
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Salt / Composition Master</h1>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold shadow-2xs">
              {filtered.length} Generic Salts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Generic drug lookup, therapeutic categories and molecule definitions</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-sm font-semibold shadow-xs transition"
        >
          <Plus size={16} />
          Add Salt
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by salt, composition, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground shadow-2xs transition"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-xs">
        <table className="min-w-[650px] w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-mono">
              <th className="text-left px-4 py-3 font-semibold">Code / ID</th>
              <th className="text-left px-4 py-3 font-semibold">Salt Name</th>
              <th className="text-left px-4 py-3 font-semibold">Composition</th>
              <th className="text-left px-4 py-3 font-semibold">Category</th>
              <th className="text-right px-4 py-3 font-semibold">Items</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading salts…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No salts found matching your search criteria.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-4 py-3 font-mono text-muted-foreground group-hover:text-foreground">
                    {s.code || s.id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    <FlaskConical size={14} className="text-muted-foreground" />
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.composition || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                        CAT_COLORS[s.category] || 'bg-muted text-foreground border border-border'
                      )}
                    >
                      {s.category || 'General'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.itemcount ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => openEditModal(s)}
                        className="p-1.5 hover:text-amber-600 dark:hover:text-amber-400 text-muted-foreground hover:bg-muted rounded transition"
                        title="Edit Salt"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setDeletingSalt(s)}
                        className="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 text-muted-foreground hover:bg-muted rounded transition"
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
      {modalMode &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
            onClick={() => setModalMode(null)}
          >
            <div
              className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-2xl space-y-4 text-card-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground">
                  {modalMode === 'add' ? 'Add Salt / Composition' : 'Edit Salt / Composition'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveSalt} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                    Salt Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Composition</label>
                  <input
                    type="text"
                    placeholder="e.g. N-(4-hydroxyphenyl)acetamide"
                    value={comp}
                    onChange={(e) => setComp(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Category</label>
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg p-2.5 text-foreground text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    {Object.keys(CAT_COLORS).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg shadow-xs transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : modalMode === 'add' ? 'Save Salt' : 'Update Salt'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {deletingSalt &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
            onClick={() => setDeletingSalt(null)}
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
                  <h3 className="text-base font-bold text-foreground">Delete Salt</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingSalt.name}"</span>?
              </p>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingSalt(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
