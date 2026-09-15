import { useState } from 'react'
import { Plus, Hash, Save } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useEffect } from 'react'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface Series { id:string; doc:string; prefix:string; suffix:string; nextNo:number; padding:number; fyReset:boolean; active:boolean }

export default function SeriesMaster() {
  const [series,setSeries] = useState<Series[]>([])
  const [saving, setSaving] = useState(false)
  const addToast = useUIStore((s) => s.addToast)
  useEffect(() => { getErp<Series[]>('series').then(setSeries).catch((e) => addToast(e.message, 'error')) }, [addToast])
  const update = (id:string, field:keyof Series, value:any) => setSeries(series.map(s=>s.id===id?{...s,[field]:value}:s))
  const preview = (s:Series) => `${s.prefix}${String(s.nextNo).padStart(s.padding,'0')}${s.suffix}`
  const saveAll = async () => { setSaving(true); try { const saved = await Promise.all(series.map((s) => s.id.startsWith('new-') ? postErp<Series>('series', s) : patchErp<Series>('series', s.id, s).then(() => s))); setSeries(saved); addToast('Document series saved', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to save series', 'error') } finally { setSaving(false) } }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-white">Series / Document Numbering</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Hash size={14} className="text-indigo-400"/>Dynamic numbering for every document type</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setSeries([...series,{id:`new-${Date.now()}`,doc:'New Document',prefix:'ND-',suffix:'',nextNo:1,padding:4,fyReset:true,active:true}])} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"><Plus size={16}/> Add Series</button>
          <button onClick={saveAll} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md"><Save size={16}/> {saving ? 'Saving…' : 'Save All'}</button>
        </div>
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto shadow-sm"><table className="min-w-[700px] w-full text-xs">
        <thead><tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
          <th className="text-left px-4 py-3 font-medium">Document</th><th className="text-left px-4 py-3 font-medium">Prefix</th><th className="text-right px-4 py-3 font-medium">Next No.</th><th className="text-right px-4 py-3 font-medium">Padding</th><th className="text-left px-4 py-3 font-medium">Suffix</th><th className="text-center px-4 py-3 font-medium">FY Reset</th><th className="text-center px-4 py-3 font-medium">Active</th><th className="text-left px-4 py-3 font-medium">Live Preview</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800 text-slate-300">
          {series.map(s=>(<tr key={s.id} className={cn('hover:bg-slate-900/30',!s.active&&'opacity-40')}>
            <td className="px-4 py-3 font-medium text-white">{s.doc}</td>
            <td className="px-4 py-3"><input value={s.prefix} onChange={e=>update(s.id,'prefix',e.target.value)} className="w-20 bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-white outline-none focus:border-indigo-500"/></td>
            <td className="px-4 py-3 text-right"><input type="number" value={s.nextNo} onChange={e=>update(s.id,'nextNo',Number(e.target.value))} className="w-24 bg-slate-950 border border-slate-800 rounded p-1.5 text-right text-white outline-none focus:border-indigo-500"/></td>
            <td className="px-4 py-3 text-right"><select value={s.padding} onChange={e=>update(s.id,'padding',Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"><option>3</option><option>4</option><option>5</option><option>6</option></select></td>
            <td className="px-4 py-3"><input value={s.suffix} onChange={e=>update(s.id,'suffix',e.target.value)} className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-white outline-none focus:border-indigo-500"/></td>
            <td className="px-4 py-3 text-center"><input type="checkbox" checked={s.fyReset} onChange={e=>update(s.id,'fyReset',e.target.checked)} className="accent-indigo-600"/></td>
            <td className="px-4 py-3 text-center"><button onClick={()=>update(s.id,'active',!s.active)} className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',s.active?'bg-emerald-500/10 text-emerald-400':'bg-slate-700/50 text-slate-400')}>{s.active?'ON':'OFF'}</button></td>
            <td className="px-4 py-3 font-mono font-bold text-indigo-400">{preview(s)}</td>
          </tr>))}
        </tbody></table></div>
    </div>
  )
}
