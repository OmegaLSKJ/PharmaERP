import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Download, MoreHorizontal, Phone, MapPin, CreditCard } from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/uiStore'

interface Party {
  id: string; name: string; type: 'customer' | 'supplier'; phone: string; city: string;
  gstin: string; balance: number; creditLimit: number; lastSale: string; status: 'active' | 'blocked'
}

const PARTIES: Party[] = [
  { id: 'P001', name: 'MediCare Pharma Pvt Ltd', type: 'customer', phone: '9876543210', city: 'Mumbai', gstin: '27AAACM1234F1Z5', balance: 125000, creditLimit: 500000, lastSale: '2026-03-15', status: 'active' },
  { id: 'P002', name: 'HealthFirst Distributors', type: 'customer', phone: '9876543211', city: 'Delhi', gstin: '07BBBHM5678G1Z8', balance: -45000, creditLimit: 300000, lastSale: '2026-03-14', status: 'active' },
  { id: 'P003', name: 'CareWell Pharmacy', type: 'customer', phone: '9876543212', city: 'Bangalore', gstin: '29CCCPW9012H1Z1', balance: 78000, creditLimit: 200000, lastSale: '2026-03-12', status: 'active' },
  { id: 'P004', name: 'Sun Pharma Industries', type: 'supplier', phone: '9876543213', city: 'Mumbai', gstin: '27DDDSS3456J1Z4', balance: -230000, creditLimit: 1000000, lastSale: '2026-03-10', status: 'active' },
  { id: 'P005', name: 'Cipla Ltd', type: 'supplier', phone: '9876543214', city: 'Mumbai', gstin: '27EEECI7890K1Z7', balance: -560000, creditLimit: 2000000, lastSale: '2026-03-08', status: 'active' },
  { id: 'P006', name: 'LifeLine Medical Stores', type: 'customer', phone: '9876543215', city: 'Chennai', gstin: '33FFFLM1234L1Z0', balance: 156000, creditLimit: 400000, lastSale: '2026-03-05', status: 'blocked' },
  { id: 'P007', name: 'Dr. Reddy\'s Laboratories', type: 'supplier', phone: '9876543216', city: 'Hyderabad', gstin: '36GGGDR5678M1Z3', balance: -180000, creditLimit: 800000, lastSale: '2026-03-01', status: 'active' },
  { id: 'P008', name: 'PharmaPlus Retail', type: 'customer', phone: '9876543217', city: 'Pune', gstin: '27HHHPP9012N1Z6', balance: 34000, creditLimit: 150000, lastSale: '2026-02-28', status: 'active' },
  { id: 'P009', name: 'Ranbaxy Laboratories', type: 'supplier', phone: '9876543218', city: 'Gurgaon', gstin: '06IIIRB3456P1Z9', balance: -95000, creditLimit: 600000, lastSale: '2026-02-25', status: 'active' },
  { id: 'P010', name: 'Wellness Pharma Chain', type: 'customer', phone: '9876543219', city: 'Kolkata', gstin: '19JJJWT7890R1Z2', balance: 210000, creditLimit: 350000, lastSale: '2026-02-20', status: 'active' },
]

export default function PartyList() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all')
  const [parties, setParties] = useState(PARTIES)
  const [showCreate, setShowCreate] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)

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

  const createParty = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const phone = String(data.get('phone') || '').trim()
    if (!name || !phone) return
    setParties((current) => [...current, { id: `P${String(current.length + 1).padStart(3, '0')}`, name, type: String(data.get('type')) as Party['type'], phone, city: String(data.get('city') || '—'), gstin: String(data.get('gstin') || '—'), balance: 0, creditLimit: Number(data.get('creditLimit')) || 0, lastSale: new Date().toISOString().slice(0, 10), status: 'active' }])
    setShowCreate(false)
    showToast(`${name} was added to Party Master.`)
  }

  const togglePartyStatus = (id: string) => {
    setParties((current) => current.map((party) => party.id === id ? { ...party, status: party.status === 'active' ? 'blocked' : 'active' } : party))
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
