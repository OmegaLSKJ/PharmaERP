import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  MapPin,
  CreditCard,
  Building2,
  FileCheck,
  Percent,
  X,
  Check,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/uiStore'
import { getErp, patchErp, postErp } from '../../lib/erpApi'

export interface Party {
  id: string
  name: string
  type: 'customer' | 'supplier' | 'both'
  station?: string
  accountGroup?: string
  balancingMethod?: string
  openingBalance?: number
  openingType?: 'Dr' | 'Cr'
  mailTo?: string
  address?: string
  addressLine2?: string
  pincode?: string
  city: string
  state?: string
  country?: string
  contactPerson?: string
  designation?: string
  phone: string
  mobile?: string
  phoneOff?: string
  phoneRes?: string
  fax?: string
  email?: string
  website?: string
  freezeUpto?: string
  narcoSchH?: string
  dlNo?: string
  dlNumber?: string
  dlExp?: string
  gstHeading?: string
  gstin: string
  gstinDate?: string
  foodLicenceNo?: string
  foodLicenceExp?: string
  pan?: string
  ledgerCategory?: string
  ledgerType?: string
  creditLimit: number
  creditDays?: number
  balance: number
  lastSale?: string
  status: 'active' | 'blocked'
}

const GST_STATES = [
  '18-ASSAM',
  '27-MAHARASHTRA',
  '07-DELHI',
  '19-WEST BENGAL',
  '24-GUJARAT',
  '33-TAMIL NADU',
  '29-KARNATAKA',
  '09-UTTAR PRADESH',
  '03-PUNJAB',
  '06-HARYANA',
  '08-RAJASTHAN',
  '10-BIHAR',
  '21-ODISHA',
  '36-TELANGANA',
  '37-ANDHRA PRADESH',
  '32-KERALA',
  '23-MADHYA PRADESH',
  '22-CHHATTISGARH',
  '20-JHARKHAND',
  '12-ARUNACHAL PRADESH',
  '17-MEGHALAYA',
  '15-MIZORAM',
  '13-NAGALAND',
  '14-MANIPUR',
  '16-TRIPURA',
  '11-SIKKIM',
]

