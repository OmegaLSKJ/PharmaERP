import { useState } from 'react'
import { Save, Building2, Users, Calendar, Shield } from 'lucide-react'

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('Pharma Distribution Co.')
  const [gstin, setGstin] = useState('27AABCP1234F1Z5')
  const [fyStart, setFyStart] = useState('2026-04-01')
  const [fyEnd, setFyEnd] = useState('2027-03-31')
  const [address, setAddress] = useState('123 Medical Market, Mumbai')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Company profile, financial year, and preferences</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Company Info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <Building2 size={16} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Company Information</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Company Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
          </div>
        </div>
      </div>

      {/* Financial Year */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <Calendar size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Financial Year</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Opening Date</label>
              <input type="date" value={fyStart} onChange={(e) => setFyStart(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Closing Date</label>
              <input type="date" value={fyEnd} onChange={(e) => setFyEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Users & Security */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <Users size={16} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Users & Permissions</h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {[
              { name: 'admin@pharmaerp.com', role: 'Admin', status: 'Active' },
              { name: 'manager@pharmaerp.com', role: 'Manager', status: 'Active' },
              { name: 'operator@pharmaerp.com', role: 'Operator', status: 'Active' },
            ].map((user) => (
              <div key={user.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-white">{user.name}</div>
                    <div className="text-xs text-slate-400">{user.role}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{user.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
