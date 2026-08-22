import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Download, MoreHorizontal, Phone, MapPin, CreditCard } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/uiStore'
import { getErp, patchErp, postErp } from '../../lib/erpApi'

interface Party {
  id: string; name: string; type: 'customer' | 'supplier'; phone: string; city: string;
  gstin: string; balance: number; creditLimit: number; lastSale: string; status: 'active' | 'blocked'
}

export default function PartyList() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all')
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => { getErp<Party[]>('parties').then(setParties).catch((error) => showToast(error instanceof Error ? error.message : 'Could not load parties.')).finally(() => setLoading(false)) }, [showToast])

  const filtered = parties.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()) || p.gstin.includes(search)
    const matchType = typeFilter === 'all' || p.type === typeFilter
    return matchSearch && matchType
  })

  const exportParties = () => {
    const header = ['ID', 'Name', 'Type', 'Phone', 'City', 'GSTIN', 'Balance', 'Credit limit', 'Status']
    const rows = filtered.map((p) => [p.id, p.name, p.type, p.phone, p.city, p.gstin, p.balance, p.creditLimit, p.status])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pharma-erp-parties.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    showToast(`${filtered.length} parties exported to CSV.`)
  }

  const createParty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const phone = String(data.get('phone') || '').trim()
    if (!name || !phone) return
    try { const created = await postErp<Party>('parties', { name, type: String(data.get('type')), phone, city: String(data.get('city') || ''), gstin: String(data.get('gstin') || ''), creditLimit: Number(data.get('creditLimit')) || 0 }); setParties((current) => [...current, created]); setShowCreate(false); showToast(`${name} was added to Party Master.`) } catch (error) { showToast(error instanceof Error ? error.message : 'Could not create party.') }
  }

  const togglePartyStatus = async (id: string) => {
    const selected = parties.find((party) => party.id === id); if (!selected) return
    const status = selected.status === 'active' ? 'blocked' : 'active'
    try { await patchErp('parties', id, { status }); setParties((current) => current.map((party) => party.id === id ? { ...party, status } : party)); showToast(`Party ${status}.`) } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update party.') }
    setActiveMenu(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Parties</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} parties &bull; Customers & Suppliers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Party</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-md border border-input overflow-hidden">
          {(['all', 'customer', 'supplier'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 text-sm capitalize transition-colors',
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" aria-label="Export filtered parties" onClick={exportParties}>
          <Download size={16} />
        </Button>
      </div>

      {/* Table */}
      <div className="glass-surface rounded-lg overflow-hidden">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading parties…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">GSTIN</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Credit Limit</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border table-row-hover">
                  <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/masters/parties/${p.id}`} className="font-medium hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                      p.type === 'customer' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    )}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.city}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.gstin}</td>
                  <td className={cn('px-4 py-3 text-right font-medium', p.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {formatCurrency(p.balance)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(p.creditLimit)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                      p.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`} className="relative h-7 w-7" onClick={() => setActiveMenu(activeMenu === p.id ? null : p.id)}>
                      <MoreHorizontal size={14} />
                    </Button>
                    {activeMenu === p.id && (
                      <div className="glass-surface absolute right-6 z-20 mt-1 w-40 rounded-md p-1 text-left">
                        <Link to={`/masters/parties/${p.id}`} className="block rounded px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => setActiveMenu(null)}>View account</Link>
                        <button type="button" onClick={() => togglePartyStatus(p.id)} className="w-full rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">{p.status === 'active' ? 'Block party' : 'Unblock party'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-party-title">
          <form onSubmit={createParty} className="glass-surface w-full max-w-lg rounded-xl p-6">
            <div className="mb-5"><h2 id="new-party-title" className="text-lg font-semibold">New party</h2><p className="mt-1 text-sm text-muted-foreground">Create a customer or supplier record.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium sm:col-span-2">Name<input required name="name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" placeholder="Party legal name" /></label>
              <label className="space-y-1 text-sm font-medium">Type<select name="type" defaultValue="customer" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"><option value="customer">Customer</option><option value="supplier">Supplier</option></select></label>
              <label className="space-y-1 text-sm font-medium">Phone<input required name="phone" inputMode="numeric" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" placeholder="10-digit number" /></label>
              <label className="space-y-1 text-sm font-medium">City<input name="city" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" placeholder="City" /></label>
              <label className="space-y-1 text-sm font-medium">Credit limit<input name="creditLimit" type="number" min="0" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" placeholder="0" /></label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">GSTIN<input name="gstin" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" placeholder="Optional" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="submit">Save party</Button></div>
          </form>
        </div>
      )}
    </div>
  )
}
