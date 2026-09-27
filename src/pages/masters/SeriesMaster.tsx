import { useState, useEffect } from 'react'
import { Plus, Hash, Save, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'

export interface Series {
  id: string
  doc: string
  prefix: string
  suffix: string
  nextNo: number
  padding: number
  fyReset: boolean
  active: boolean
}

export default function SeriesMaster() {
  const [series, setSeries] = useState<Series[]>([])
  const [saving, setSaving] = useState(false)
  const addToast = useUIStore((s) => s.addToast)

  const loadSeries = () => {
    getErp<Series[]>('series')
      .then((rows) => {
        if (rows && rows.length > 0) {
          setSeries(rows)
        }
      })
      .catch((e) => addToast(e.message, 'error'))
  }

  useEffect(() => {
    loadSeries()
  }, [addToast])

  useErpAutoRefresh(['series'], () => {
    loadSeries()
  })

  const update = (id: string, field: keyof Series, value: any) =>
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  const preview = (s: Series) => `${s.prefix || ''}${String(s.nextNo || 1).padStart(s.padding || 4, '0')}${s.suffix || ''}`

  const saveAll = async () => {
    setSaving(true)
    try {
      const saved = await Promise.all(
        series.map((s) =>
          s.id.startsWith('new-')
            ? postErp<Series>('series', s)
            : patchErp<Series>('series', s.id, s).then(() => s)
        )
      )
      setSeries(saved)
      addToast('Document series saved. All applicable bills and related records have been updated.', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to save series', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeSeries = async (s: Series) => {
    if (!window.confirm(`Delete numbering series for ${s.doc}?`)) return
    if (s.id.startsWith('new-')) {
      setSeries((rows) => rows.filter((row) => row.id !== s.id))
      return
    }
    try {
      await deleteErp('series', s.id)
      setSeries((rows) => rows.filter((row) => row.id !== s.id))
      addToast('Series deleted', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to delete series', 'error')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Series / Document Numbering</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Hash size={14} className="text-indigo-500" />
            Dynamic numbering for every document type — updates cascade to all applicable bills
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              setSeries([
                ...series,
                {
                  id: `new-${Date.now()}`,
                  doc: 'New Document',
                  prefix: 'ND-',
                  suffix: '',
                  nextNo: 1,
                  padding: 4,
                  fyReset: true,
                  active: true
                }
              ])
            }
            className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium border border-border transition-colors shadow-sm"
          >
            <Plus size={16} /> Add Series
          </button>
          <button
            onClick={() => {
              loadSeries()
              addToast('Reloaded series from server', 'info')
            }}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium border border-border transition-colors shadow-sm"
            title="Refresh series from database"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md transition-colors"
          >
            <Save size={16} /> {saving ? 'Saving & Updating Bills…' : 'Save & Update All Bills'}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-[750px] w-full text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border text-foreground font-semibold uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold text-foreground">Document</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Prefix</th>
              <th className="text-right px-4 py-3 font-semibold text-foreground">Next No.</th>
              <th className="text-right px-4 py-3 font-semibold text-foreground">Padding</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Suffix</th>
              <th className="text-center px-4 py-3 font-semibold text-foreground">FY Reset</th>
              <th className="text-center px-4 py-3 font-semibold text-foreground">Active</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Live Preview</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {series.map((s) => (
              <tr
                key={s.id}
                className={cn('hover:bg-muted/30 transition-colors', !s.active && 'opacity-40')}
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {s.id.startsWith('new-') ? (
                    <input
                      value={s.doc}
                      onChange={(e) => update(s.id, 'doc', e.target.value)}
                      className="w-36 bg-background border border-border rounded p-1.5 font-medium text-foreground outline-none focus:border-indigo-500"
                    />
                  ) : (
                    s.doc
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    value={s.prefix}
                    onChange={(e) => update(s.id, 'prefix', e.target.value)}
                    className="w-24 bg-background border border-border rounded p-1.5 font-mono text-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. G or SI-"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    value={s.nextNo}
                    onChange={(e) => update(s.id, 'nextNo', Number(e.target.value))}
                    className="w-24 bg-background border border-border rounded p-1.5 text-right font-mono text-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <select
                    value={s.padding}
                    onChange={(e) => update(s.id, 'padding', Number(e.target.value))}
                    className="bg-background border border-border rounded p-1.5 font-mono text-foreground outline-none focus:border-indigo-500"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    value={s.suffix}
                    onChange={(e) => update(s.id, 'suffix', e.target.value)}
                    className="w-24 bg-background border border-border rounded p-1.5 font-mono text-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. /26-27"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={s.fyReset}
                    onChange={(e) => update(s.id, 'fyReset', e.target.checked)}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => update(s.id, 'active', !s.active)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-bold tracking-wide transition-colors',
                      s.active
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border border-border'
                    )}
                  >
                    {s.active ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  {preview(s)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    aria-label={`Delete ${s.doc}`}
                    onClick={() => removeSeries(s)}
                    className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