export default function PartyList() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all')
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'address' | 'licenses' | 'gst' | 'credit'>('general')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  // Form states matching Marg ERP Ledger specification
  const [formData, setFormData] = useState({
    name: '',
    type: 'customer' as 'customer' | 'supplier' | 'both',
    station: '',
    accountGroup: 'SUNDRY DEBTORS',
    balancingMethod: 'On Account',
    openingBalance: '0.00',
    openingType: 'Dr' as 'Dr' | 'Cr',
    mailTo: '',
    address: '',
    addressLine2: '',
    pincode: '',
    city: '',
    state: '18-ASSAM',
    country: 'INDIA',
    contactPerson: '',
    designation: '',
    phone: '',
    mobile: '',
    phoneOff: '',
    phoneRes: '',
    fax: '',
    email: '',
    website: '',
    freezeUpto: '',
    narcoSchH: 'Allow All',
    dlNo: '',
    dlExp: '',
    gstHeading: 'Local',
    gstin: '',
    gstinDate: '',
    foodLicenceNo: '',
    foodLicenceExp: '',
    pan: '',
    ledgerCategory: 'OTHERS',
    ledgerType: 'REGISTERED',
    creditLimit: '0',
    creditDays: '30',
  })

  useEffect(() => {
    getErp<Party[]>('parties')
      .then(setParties)
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load parties.'))
      .finally(() => setLoading(false))
  }, [showToast])

  const filtered = parties.filter((p) => {
    const s = (search || '').toLowerCase().trim()
    const matchSearch =
      !s ||
      (p?.name || '').toLowerCase().includes(s) ||
      (p?.id || '').toLowerCase().includes(s) ||
      (p?.gstin || '').toLowerCase().includes(s) ||
      (p?.dlNo || p?.dlNumber || '').toLowerCase().includes(s) ||
      (p?.phone || '').includes(s)
    const matchType = typeFilter === 'all' || p?.type === typeFilter
    return matchSearch && matchType
  })

  // Auto-sync Mail To with Name, and auto-sync Account Group with Type
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'name' && (!prev.mailTo || prev.mailTo === prev.name)) {
        next.mailTo = value
      }

      if (field === 'type') {
        next.accountGroup = value === 'supplier' ? 'SUNDRY CREDITORS' : 'SUNDRY DEBTORS'
      }

      if (field === 'accountGroup') {
        next.type = value === 'SUNDRY CREDITORS' ? 'supplier' : 'customer'
      }

      // Auto-extract PAN and State from GSTIN
      if (field === 'gstin') {
        const cleanGst = value.trim().toUpperCase()
        next.gstin = cleanGst
        if (cleanGst.length >= 12) {
          next.pan = cleanGst.slice(2, 12)
        }
        if (cleanGst.length >= 2) {
          const stateCode = cleanGst.slice(0, 2)
          const matchedState = GST_STATES.find((st) => st.startsWith(stateCode + '-'))
          if (matchedState) {
            next.state = matchedState
          }
        }
      }

      return next
    })
  }

  const exportParties = () => {
    const header = [
      'ID',
      'Name',
      'Type',
      'Phone',
      'City',
      'State',
      'D.L. No.',
      'GSTIN',
      'PAN',
      'Balance',
      'Credit limit',
      'Status',
    ]
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      p.type,
      p.phone,
      p.city,
      p.state || '18-ASSAM',
      p.dlNo || p.dlNumber || '',
      p.gstin,
      p.pan || '',
      p.balance,
      p.creditLimit,
      p.status,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pharma-erp-parties.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    showToast(`${filtered.length} parties exported to CSV.`)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'customer',
      station: '',
      accountGroup: 'SUNDRY DEBTORS',
      balancingMethod: 'On Account',
      openingBalance: '0.00',
      openingType: 'Dr',
      mailTo: '',
      address: '',
      addressLine2: '',
      pincode: '',
      city: '',
      state: '18-ASSAM',
      country: 'INDIA',
      contactPerson: '',
      designation: '',
      phone: '',
      mobile: '',
      phoneOff: '',
      phoneRes: '',
      fax: '',
      email: '',
      website: '',
      freezeUpto: '',
      narcoSchH: 'Allow All',
      dlNo: '',
      dlExp: '',
      gstHeading: 'Local',
      gstin: '',
      gstinDate: '',
      foodLicenceNo: '',
      foodLicenceExp: '',
      pan: '',
      ledgerCategory: 'OTHERS',
      ledgerType: 'REGISTERED',
      creditLimit: '0',
      creditDays: '30',
    })
    setActiveTab('general')
  }

  const createParty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formData.name.trim()) {
      showToast('Party legal name is required.')
      return
    }

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        station: formData.station.trim(),
        accountGroup: formData.accountGroup,
        balancingMethod: formData.balancingMethod,
        openingBalance: Number(formData.openingBalance) || 0,
        openingType: formData.openingType,
        mailTo: formData.mailTo.trim() || formData.name.trim(),
        address: formData.address.trim(),
        addressLine2: formData.addressLine2.trim(),
        pincode: formData.pincode.trim(),
        city: formData.city.trim(),
        state: formData.state,
        country: formData.country,
        contactPerson: formData.contactPerson.trim(),
        designation: formData.designation.trim(),
        phone: formData.phone.trim() || formData.mobile.trim(),
        mobile: formData.mobile.trim(),
        phoneOff: formData.phoneOff.trim(),
        phoneRes: formData.phoneRes.trim(),
        fax: formData.fax.trim(),
        email: formData.email.trim(),
        website: formData.website.trim(),
        freezeUpto: formData.freezeUpto,
        narcoSchH: formData.narcoSchH,
        dlNo: formData.dlNo.trim(),
        dlNumber: formData.dlNo.trim(),
        dlExp: formData.dlExp,
        gstHeading: formData.gstHeading,
        gstin: formData.gstin.trim(),
        gstinDate: formData.gstinDate,
        foodLicenceNo: formData.foodLicenceNo.trim(),
        foodLicenceExp: formData.foodLicenceExp,
        pan: formData.pan.trim(),
        ledgerCategory: formData.ledgerCategory,
        ledgerType: formData.ledgerType,
        creditLimit: Number(formData.creditLimit) || 0,
        creditDays: Number(formData.creditDays) || 0,
      }

      const created = await postErp<Party>('parties', payload)
      setParties((current) => [...current, created])
      setShowCreate(false)
      resetForm()
      showToast(`${created.name} was added to Party Master.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create party.')
    }
  }

  const togglePartyStatus = async (id: string) => {
    const selected = parties.find((party) => party.id === id)
    if (!selected) return
    const status = selected.status === 'active' ? 'blocked' : 'active'
    try {
      await patchErp('parties', id, { status })
      setParties((current) =>
        current.map((party) => (party.id === id ? { ...party, status } : party))
      )
      showToast(`Party ${status}.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update party.')
    }
    setActiveMenu(null)
  }

  return (
    <div className="space-y-4">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Parties / Ledger Master</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} parties &bull; Customers &amp; Suppliers &bull; Drug License &amp; GST compliance
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true) }}>
          <Plus size={16} /> New Party / Ledger
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, GSTIN, D.L. No..."
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
      <div className="glass-surface rounded-lg overflow-hidden border border-border">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading parties…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase text-[11px]">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Ledger Name</th>
                <th className="text-left px-4 py-3 font-medium">Group / Type</th>
                <th className="text-left px-4 py-3 font-medium">Station / City</th>
                <th className="text-left px-4 py-3 font-medium">D.L. No.</th>
                <th className="text-left px-4 py-3 font-medium">GSTIN &amp; PAN</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
                <th className="text-right px-4 py-3 font-medium">Credit Limit</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="table-row-hover">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/masters/parties/${p.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                    {p.phone && <span className="block text-[11px] text-muted-foreground mt-0.5">{p.phone}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                        p.type === 'supplier' || p.accountGroup === 'SUNDRY CREDITORS'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      )}
                    >
                      {p.accountGroup || (p.type === 'supplier' ? 'SUNDRY CREDITORS' : 'SUNDRY DEBTORS')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.station || p.city || '—'}</div>
                    {p.state && <div className="text-[10px] text-muted-foreground">{p.state}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground font-medium">
                    {p.dlNo || p.dlNumber ? (
                      <div>
                        <span>{p.dlNo || p.dlNumber}</span>
                        {p.dlExp && <span className="block text-[10px] text-muted-foreground">Exp: {p.dlExp}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.gstin ? (
                      <div>
                        <span className="font-mono text-xs font-bold text-foreground tracking-wider">{p.gstin}</span>
                        {p.pan && <span className="block text-[10px] font-mono text-muted-foreground">PAN: {p.pan}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono font-bold',
                      p.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {formatCurrency(p.balance)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(p.creditLimit)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-[10px] font-semibold capitalize',
                        p.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${p.name}`}
                      className="relative h-7 w-7"
                      onClick={() => setActiveMenu(activeMenu === p.id ? null : p.id)}
                    >
                      <MoreHorizontal size={14} />
                    </Button>
                    {activeMenu === p.id && (
                      <div className="glass-surface absolute right-6 z-20 mt-1 w-40 rounded-lg p-1 text-left border border-border shadow-xl">
                        <Link
                          to={`/masters/parties/${p.id}`}
                          className="block rounded px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                          onClick={() => setActiveMenu(null)}
                        >
                          View 360&deg; Account
                        </Link>
                        <button
                          type="button"
                          onClick={() => togglePartyStatus(p.id)}
                          className="w-full rounded px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
                        >
                          {p.status === 'active' ? 'Block party' : 'Unblock party'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive New Party / Modify Ledger Modal (Matching Marg ERP Ledger Spec) */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-party-title"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={createParty}
            className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/30">
              <div>
                <h2 id="new-party-title" className="text-base sm:text-lg font-bold text-foreground">
                  New Party / Modify Ledger
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete ledger master with Drug License, GST, Stations, and Credit Controls
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground bg-secondary transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border bg-slate-950/40 px-3 overflow-x-auto gap-1 py-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0',
                  activeTab === 'general' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Building2 size={13} /> General &amp; Account
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('address')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0',
                  activeTab === 'address' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MapPin size={13} /> Address &amp; Contact
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('licenses')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0',
                  activeTab === 'licenses' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileCheck size={13} /> D.L. &amp; Statutory
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gst')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0',
                  activeTab === 'gst' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Percent size={13} /> GST &amp; Tax Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('credit')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0',
                  activeTab === 'credit' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <CreditCard size={13} /> Credit Controls
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Tab 1: General & Account */}
              {activeTab === 'general' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Ledger Name / Legal Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      placeholder="e.g. BORGANG MEDICAL HALL"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Station / Area / Town
                      </label>
                      <input
                        type="text"
                        value={formData.station}
                        onChange={(e) => handleFieldChange('station', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="e.g. BORGANG / BISWANATH"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Account Group *
                      </label>
                      <select
                        value={formData.accountGroup}
                        onChange={(e) => handleFieldChange('accountGroup', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-semibold"
                      >
                        <option value="SUNDRY DEBTORS">SUNDRY DEBTORS (Customer)</option>
                        <option value="SUNDRY CREDITORS">SUNDRY CREDITORS (Supplier)</option>
                        <option value="BOTH">BOTH (Customer &amp; Supplier)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Balancing Method
                      </label>
                      <select
                        value={formData.balancingMethod}
                        onChange={(e) => handleFieldChange('balancingMethod', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="On Account">On Account</option>
                        <option value="Bill by Bill">Bill by Bill</option>
                        <option value="FIFO">FIFO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Opening Balance (₹)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.openingBalance}
                          onChange={(e) => handleFieldChange('openingBalance', e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary text-right"
                          placeholder="0.00"
                        />
                        <select
                          value={formData.openingType}
                          onChange={(e) => handleFieldChange('openingType', e.target.value as 'Dr' | 'Cr')}
                          className="w-20 bg-card border border-border rounded-lg px-2 py-2 text-xs font-bold text-foreground outline-none focus:border-primary text-center"
                        >
                          <option value="Dr">Dr</option>
                          <option value="Cr">Cr</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Mail To (Mailing / Billing Name)
                    </label>
                    <input
                      type="text"
                      value={formData.mailTo}
                      onChange={(e) => handleFieldChange('mailTo', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      placeholder="e.g. BORGANG MEDICAL HALL"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Address & Contact */}
              {activeTab === 'address' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      placeholder="Street / Building / Area"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => handleFieldChange('addressLine2', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      placeholder="Landmark / Locality"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Pin Code
                      </label>
                      <input
                        type="text"
                        value={formData.pincode}
                        onChange={(e) => handleFieldChange('pincode', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                        placeholder="784167"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        City / Town
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleFieldChange('city', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="Biswanath"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        State
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => handleFieldChange('state', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        {GST_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => handleFieldChange('contactPerson', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Designation
                      </label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={(e) => handleFieldChange('designation', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="Owner / Manager / Pharmacist"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Mobile No. *
                      </label>
                      <input
                        type="text"
                        value={formData.mobile}
                        onChange={(e) => handleFieldChange('mobile', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                        placeholder="10-digit mobile"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Phone No. (Office)
                      </label>
                      <input
                        type="text"
                        value={formData.phoneOff}
                        onChange={(e) => handleFieldChange('phoneOff', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                        placeholder="03712-260654"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Phone No. (Res.)
                      </label>
                      <input
                        type="text"
                        value={formData.phoneRes}
                        onChange={(e) => handleFieldChange('phoneRes', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                        placeholder="Residence phone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        E-Mail Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="party@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Web Site
                      </label>
                      <input
                        type="text"
                        value={formData.website}
                        onChange={(e) => handleFieldChange('website', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Pharma & Statutory Licenses */}
              {activeTab === 'licenses' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs">
                    Drug License (D.L.) and FSSAI numbers are printed on invoices and checked during Schedule-H sales.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Drug License No. (D.L. No.)
                      </label>
                      <input
                        type="text"
                        value={formData.dlNo}
                        onChange={(e) => handleFieldChange('dlNo', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-foreground outline-none focus:border-primary uppercase"
                        placeholder="e.g. DNG/622/623 or STR-5018/5019"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        D.L. Expiry Date
                      </label>
                      <input
                        type="date"
                        value={formData.dlExp}
                        onChange={(e) => handleFieldChange('dlExp', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Food Licence No. (FSSAI)
                      </label>
                      <input
                        type="text"
                        value={formData.foodLicenceNo}
                        onChange={(e) => handleFieldChange('foodLicenceNo', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary uppercase"
                        placeholder="FSSAI registration number"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Food Licence Expiry Date
                      </label>
                      <input
                        type="date"
                        value={formData.foodLicenceExp}
                        onChange={(e) => handleFieldChange('foodLicenceExp', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Narco / Schedule-H Item Billing
                    </label>
                    <select
                      value={formData.narcoSchH}
                      onChange={(e) => handleFieldChange('narcoSchH', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-semibold"
                    >
                      <option value="Allow All">Allow All (Standard Pharma Billing)</option>
                      <option value="Restricted">Restricted (Require Valid Rx / Doctor Ref)</option>
                      <option value="Prohibit">Prohibit (Block Narcotic / Schedule-H items)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tab 4: GST & Tax Info */}
              {activeTab === 'gst' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      GSTIN (15-Digit GST Number)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.gstin}
                      onChange={(e) => handleFieldChange('gstin', e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm font-mono font-bold text-foreground outline-none focus:border-primary tracking-widest uppercase"
                      placeholder="e.g. 18AKWPP4417G1ZN"
                    />
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Auto-extracts State code (e.g. 18) and Income Tax PAN (e.g. AKWPP4417G).
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        I.T. PAN No.
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={formData.pan}
                        onChange={(e) => handleFieldChange('pan', e.target.value.toUpperCase())}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-foreground outline-none focus:border-primary uppercase tracking-wider"
                        placeholder="AKWPP4417G"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        GST Registration Type
                      </label>
                      <select
                        value={formData.ledgerType}
                        onChange={(e) => handleFieldChange('ledgerType', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-semibold"
                      >
                        <option value="REGISTERED">REGISTERED (Regular GST)</option>
                        <option value="UNREGISTERED">UNREGISTERED (Consumer / Local)</option>
                        <option value="COMPOSITION">COMPOSITION (Dealer)</option>
                        <option value="CONSUMER">CONSUMER</option>
                        <option value="OVERSEAS">OVERSEAS (Export / SEZ)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        GST Heading / Place of Supply
                      </label>
                      <select
                        value={formData.gstHeading}
                        onChange={(e) => handleFieldChange('gstHeading', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="Local">Local (Intra-state SGST + CGST)</option>
                        <option value="Central">Central / Interstate (IGST)</option>
                        <option value="Exempted">Exempted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        GST Registration Date
                      </label>
                      <input
                        type="date"
                        value={formData.gstinDate}
                        onChange={(e) => handleFieldChange('gstinDate', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Credit Controls */}
              {activeTab === 'credit' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Credit Limit (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={formData.creditLimit}
                        onChange={(e) => handleFieldChange('creditLimit', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary text-right"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Credit Days (Payment Term)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.creditDays}
                        onChange={(e) => handleFieldChange('creditDays', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary text-right"
                        placeholder="30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Ledger Category
                      </label>
                      <select
                        value={formData.ledgerCategory}
                        onChange={(e) => handleFieldChange('ledgerCategory', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      >
                        <option value="RETAILER">RETAILER (Chemist / Pharmacy)</option>
                        <option value="WHOLESALER">WHOLESALER / STOCKIST</option>
                        <option value="HOSPITAL">HOSPITAL / NURSING HOME</option>
                        <option value="DOCTOR">DOCTOR / CLINIC</option>
                        <option value="OTHERS">OTHERS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Freeze Upto Date (Stop Billing)
                      </label>
                      <input
                        type="date"
                        value={formData.freezeUpto}
                        onChange={(e) => handleFieldChange('freezeUpto', e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-secondary/20 border-t border-border flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                All fields are saved to Ledger &amp; Party Masters
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Check size={15} /> Save Party / Ledger
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
