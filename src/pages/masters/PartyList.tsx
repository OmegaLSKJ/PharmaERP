import { FormEvent, useEffect, useState, useMemo, startTransition } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Edit2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn, formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../store/uiStore'
import { getErp, patchErp, postErp, deleteErp } from '../../lib/erpApi'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const urlType = searchParams.get('type')?.toLowerCase()
  const initialType: 'all' | 'customer' | 'supplier' =
    urlType === 'customer' || urlType === 'supplier' ? urlType : 'all'

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>(initialType)
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'address' | 'licenses' | 'gst' | 'credit'>('general')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)

  // Keep typeFilter in sync when URL changes (e.g. clicking sidebar Customers or Suppliers)
  useEffect(() => {
    const nextType = searchParams.get('type')?.toLowerCase()
    if (nextType === 'customer' || nextType === 'supplier') {
      setTypeFilter(nextType)
    } else {
      setTypeFilter('all')
    }
  }, [searchParams])

  // Chunking and pagination controls
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [continuousCount, setContinuousCount] = useState<number>(50)
  const [chunkMode, setChunkMode] = useState<'paginated' | 'continuous'>('paginated')
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleTypeFilterChange = (newType: 'all' | 'customer' | 'supplier') => {
    startTransition(() => {
      setTypeFilter(newType)
      setCurrentPage(1)
      setContinuousCount(pageSize || 50)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (newType === 'all') {
          next.delete('type')
        } else {
          next.set('type', newType)
        }
        return next
      })
    })
  }

  // Form states matching TAO Solutions Pvt Ltd Ledger specification
  const [formData, setFormData] = useState({
    name: '',
    type: 'both' as 'customer' | 'supplier' | 'both',
    station: '',
    accountGroup: 'BOTH',
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
    let localSaved: Party[] = []
    try {
      const raw = localStorage.getItem('pharma_erp_custom_parties')
      if (raw) localSaved = JSON.parse(raw)
    } catch {}

    getErp<Party[]>('parties')
      .then((serverParties) => {
        const partyMap = new Map<string, Party>()
        // Server parties take precedence for canonical ID, but localSaved fields enrich missing metadata
        const combined = [...(serverParties || []), ...(localSaved || [])]

        for (const p of combined) {
          const key = (p.name || '').trim().toLowerCase()
          if (!key) continue
          if (!partyMap.has(key)) {
            partyMap.set(key, { ...p })
          } else {
            const existing = partyMap.get(key)!
            if ((!existing.phone || existing.phone === '-') && p.phone && p.phone !== '-') existing.phone = p.phone
            if ((!existing.city || existing.city === '-') && p.city && p.city !== '-') existing.city = p.city
            if ((!existing.station || existing.station === '-') && p.station && p.station !== '-') existing.station = p.station
            if (!existing.gstin && p.gstin) existing.gstin = p.gstin
            if (!existing.dlNo && (p.dlNo || p.dlNumber)) existing.dlNo = p.dlNo || p.dlNumber
            if (p.type === 'both') existing.type = 'both'
          }
        }

        const uniqueParties = Array.from(partyMap.values())
        setParties(uniqueParties)

        // Save clean deduplicated list back to local storage
        try {
          localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(uniqueParties))
        } catch {}
      })
      .catch((error) => {
        if (localSaved.length > 0) {
          const partyMap = new Map<string, Party>()
          for (const p of localSaved) {
            const key = (p.name || '').trim().toLowerCase()
            if (key && !partyMap.has(key)) partyMap.set(key, p)
          }
          setParties(Array.from(partyMap.values()))
        }
        showToast(error instanceof Error ? error.message : 'Could not load parties.')
      })
      .finally(() => setLoading(false))
  }, [showToast])

  const purgeDuplicates = async () => {
    try {
      const partyMap = new Map<string, Party>()
      let count = 0
      for (const p of parties) {
        const key = (p.name || '').trim().toLowerCase()
        if (!key) continue
        if (!partyMap.has(key)) {
          partyMap.set(key, { ...p })
        } else {
          count++
          const existing = partyMap.get(key)!
          if ((!existing.phone || existing.phone === '-') && p.phone && p.phone !== '-') existing.phone = p.phone
          if ((!existing.city || existing.city === '-') && p.city && p.city !== '-') existing.city = p.city
          if ((!existing.station || existing.station === '-') && p.station && p.station !== '-') existing.station = p.station
          if (!existing.gstin && p.gstin) existing.gstin = p.gstin
          if (!existing.dlNo && (p.dlNo || p.dlNumber)) existing.dlNo = p.dlNo || p.dlNumber
          if (p.type === 'both') existing.type = 'both'
        }
      }

      try {
        await deleteErp('parties', 'purge-duplicates')
      } catch {}

      const cleanList = Array.from(partyMap.values())
      setParties(cleanList)
      localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(cleanList))
      showToast(count > 0 ? `Deleted ${count} duplicate parties. 1 canonical copy kept.` : 'No duplicate parties found. All records are unique.')
    } catch (err: any) {
      showToast(err?.message || 'Failed to purge duplicate parties.')
    }
  }

  const handleDeleteSingle = async (party: Party) => {
    try {
      setIsDeleting(true)
      try {
        await deleteErp('parties', party.id)
      } catch (err) {
        console.warn('Backend party delete:', err)
      }
      const updated = parties.filter((p) => p.id !== party.id)
      setParties(updated)
      try {
        localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(updated))
      } catch {}
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(party.id)
        return next
      })
      showToast(`Party ledger "${party.name}" deleted successfully.`)
      setPartyToDelete(null)
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete party ledger.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    try {
      setIsDeleting(true)
      try {
        await deleteErp('parties', 'purge-all')
      } catch (err) {
        console.warn('Backend purge-all error:', err)
      }
      setParties([])
      try {
        localStorage.removeItem('pharma_erp_custom_parties')
      } catch {}
      setSelectedIds(new Set())
      showToast('All party ledgers deleted successfully.')
      setShowDeleteAllConfirm(false)
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete all party ledgers.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    try {
      setIsDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      for (const id of idsToDelete) {
        try {
          await deleteErp('parties', id)
        } catch {}
      }
      const updated = parties.filter((p) => !selectedIds.has(p.id))
      setParties(updated)
      try {
        localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(updated))
      } catch {}
      showToast(`${idsToDelete.length} party ledgers deleted successfully.`)
      setSelectedIds(new Set())
      setShowDeleteSelectedConfirm(false)
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete selected party ledgers.')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedParties.length && displayedParties.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayedParties.map((p) => p.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase().trim()
    return parties.filter((p) => {
      const matchSearch =
        !s ||
        (p?.name || '').toLowerCase().includes(s) ||
        (p?.id || '').toLowerCase().includes(s) ||
        (p?.gstin || '').toLowerCase().includes(s) ||
        (p?.dlNo || p?.dlNumber || '').toLowerCase().includes(s) ||
        (p?.phone || '').includes(s)

      const isCustomer =
        p?.type === 'customer' ||
        p?.type === 'both' ||
        !p?.type ||
        (p?.accountGroup || '').toLowerCase().includes('debtor') ||
        (p?.accountGroup || '').toLowerCase().includes('both')
      const isSupplier =
        p?.type === 'supplier' ||
        p?.type === 'both' ||
        !p?.type ||
        (p?.accountGroup || '').toLowerCase().includes('creditor') ||
        (p?.accountGroup || '').toLowerCase().includes('both')

      const matchType =
        typeFilter === 'all' ||
        (typeFilter === 'customer' && isCustomer) ||
        (typeFilter === 'supplier' && isSupplier)

      return matchSearch && matchType
    })
  }, [parties, search, typeFilter])

  // Reset pagination index on search/pageSize/typeFilter changes
  useEffect(() => {
    setCurrentPage(1)
    setContinuousCount(pageSize || 50)
  }, [search, pageSize, typeFilter])

  const totalItems = filtered.length
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / (pageSize || 50)) || 1

  const displayedParties = useMemo(() => {
    if (pageSize === 0) return filtered
    if (chunkMode === 'continuous') {
      return filtered.slice(0, continuousCount)
    }
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, chunkMode, currentPage, pageSize, continuousCount])

  const startIdx = totalItems === 0 ? 0 : pageSize === 0 ? 1 : chunkMode === 'continuous' ? 1 : (currentPage - 1) * pageSize + 1
  const endIdx =
    pageSize === 0
      ? totalItems
      : chunkMode === 'continuous'
      ? Math.min(continuousCount, totalItems)
      : Math.min(currentPage * pageSize, totalItems)

  const handleLoadMore = () => {
    setContinuousCount((prev) => Math.min(prev + (pageSize || 50), totalItems))
  }

  // Auto-sync Mail To with Name, and auto-sync Account Group with Type
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'name' && (!prev.mailTo || prev.mailTo === prev.name)) {
        next.mailTo = value
      }

      if (field === 'type') {
        next.type = value as 'customer' | 'supplier' | 'both'
        if (value === 'supplier') {
          next.accountGroup = 'SUNDRY CREDITORS'
        } else if (value === 'customer') {
          next.accountGroup = 'SUNDRY DEBTORS'
        } else {
          next.accountGroup = 'BOTH'
        }
      }

      if (field === 'accountGroup') {
        next.accountGroup = value
        next.type = 'both'
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

  const openEditParty = (party: Party) => {
    setEditingPartyId(party.id)
    setFormData({
      name: party.name || '',
      type: party.type || 'both',
      station: party.station || party.city || '',
      accountGroup: party.accountGroup || 'BOTH',
      balancingMethod: party.balancingMethod || 'On Account',
      openingBalance: party.openingBalance ? String(party.openingBalance) : '0.00',
      openingType: party.openingType || 'Dr',
      mailTo: party.mailTo || party.name || '',
      address: party.address || '',
      addressLine2: party.addressLine2 || '',
      pincode: party.pincode || '',
      city: party.city || '',
      state: party.state || '18-ASSAM',
      country: party.country || 'INDIA',
      contactPerson: party.contactPerson || '',
      designation: party.designation || '',
      phone: party.phone || '',
      mobile: party.mobile || party.phone || '',
      phoneOff: party.phoneOff || '',
      phoneRes: party.phoneRes || '',
      fax: party.fax || '',
      email: party.email || '',
      website: party.website || '',
      freezeUpto: party.freezeUpto || '',
      narcoSchH: party.narcoSchH || 'Allow All',
      dlNo: party.dlNo || party.dlNumber || '',
      dlExp: party.dlExp || '',
      gstHeading: party.gstHeading || 'Local',
      gstin: party.gstin || '',
      gstinDate: party.gstinDate || '',
      foodLicenceNo: party.foodLicenceNo || '',
      foodLicenceExp: party.foodLicenceExp || '',
      pan: party.pan || '',
      ledgerCategory: party.ledgerCategory || 'OTHERS',
      ledgerType: party.ledgerType || 'REGISTERED',
      creditLimit: party.creditLimit ? String(party.creditLimit) : '0',
      creditDays: party.creditDays ? String(party.creditDays) : '30',
    })
    setActiveTab('general')
    setShowCreate(true)
    setActiveMenu(null)
  }

  const resetForm = () => {
    setEditingPartyId(null)
    setFormData({
      name: '',
      type: 'both',
      station: '',
      accountGroup: 'BOTH',
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
        type: formData.type || 'both', // Dual role so DB shows them in customers as well as suppliers section
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

      if (editingPartyId) {
        // EDIT EXISTING PARTY
        const updated = await patchErp<Party>('parties', editingPartyId, payload)
        const existing = parties.find((p) => p.id === editingPartyId)
        const mergedParty: Party = {
          ...(existing as Party),
          ...payload,
          ...(updated || {})
        }

        // Update localStorage custom parties
        try {
          const raw = localStorage.getItem('pharma_erp_custom_parties')
          const currentLocal = raw ? JSON.parse(raw) : []
          const updatedLocal = currentLocal.map((p: any) =>
            (p.id === editingPartyId || (p.name && p.name.toLowerCase() === mergedParty.name.toLowerCase())) ? mergedParty : p
          )
          if (!updatedLocal.some((p: any) => p.id === editingPartyId)) {
            updatedLocal.unshift(mergedParty)
          }
          localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(updatedLocal))
        } catch (err) {
          console.warn('Could not update custom party in localStorage:', err)
        }

        setParties((current) => current.map((p) => (p.id === editingPartyId ? mergedParty : p)))
        setShowCreate(false)
        resetForm()
        showToast(`${mergedParty.name} details updated successfully.`)
      } else {
        // CREATE NEW PARTY
        const created = await postErp<Party>('parties', payload)
        // Save locally to localStorage so it permanently persists across browser refresh
        try {
          const raw = localStorage.getItem('pharma_erp_custom_parties')
          const currentLocal = raw ? JSON.parse(raw) : []
          const updatedLocal = [created, ...currentLocal.filter((p: any) => p.id !== created.id && p.name.toLowerCase() !== created.name.toLowerCase())]
          localStorage.setItem('pharma_erp_custom_parties', JSON.stringify(updatedLocal))
        } catch (err) {
          console.warn('Could not save custom party to localStorage:', err)
        }
        setParties((current) => [created, ...current.filter((p) => p.id !== created.id)])
        setShowCreate(false)
        resetForm()
        showToast(`${created.name} was added to Party Master.`)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save party.')
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

      {/* Filters & Chunk Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 w-full sm:max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, ID, GSTIN, D.L. No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto">
          <div className="flex rounded-md border border-input overflow-hidden text-xs">
            {(['all', 'customer', 'supplier'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeFilterChange(t)}
                className={cn(
                  'px-3 py-1.5 text-xs capitalize transition-colors font-medium',
                  typeFilter === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {t === 'all' ? `All (${parties.length})` : t === 'customer' ? 'Customers' : 'Suppliers'}
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center bg-background p-0.5 rounded-md border border-input text-xs">
            <button
              type="button"
              onClick={() => setChunkMode('paginated')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition text-xs',
                chunkMode === 'paginated'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pages
            </button>
            <button
              type="button"
              onClick={() => setChunkMode('continuous')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition flex items-center gap-1 text-xs',
                chunkMode === 'continuous'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers size={11} /> Continuous
            </button>
          </div>

          {/* Chunk Selector */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-background border border-input text-foreground rounded px-2 py-1 text-xs outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={purgeDuplicates}
            title="Delete duplicate customer/supplier entries and keep only one copy"
            className="h-8 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 border-amber-800/40 flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Delete Duplicates
          </Button>

          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteSelectedConfirm(true)}
              title="Delete selected party ledgers"
              className="h-8 text-xs flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white"
            >
              <Trash2 size={13} /> Delete Selected ({selectedIds.size})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAllConfirm(true)}
            title="Delete all party ledgers from the master"
            className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border-rose-800/40 flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Delete All
          </Button>

          <Button variant="outline" size="icon" aria-label="Export filtered parties" onClick={exportParties} className="h-8 w-8">
            <Download size={14} />
          </Button>
        </div>
      </div>

      {/* Chunk Info Strip */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div>
          Showing <span className="font-semibold text-foreground">{startIdx}</span> to{' '}
          <span className="font-semibold text-foreground">{endIdx}</span> of{' '}
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> parties
        </div>

        {chunkMode === 'paginated' && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded bg-background border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-background border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono text-foreground font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-background border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded bg-background border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-surface rounded-lg overflow-hidden border border-border">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading parties…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1020px]">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase text-[11px]">
                <th className="px-3 py-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={displayedParties.length > 0 && selectedIds.size === displayedParties.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Select all on this page"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Ledger Name</th>
                <th className="text-left px-4 py-3 font-medium">Group / Type</th>
                <th className="text-left px-4 py-3 font-medium">Station / City</th>
                <th className="text-left px-4 py-3 font-medium">D.L. No.</th>
                <th className="text-left px-4 py-3 font-medium">GSTIN &amp; PAN</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
                <th className="text-right px-4 py-3 font-medium">Credit Limit</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedParties.map((p) => (
                <tr key={p.id} className={cn("table-row-hover", selectedIds.has(p.id) && "bg-indigo-950/20")}>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelectOne(p.id)}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
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
                        p.type === 'both' || p.accountGroup === 'BOTH'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : p.type === 'supplier' || (p.accountGroup || '').toLowerCase().includes('creditor')
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      )}
                    >
                      {p.accountGroup === 'BOTH'
                        ? 'CUSTOMER & SUPPLIER'
                        : p.accountGroup ||
                          (p.type === 'both'
                            ? 'CUSTOMER & SUPPLIER'
                            : p.type === 'supplier'
                            ? 'SUNDRY CREDITORS'
                            : 'SUNDRY DEBTORS')}
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
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={`Edit details for ${p.name}`}
                        aria-label={`Edit ${p.name}`}
                        className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40"
                        onClick={() => openEditParty(p)}
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={`Delete ${p.name}`}
                        aria-label={`Delete ${p.name}`}
                        className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                        onClick={() => setPartyToDelete(p)}
                      >
                        <Trash2 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${p.name}`}
                        className="relative h-7 w-7"
                        onClick={() => setActiveMenu(activeMenu === p.id ? null : p.id)}
                      >
                        <MoreHorizontal size={14} />
                      </Button>
                    </div>
                    {activeMenu === p.id && (
                      <div className="glass-surface absolute right-6 z-20 mt-1 w-44 rounded-lg p-1 text-left border border-border shadow-xl">
                        <button
                          type="button"
                          onClick={() => openEditParty(p)}
                          className="w-full flex items-center gap-2 rounded px-3 py-1.5 text-xs text-foreground hover:bg-secondary font-medium text-indigo-300"
                        >
                          <Edit2 size={12} /> Edit Party Details
                        </button>
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
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenu(null)
                            setPartyToDelete(p)
                          }}
                          className="w-full flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-950/30 font-medium"
                        >
                          <Trash2 size={12} /> Delete Party Ledger
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load more button for continuous scrolling */}
        {chunkMode === 'continuous' && continuousCount < totalItems && (
          <div className="p-3 flex justify-center border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={handleLoadMore}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-background hover:bg-muted text-primary text-xs font-semibold rounded-lg border border-border transition shadow-xs cursor-pointer"
            >
              Load More Parties ({Math.min(pageSize || 50, totalItems - continuousCount)} more)
            </button>
          </div>
        )}
      </div>

      {/* Comprehensive New Party / Modify Ledger Modal (Matching TAO Solutions Pvt Ltd Ledger Spec) */}
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
                  {editingPartyId ? `Edit Party: ${formData.name || 'Customer / Supplier'}` : 'New Party / Create Ledger'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingPartyId ? 'Modify customer or supplier master details, Drug License, GST, Address, and Credit Controls' : 'Complete ledger master with Drug License, GST, Stations, and Credit Controls'}
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

                  {/* Party Classification / Dual Role Selector */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-primary">
                        Party Classification / Role *
                      </label>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                        Dual Role (Customers &amp; Suppliers)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange('type', 'both')
                          handleFieldChange('accountGroup', 'BOTH')
                        }}
                        className={cn(
                          'px-3 py-2 rounded-lg text-xs font-semibold border transition text-left flex flex-col gap-0.5 cursor-pointer',
                          formData.accountGroup === 'BOTH'
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                        )}
                      >
                        <span className="font-bold flex items-center gap-1.5">
                          <span>🔄</span> Both (Customer &amp; Supplier)
                        </span>
                        <span className="text-[10px] opacity-80">Visible in Customers &amp; Suppliers</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange('type', 'both')
                          handleFieldChange('accountGroup', 'SUNDRY DEBTORS')
                        }}
                        className={cn(
                          'px-3 py-2 rounded-lg text-xs font-semibold border transition text-left flex flex-col gap-0.5 cursor-pointer',
                          formData.accountGroup.includes('DEBTOR')
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                        )}
                      >
                        <span className="font-bold flex items-center gap-1.5">
                          <span>👥</span> Customer (Dual Role)
                        </span>
                        <span className="text-[10px] opacity-80">Also available as Supplier in DB</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange('type', 'both')
                          handleFieldChange('accountGroup', 'SUNDRY CREDITORS')
                        }}
                        className={cn(
                          'px-3 py-2 rounded-lg text-xs font-semibold border transition text-left flex flex-col gap-0.5 cursor-pointer',
                          formData.accountGroup.includes('CREDITOR')
                            ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                        )}
                      >
                        <span className="font-bold flex items-center gap-1.5">
                          <span>🏢</span> Supplier (Dual Role)
                        </span>
                        <span className="text-[10px] opacity-80">Also available as Customer in DB</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      &bull; In All Parties, all added parties are registered in the DB with dual eligibility so they automatically appear in both the <strong>Customers</strong> section and the <strong>Suppliers</strong> section.
                    </p>
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
                        <optgroup label="Customers / Debtors">
                          <option value="SUNDRY DEBTORS">SUNDRY DEBTORS (General Customer)</option>
                          <option value="SUNDRY DEBTORS (E-COMMERCE)">SUNDRY DEBTORS (E-Commerce)</option>
                          <option value="SUNDRY DEBTORS (FIELD STAFF)">SUNDRY DEBTORS (Field Staff)</option>
                        </optgroup>
                        <optgroup label="Suppliers / Creditors">
                          <option value="SUNDRY CREDITORS">SUNDRY CREDITORS (General Supplier)</option>
                          <option value="SUNDRY CREDITORS (SUPPLIERS)">SUNDRY CREDITORS (Suppliers &amp; Stockists)</option>
                          <option value="SUNDRY CREDITORS (MANUFACTURERS)">SUNDRY CREDITORS (Manufacturers)</option>
                          <option value="SUNDRY CREDITORS (EXPENSES PAYABLE)">SUNDRY CREDITORS (Expenses Payable)</option>
                          <option value="SUNDRY CREDITORS (FIELD STAFF)">SUNDRY CREDITORS (Field Staff)</option>
                          <option value="SUNDRY CREDITORS (E-COMMERCE)">SUNDRY CREDITORS (E-Commerce)</option>
                        </optgroup>
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
                  <Check size={15} /> {editingPartyId ? 'Update Party Details' : 'Save Party / Ledger'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Party */}
      {partyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete Party Ledger</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{partyToDelete.name}</strong>? All associated addresses and party ledger mappings will be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPartyToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteSingle(partyToDelete)}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Ledger'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Parties */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-card border border-rose-900/60 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete All Party Ledgers</h3>
                <p className="text-xs text-rose-400 font-medium">Permanent Bulk Deletion</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-rose-400 font-bold">all {parties.length} party ledgers</strong>? This will permanently clear all customer and supplier records from your party master.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isDeleting ? 'Deleting All...' : 'Yes, Delete All Ledgers'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Selected Parties */}
      {showDeleteSelectedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete Selected Ledgers</h3>
                <p className="text-xs text-muted-foreground">{selectedIds.size} parties selected</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the <strong className="text-foreground">{selectedIds.size} selected party ledgers</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteSelectedConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Ledgers`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
