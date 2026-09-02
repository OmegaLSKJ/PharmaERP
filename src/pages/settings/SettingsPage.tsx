import { useEffect, useState } from 'react'
import { Save, Building2, Users, Calendar, Plus, Trash2, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

type ManagedUser = { id:string;email:string;name:string;role:'admin'|'manager'|'operator';status:'active'|'invited'|'disabled';createdAt:string;lastSignInAt:string|null }

export default function SettingsPage() {
  const company = useUIStore((state) => state.company)
  const setCompanyProfile = useUIStore((state) => state.setCompanyProfile)
  const [form, setForm] = useState(company)
  const [saved, setSaved] = useState(false)
  const currentUser = useAuthStore((state) => state.user)
  const showToast = useUIStore((state) => state.showToast)

  // Keep in sync with store
  useEffect(() => {
    setForm(company)
  }, [company])

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const [users,setUsers]=useState<ManagedUser[]>([])
  const [usersLoading,setUsersLoading]=useState(false)
  const [userBusy,setUserBusy]=useState<string|null>(null)
  const [showAddUser,setShowAddUser]=useState(false)
  const [invite,setInvite]=useState({email:'',name:'',role:'operator' as ManagedUser['role']})

  const readResponse=async(response:Response)=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message??'Request failed.');return payload.data}
  const loadUsers=async()=>{if(currentUser?.role!=='admin')return;setUsersLoading(true);try{setUsers(await readResponse(await fetch('/api/admin/users',{credentials:'include',cache:'no-store'})))}catch(error){showToast(error instanceof Error?error.message:'Unable to load users.')}finally{setUsersLoading(false)}}
  useEffect(()=>{void loadUsers()},[currentUser?.role])
  const addUser=async(event:React.FormEvent)=>{event.preventDefault();setUserBusy('new');try{const created=await readResponse(await fetch('/api/admin/users',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(invite)}));setUsers((rows)=>[...rows,created].sort((a,b)=>a.email.localeCompare(b.email)));setInvite({email:'',name:'',role:'operator'});setShowAddUser(false);showToast(`Invitation sent to ${created.email}.`)}catch(error){showToast(error instanceof Error?error.message:'Unable to invite user.')}finally{setUserBusy(null)}}
  const patchUser=async(id:string,body:object)=>{setUserBusy(id);try{const updated=await readResponse(await fetch('/api/admin/users',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...body})}));setUsers((rows)=>rows.map((user)=>user.id===id?updated:user));showToast('User permissions updated.')}catch(error){showToast(error instanceof Error?error.message:'Unable to update user.')}finally{setUserBusy(null)}}
  const removeUser=async(user:ManagedUser)=>{if(!window.confirm(`Remove ${user.email} from the ERP? This cannot be undone.`))return;setUserBusy(user.id);try{await readResponse(await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`,{method:'DELETE',credentials:'include'}));setUsers((rows)=>rows.filter((row)=>row.id!==user.id));showToast(`${user.email} was removed.`)}catch(error){showToast(error instanceof Error?error.message:'Unable to remove user.')}finally{setUserBusy(null)}}

  const handleSave = () => {
    setCompanyProfile(form)
    setSaved(true)
    showToast('Company profile & preferences updated.')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Company profile, statutory licences, financial year, and users</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition">
          <Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Company Info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <Building2 size={16} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Company Profile &amp; Statutory Licences</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Company / Legal Name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => handleFieldChange('companyName', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">GSTIN</label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => handleFieldChange('gstin', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono tracking-wider"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">I.T. PAN No.</label>
              <input
                type="text"
                value={form.pan}
                onChange={(e) => handleFieldChange('pan', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">D.L. No. (Drug Licence)</label>
              <input
                type="text"
                value={form.dlNo}
                onChange={(e) => handleFieldChange('dlNo', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Official Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Registered Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">City / Station</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Pin Code</label>
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => handleFieldChange('pincode', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => handleFieldChange('state', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => handleFieldChange('country', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
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
              <input
                type="date"
                value={form.fyStart}
                onChange={(e) => handleFieldChange('fyStart', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Closing Date</label>
              <input
                type="date"
                value={form.fyEnd}
                onChange={(e) => handleFieldChange('fyEnd', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users & Security */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
          <Users size={16} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Users & Permissions</h3>
          </div>
          {currentUser?.role==='admin'&&<button type="button" onClick={()=>setShowAddUser((value)=>!value)} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"><Plus size={14}/>{showAddUser?'Cancel':'Add user'}</button>}
        </div>
        <div className="p-4">
          {currentUser?.role!=='admin'&&<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">Only administrators can add, remove or change user permissions.</div>}
          {showAddUser&&currentUser?.role==='admin'&&<form onSubmit={addUser} className="mb-4 grid gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-slate-400">Full name<input required minLength={2} autoFocus value={invite.name} onChange={(event)=>setInvite({...invite,name:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm font-normal normal-case text-white"/></label>
            <label className="text-xs font-semibold uppercase text-slate-400">Email<input required type="email" value={invite.email} onChange={(event)=>setInvite({...invite,email:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm font-normal normal-case text-white"/></label>
            <label className="text-xs font-semibold uppercase text-slate-400">Role<select value={invite.role} onChange={(event)=>setInvite({...invite,role:event.target.value as ManagedUser['role']})} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm font-normal normal-case text-white"><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>
            <div className="flex items-end"><button disabled={userBusy==='new'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 p-2.5 text-sm font-semibold text-white disabled:opacity-50"><UserPlus size={15}/>{userBusy==='new'?'Sending invitation…':'Send invitation'}</button></div>
          </form>}
          <div className="space-y-2">
            {usersLoading&&<div className="py-8 text-center text-sm text-slate-400">Loading users…</div>}
            {!usersLoading&&currentUser?.role==='admin'&&users.length===0&&<div className="py-8 text-center text-sm text-slate-400">No ERP users were found.</div>}
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 rounded-lg px-3 py-3 hover:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                    {(user.name||user.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{user.name}{user.id===currentUser?.id&&<span className="ml-2 text-[10px] text-blue-400">You</span>}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select aria-label={`Role for ${user.email}`} disabled={userBusy===user.id||user.id===currentUser?.id} value={user.role} onChange={(event)=>void patchUser(user.id,{role:event.target.value})} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs capitalize text-white disabled:opacity-50"><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
                  <button type="button" disabled={userBusy===user.id||user.id===currentUser?.id} onClick={()=>void patchUser(user.id,{active:user.status==='disabled'})} className={`rounded border px-2 py-1 text-xs font-semibold capitalize disabled:opacity-50 ${user.status==='disabled'?'border-slate-600 bg-slate-700/30 text-slate-300':'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}>{user.status}</button>
                  <button type="button" aria-label={`Remove ${user.email}`} title="Remove user" disabled={userBusy===user.id||user.id===currentUser?.id} onClick={()=>void removeUser(user)} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"><Trash2 size={15}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
