import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Warehouse } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface Location { id: string; name: string; type: string; address: string; capacity: number; used: number; status: string }

const DATA: Location[] = [
  { id: 'L01', name: 'Store A', type: 'Store Room', address: 'Ground Floor, Block A', capacity: 5000, used: 3200, status: 'active' },
  { id: 'L02', name: 'Store B', type: 'Store Room', address: 'Ground Floor, Block B', capacity: 3000, used: 1800, status: 'active' },
  { id: 'L03', name: 'Store C', type: 'Store Room', address: 'First Floor', capacity: 2000, used: 1200, status: 'active' },
  { id: 'L04', name: 'Main Godown', type: 'Godown', address: 'Warehouse Road, Building 2', capacity: 20000, used: 14500, status: 'active' },
  { id: 'L05', name: 'Cold Storage', type: 'Godown', address: 'Warehouse Road, Building 3', capacity: 5000, used: 3200, status: 'active' },
  { id: 'L06', name: 'Returns Area', type: 'Block Room', address: 'Back Office, Block C', capacity: 1000, used: 350, status: 'active' },
]

const TYPE_STYLE: Record<string, string> = {
  'Store Room': 'bg-blue-500/10 text-blue-400', Godown: 'bg-purple-500/10 text-purple-400', 'Block Room': 'bg-amber-500/10 text-amber-400',
}

export default function LocationMaster() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const filtered = DATA.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase()))

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
              <div className="flex gap-1"><button className="p-1 hover:text-white text-slate-400"><Edit2 size={12} /></button><button className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={12} /></button></div>
            </div>
          </div>)
        })}
      </div>
      {showModal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-4">Add Location</h3>
        <form onSubmit={(e) => { e.preventDefault(); setShowModal(false) }} className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"><option>Store Room</option><option>Godown</option><option>Block Room</option></select></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Address</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capacity (units)</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" /></div>
          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md">Save</button></div>
        </form></div></div>)}
    </div>
  )
}
