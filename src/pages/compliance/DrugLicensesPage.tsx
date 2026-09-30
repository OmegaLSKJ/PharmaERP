import { useState, useEffect, useMemo } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  X,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Ban
} from 'lucide-react'
import { cn } from '../../lib/utils'
import PrintHeader from '../../components/layout/PrintHeader'
import PrintButton from '../../components/common/PrintButton'
import { useUIStore } from '../../store/uiStore'
import { getErp, postErp, patchErp, deleteErp } from '../../lib/erpApi'

export interface DrugLicenseItem {
  id: string
  party_id: string
  party_name: string
  party_code: string
  party_type: 'customer' | 'supplier' | 'both'
  party_phone?: string
  party_email?: string
  party_city?: string
  license_number: string
  license_type: string
  issued_on?: string | null
  expires_on: string
  issuing_authority?: string | null
  status: 'active' | 'expired' | 'suspended'
  document_url?: string | null
  isSourcePartyMaster?: boolean
}

export interface PartyOption {
  id: string
  code: string
  name: string
  type: string
  city?: string
  phone?: string
  dlNo?: string
  dlNumber?: string
  foodLicenceNo?: string
}

function calculateValidity(expiryStr?: string | null): {
  daysRemaining: number
  isExpired: boolean
  isExpiringSoon: boolean
  label: string
} {
  if (!expiryStr) {
    return { daysRemaining: 0, isExpired: false, isExpiringSoon: false, label: 'No date' }
  }
  const expDate = new Date(expiryStr)
  if (isNaN(expDate.getTime())) {
    return { daysRemaining: 0, isExpired: false, isExpiringSoon: false, label: expiryStr }
  }
  const now = new Date()
  const diffMs = expDate.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) {
    const pastDays = Math.abs(days)
    return {
      daysRemaining: days,
      isExpired: true,
      isExpiringSoon: false,
      label: `Expired ${pastDays} day${pastDays === 1 ? '' : 's'} ago`
    }
  }

  if (days <= 60) {
    return {
      daysRemaining: days,
      isExpired: false,
      isExpiringSoon: true,
      label: `Expires in ${days} day${days === 1 ? '' : 's'}`
    }
  }

  const months = Math.floor(days / 30)
  const years = (days / 365).toFixed(1)
  return {
    daysRemaining: days,
    isExpired: false,
    isExpiringSoon: false,
    label: Number(years) >= 1 ? `Valid (${years} yrs)` : `Valid (${months} mos)`
  }
}

function formatLicenseType(type: string): string {
  const norm = (type || '').toLowerCase().trim()
  if (norm === 'drug_license' || norm === 'drug' || norm === 'dl') return 'Drug License (20B / 21B)'
  if (norm === 'wholesale') return 'Wholesale Drug License'
  if (norm === 'retail') return 'Retail Drug License'
  if (norm === 'food_license' || norm === 'food' || norm === 'fssai') return 'FSSAI Food License'
  return type.replace(/_/g, ' ').toUpperCase()
}

