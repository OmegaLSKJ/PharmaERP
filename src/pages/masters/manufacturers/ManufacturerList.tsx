import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { deleteErp, getErp, patchErp, postErp } from '../../../lib/erpApi';
import { useUIStore } from '../../../store/uiStore';

interface Manufacturer {
  id: string;
  name: string;
  code: string;
  productCount: number;
  status: 'Active' | 'Blocked';
}

export default function ManufacturerList() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const showToast = useUIStore((state) => state.showToast);
  useEffect(() => { getErp<any[]>('manufacturers').then((rows) => setManufacturers(rows.map((row) => ({ id: row.id, name: row.name, code: row.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(), productCount: 0, status: 'Active' })))).catch((error) => showToast(error instanceof Error ? error.message : 'Could not load manufacturers.')) }, [showToast]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    try { const row = await postErp<any>('manufacturers', { name }); setManufacturers([...manufacturers, { id: row.id, name: row.name, code: code.toUpperCase(), productCount: 0, status: 'Active' }]); setName(''); setCode(''); setShowModal(false); showToast('Manufacturer saved.'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save manufacturer.'); }
  };
  const removeManufacturer = async (id: string) => { try { await deleteErp('manufacturers', id); setManufacturers((current) => current.filter((item) => item.id !== id)); showToast('Manufacturer deleted.'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not delete manufacturer.'); } };
  const editManufacturer = async (manufacturer: Manufacturer) => { const name = window.prompt('Manufacturer name', manufacturer.name); if (!name) return; const code = window.prompt('Manufacturer code', manufacturer.code) || manufacturer.code; try { await patchErp('manufacturers', manufacturer.id, { name, code }); setManufacturers((rows) => rows.map((row) => row.id === manufacturer.id ? { ...row, name, code } : row)); showToast('Manufacturer updated.'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update manufacturer.'); } };

  const filtered = manufacturers.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Manufacturer Master</h1>
          <p className="text-sm text-slate-400 mt-1">Manage pharmaceutical brands and companies</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition"
        >
          <Plus size={16} />
          Add Manufacturer
        </button>
      </div>

      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md mb-6">
        <Search className="text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-sm w-full"
        />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-4">Code</th>
              <th className="p-4">Manufacturer Name</th>
              <th className="p-4">Associated Products</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-slate-900/30 text-slate-300">
                <td className="p-4 font-mono font-medium text-slate-400">{m.code}</td>
                <td className="p-4 font-medium text-white">{m.name}</td>
                <td className="p-4">{m.productCount}</td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {m.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button aria-label={`Edit ${m.name}`} onClick={() => editManufacturer(m)} className="p-1 hover:text-white text-slate-400 transition">
                      <Edit2 size={16} />
                    </button>
                    <button aria-label={`Delete ${m.name}`} onClick={() => removeManufacturer(m.id)} className="p-1 hover:text-rose-400 text-slate-400 transition">
                      <Trash2 size={16} />
                    </button>
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
            <h3 className="text-lg font-bold text-white mb-4">Add New Manufacturer</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Company Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CIPL"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cipla Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md"
                >
                  Save Manufacturer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