export default function DrugLicensesPage() {
  const [licenses, setLicenses] = useState<DrugLicenseItem[]>([])
  const [partiesList, setPartiesList] = useState<PartyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'missing'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const addToast = useUIStore((s) => s.addToast)

  // Form states
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseType, setLicenseType] = useState('drug_license')
  const [issuedOn, setIssuedOn] = useState('')
  const [expiresOn, setExpiresOn] = useState('2030-12-31')
  const [issuingAuthority, setIssuingAuthority] = useState('Drugs Control Administration, Assam')
  const [status, setStatus] = useState<'active' | 'expired' | 'suspended'>('active')
  const [documentUrl, setDocumentUrl] = useState('')

  // Load licenses and parties
  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        const [licRes, partiesRes] = await Promise.allSettled([
          getErp<any[]>('drug-licenses'),
          getErp<any[]>('parties')
        ])

        const rawLicenses: any[] = licRes.status === 'fulfilled' ? licRes.value || [] : []
        const rawParties: any[] = partiesRes.status === 'fulfilled' ? partiesRes.value || [] : []

        if (!active) return

        const partiesLookup = new Map<string, PartyOption>()
        const cleanParties: PartyOption[] = rawParties.map((p: any) => {
          const item: PartyOption = {
            id: String(p.id),
            code: p.code || '',
            name: p.legal_name || p.name || 'Unnamed Party',
            type: p.party_type || p.type || 'customer',
            city: p.city || p.station || '',
            phone: p.phone || '',
            dlNo: p.dlNo || p.dlNumber || '',
            foodLicenceNo: p.foodLicenceNo || ''
          }
          partiesLookup.set(item.id, item)
          return item
        })
        setPartiesList(cleanParties)

        // Map DB drug_licenses
        const mappedLicenses: DrugLicenseItem[] = rawLicenses.map((row: any) => {
          const partyObj = partiesLookup.get(String(row.party_id))
          return {
            id: String(row.id),
            party_id: String(row.party_id),
            party_name: row.party_name && row.party_name !== '—' ? row.party_name : (partyObj?.name || 'Customer Chemist'),
            party_code: row.party_code && row.party_code !== '—' ? row.party_code : (partyObj?.code || ''),
            party_type: (row.party_type || partyObj?.type || 'customer') as 'customer' | 'supplier' | 'both',
            party_phone: row.party_phone || partyObj?.phone || '',
            party_city: partyObj?.city || '',
            license_number: row.license_number,
            license_type: row.license_type || 'drug_license',
            issued_on: row.issued_on || null,
            expires_on: row.expires_on || '2030-12-31',
            issuing_authority: row.issuing_authority || 'Drugs Control Administration, Assam',
            status: row.status || 'active',
            document_url: row.document_url || null,
            isSourcePartyMaster: false
          }
        })

        // Also check if any parties have dlNo entered in Party Master that are not in drug_licenses
        const registeredPartyIds = new Set(mappedLicenses.map((l) => l.party_id))
        const supplementalLicenses: DrugLicenseItem[] = []

        for (const p of cleanParties) {
          if (!registeredPartyIds.has(p.id) && (p.dlNo || p.foodLicenceNo)) {
            if (p.dlNo) {
              supplementalLicenses.push({
                id: `party-dl-${p.id}`,
                party_id: p.id,
                party_name: p.name,
                party_code: p.code,
                party_type: (p.type || 'customer') as any,
                party_phone: p.phone,
                party_city: p.city,
                license_number: p.dlNo,
                license_type: 'drug_license',
                issued_on: null,
                expires_on: '2028-12-31',
                issuing_authority: 'Drugs Control Administration, Assam',
                status: 'active',
                isSourcePartyMaster: true
              })
            }
            if (p.foodLicenceNo) {
              supplementalLicenses.push({
                id: `party-food-${p.id}`,
                party_id: p.id,
                party_name: p.name,
                party_code: p.code,
                party_type: (p.type || 'customer') as any,
                party_phone: p.phone,
                party_city: p.city,
                license_number: p.foodLicenceNo,
                license_type: 'food_license',
                issued_on: null,
                expires_on: '2028-12-31',
                issuing_authority: 'FSSAI Statutory Authority',
                status: 'active',
                isSourcePartyMaster: true
              })
            }
          }
        }

        setLicenses([...mappedLicenses, ...supplementalLicenses])
      } catch (err: any) {
        addToast(err?.message || 'Error loading drug licenses', 'error')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [addToast])

  // Categorize licenses
  const partiesWithLicenseIds = useMemo(() => new Set(licenses.map((l) => l.party_id)), [licenses])
  const partiesWithoutLicense = useMemo(() => {
    return partiesList.filter((p) => !partiesWithLicenseIds.has(p.id) && !p.dlNo)
  }, [partiesList, partiesWithLicenseIds])

  const categorized = useMemo(() => {
    return licenses.map((l) => {
      const validity = calculateValidity(l.expires_on)
      let calculatedStatus: 'active' | 'expiring' | 'expired' = 'active'
      if (validity.isExpired || l.status === 'expired') {
        calculatedStatus = 'expired'
      } else if (validity.isExpiringSoon) {
        calculatedStatus = 'expiring'
      }
      return {
        ...l,
        validity,
        calculatedStatus
      }
    })
  }, [licenses])

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim()
    return categorized.filter((row) => {
      const matchesTab =
        tab === 'all' ||
        (tab === 'valid' && row.calculatedStatus === 'active') ||
        (tab === 'expiring' && row.calculatedStatus === 'expiring') ||
        (tab === 'expired' && row.calculatedStatus === 'expired')

      const matchesSearch =
        !q ||
        row.party_name.toLowerCase().includes(q) ||
        row.party_code.toLowerCase().includes(q) ||
        row.license_number.toLowerCase().includes(q) ||
        (row.issuing_authority && row.issuing_authority.toLowerCase().includes(q)) ||
        (row.party_city && row.party_city.toLowerCase().includes(q))

      return matchesTab && matchesSearch
    })
  }, [categorized, tab, search])

  // Filtered missing parties
  const filteredMissingParties = useMemo(() => {
    const q = search.toLowerCase().trim()
    return partiesWithoutLicense.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q))
    )
  }, [partiesWithoutLicense, search])

  // KPI Metrics
  const activeCount = categorized.filter((l) => l.calculatedStatus === 'active').length
  const expiringCount = categorized.filter((l) => l.calculatedStatus === 'expiring').length
  const expiredCount = categorized.filter((l) => l.calculatedStatus === 'expired').length

  // Open modal for new license
  const handleOpenNew = (partyId?: string) => {
    setEditingId(null)
    setSelectedPartyId(partyId || partiesList[0]?.id || '')
    setLicenseNumber('')
    setLicenseType('drug_license')
    setIssuedOn('')
    setExpiresOn('2030-12-31')
    setIssuingAuthority('Drugs Control Administration, Assam')
    setStatus('active')
    setDocumentUrl('')
    setShowModal(true)
  }

  // Open modal for editing
  const handleOpenEdit = (item: DrugLicenseItem) => {
    setEditingId(item.id)
    setSelectedPartyId(item.party_id)
    setLicenseNumber(item.license_number)
    setLicenseType(item.license_type || 'drug_license')
    setIssuedOn(item.issued_on ? item.issued_on.slice(0, 10) : '')
    setExpiresOn(item.expires_on ? item.expires_on.slice(0, 10) : '2030-12-31')
    setIssuingAuthority(item.issuing_authority || 'Drugs Control Administration, Assam')
    setStatus(item.status || 'active')
    setDocumentUrl(item.document_url || '')
    setShowModal(true)
  }

  // Save license
  const handleSave = async () => {
    if (!selectedPartyId) {
      addToast('Please select a customer or supplier party', 'error')
      return
    }
    if (!licenseNumber.trim()) {
      addToast('Please enter the Drug License Number (e.g. STR-4197/4198)', 'error')
      return
    }
    if (!expiresOn) {
      addToast('Please enter a valid license expiry date', 'error')
      return
    }

    setSaving(true)
    try {
      const selectedParty = partiesList.find((p) => p.id === selectedPartyId)
      const payload = {
        party_id: selectedPartyId,
        license_number: licenseNumber.trim().toUpperCase(),
        license_type: licenseType,
        issued_on: issuedOn || null,
        expires_on: expiresOn,
        issuing_authority: issuingAuthority.trim() || 'Drugs Control Administration, Assam',
        status,
        document_url: documentUrl.trim() || null
      }

      if (editingId && !editingId.startsWith('party-dl-') && !editingId.startsWith('party-food-')) {
        const updated = await patchErp<any>('drug-licenses', editingId, payload)
        setLicenses((curr) =>
          curr.map((l) =>
            l.id === editingId
              ? {
                  ...l,
                  ...payload,
                  party_name: selectedParty?.name || l.party_name,
                  party_code: selectedParty?.code || l.party_code,
                  id: String(updated.id || editingId)
                }
              : l
          )
        )
        addToast(`Updated drug license for ${selectedParty?.name || 'party'} successfully`, 'success')
      } else {
        const saved = await postErp<any>('drug-licenses', payload)
        const newRecord: DrugLicenseItem = {
          id: String(saved.id || `dl-${Date.now()}`),
          party_id: selectedPartyId,
          party_name: selectedParty?.name || 'Customer Chemist',
          party_code: selectedParty?.code || '',
          party_type: (selectedParty?.type || 'customer') as any,
          party_phone: selectedParty?.phone || '',
          party_city: selectedParty?.city || '',
          license_number: payload.license_number,
          license_type: payload.license_type,
          issued_on: payload.issued_on,
          expires_on: payload.expires_on,
          issuing_authority: payload.issuing_authority,
          status: payload.status,
          document_url: payload.document_url,
          isSourcePartyMaster: false
        }
        setLicenses((curr) => [
          newRecord,
          ...curr.filter((c) => c.id !== editingId && c.id !== `party-dl-${selectedPartyId}`)
        ])
        addToast(`Registered drug license ${payload.license_number} for ${selectedParty?.name} successfully`, 'success')
      }

      setShowModal(false)
    } catch (err: any) {
      addToast(err?.message || 'Could not save drug license record', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delete license
  const handleDelete = async (item: DrugLicenseItem) => {
    if (!window.confirm(`Delete drug license ${item.license_number} for ${item.party_name}?`)) return
    try {
      if (!item.id.startsWith('party-dl-') && !item.id.startsWith('party-food-')) {
        await deleteErp('drug-licenses', item.id)
      }
      setLicenses((curr) => curr.filter((l) => l.id !== item.id))
      addToast(`Removed license ${item.license_number}`, 'success')
    } catch (err: any) {
      addToast(err?.message || 'Could not delete license', 'error')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <PrintHeader
        title="Statutory Drug License Register"
        subtitle="Party drug licences, validity periods, state authorities, and regulatory compliance"
      />

      {/* Screen Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
            Drug Licenses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Maintain chemist &amp; party drug sales licences, authority jurisdictions, and mandatory renewal tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton label="Export PDF" autoOrientationHint="landscape" className="no-print" />
          <button
            onClick={() =>
              import('../../lib/download').then(({ exportVisibleTables }) =>
                exportVisibleTables('drug-licenses-register', useUIStore.getState().company)
              )
            }
            className="flex items-center gap-2 h-9 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition border border-border cursor-pointer"
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={() => handleOpenNew()}
            className="flex items-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-md transition border border-indigo-500/30 cursor-pointer"
          >
            <Plus size={16} /> New Drug License
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-between">
            <span>Total Registered</span>
            <FileText size={14} className="text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono mt-1">{licenses.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Statutory licenses tracked</div>
        </div>

        <div className="bg-card border border-emerald-500/20 rounded-xl p-4 shadow-sm bg-emerald-500/5">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold flex items-center justify-between">
            <span>Active &amp; Compliant</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {activeCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Eligible for sales billing</div>
        </div>

        <div className="bg-card border border-amber-500/20 rounded-xl p-4 shadow-sm bg-amber-500/5">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold flex items-center justify-between">
            <span>Expiring Soon (&lt;60d)</span>
            <AlertTriangle size={14} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
            {expiringCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Renewal notice required</div>
        </div>

        <div className="bg-card border border-rose-500/20 rounded-xl p-4 shadow-sm bg-rose-500/5">
          <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold flex items-center justify-between">
            <span>Expired / Blocked</span>
            <Ban size={14} className="text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
            {expiredCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Billing must be withheld</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit shadow-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setTab('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All Licenses ({licenses.length})
          </button>
          <button
            onClick={() => setTab('valid')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === 'valid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Valid ({activeCount})
          </button>
          <button
            onClick={() => setTab('expiring')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === 'expiring'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Expiring Soon ({expiringCount})
          </button>
          <button
            onClick={() => setTab('expired')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === 'expired'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Expired ({expiredCount})
          </button>
          <button
            onClick={() => setTab('missing')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap',
              tab === 'missing'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Missing Licenses ({partiesWithoutLicense.length})
          </button>
        </div>

        <div className="relative max-w-sm w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chemist, license no, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs outline-none focus:border-indigo-600 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Main Table Content */}
      {tab === 'missing' ? (
        /* Missing Licenses Table */
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                <th className="text-left px-4 py-3">Party Name</th>
                <th className="text-left px-3 py-3 w-28">Party Code</th>
                <th className="text-left px-3 py-3 w-28">Type</th>
                <th className="text-left px-3 py-3 w-40">City / Station</th>
                <th className="text-left px-3 py-3 w-36">Phone</th>
                <th className="text-left px-3 py-3 w-36">Compliance Status</th>
                <th className="text-right px-4 py-3 w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filteredMissingParties.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                    <Building2 size={14} className="text-muted-foreground shrink-0" />
                    <span>{p.name}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">{p.code || '—'}</td>
                  <td className="px-3 py-3 capitalize">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium">
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{p.city || '—'}</td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">{p.phone || '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      ⚠️ No DL on file
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenNew(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus size={12} /> Add License
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMissingParties.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    All registered customer and supplier parties currently have drug licenses on file!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {search ? 'No matching drug licenses found' : 'No Drug Licenses Found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {search
                ? `No licences match "${search}". Try resetting your search filters.`
                : 'Click "New Drug License" to register a drug license for your customer chemists and suppliers.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => handleOpenNew()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus size={14} /> New Drug License
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[920px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                <th className="text-left px-4 py-3 min-w-[220px]">Customer / Chemist Party</th>
                <th className="text-left px-3 py-3 w-40">License Number</th>
                <th className="text-left px-3 py-3 w-44">License Type</th>
                <th className="text-left px-3 py-3 w-36">Validity Status</th>
                <th className="text-left px-3 py-3 w-28">Expires On</th>
                <th className="text-left px-3 py-3 w-28">Issued On</th>
                <th className="text-left px-4 py-3 min-w-[200px]">Issuing Authority</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-indigo-500 shrink-0" />
                      <div>
                        <div className="font-bold text-foreground">{r.party_name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
                          {r.party_code && (
                            <span className="font-mono bg-secondary px-1.5 py-0.2 rounded text-[10px]">
                              {r.party_code}
                            </span>
                          )}
                          <span className="capitalize">{r.party_type}</span>
                          {r.party_city && <span>• {r.party_city}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-foreground text-sm">
                    {r.license_number}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-foreground">
                      {formatLicenseType(r.license_type)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs',
                        r.calculatedStatus === 'expired'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : r.calculatedStatus === 'expiring'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      )}
                    >
                      {r.calculatedStatus === 'expired' ? (
                        <Ban size={11} />
                      ) : r.calculatedStatus === 'expiring' ? (
                        <AlertTriangle size={11} />
                      ) : (
                        <CheckCircle2 size={11} />
                      )}
                      {r.validity.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-foreground font-medium">
                    {r.expires_on ? r.expires_on.slice(0, 10) : '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">
                    {r.issued_on ? r.issued_on.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="text-xs text-foreground font-medium truncate max-w-[240px]">
                      {r.issuing_authority || 'Drugs Control Administration, Assam'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 transition cursor-pointer"
                        title="Edit license details"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => void handleDelete(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer"
                        title="Delete license record"
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
      )}

      {/* Add / Edit License Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto no-print"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border w-full max-w-xl rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-lg">
                  <Shield size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {editingId ? 'Edit Drug License' : 'Register New Drug License'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Assign statutory drug sale licence and validity to a party
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-3 text-xs">
              {/* Party Select */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Customer / Supplier Party *
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground font-medium outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Party --</option>
                  {partiesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code || 'PTY'}) - {p.type} {p.city ? `• ${p.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* License Number & Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    License Number *
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. STR-4197/4198 or DL-20B-892"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground font-bold outline-none focus:border-indigo-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    License Category *
                  </label>
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-indigo-600"
                  >
                    <option value="drug_license">Drug License (Form 20B / 21B)</option>
                    <option value="wholesale">Wholesale Drug License</option>
                    <option value="retail">Retail Drug License</option>
                    <option value="food_license">FSSAI Food License</option>
                  </select>
                </div>
              </div>

              {/* Issued On & Expires On */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Issued Date
                  </label>
                  <input
                    type="date"
                    value={issuedOn}
                    onChange={(e) => setIssuedOn(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 font-mono text-foreground font-bold outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Issuing Authority */}
              <div>
                <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                  Issuing Authority / State Department
                </label>
                <input
                  type="text"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  placeholder="e.g. Drugs Control Administration, Assam"
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-foreground outline-none focus:border-indigo-600"
                />
              </div>

              {/* Status & Document Link */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    License Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-indigo-600"
                  >
                    <option value="active">Active &amp; Valid</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended / Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                    Document / Certificate URL
                  </label>
                  <input
                    type="text"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="https://... or certificate ref"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingId ? 'Update License' : 'Register License'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
