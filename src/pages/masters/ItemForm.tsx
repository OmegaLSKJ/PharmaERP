import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Plus, X, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { formatCurrency } from '../../lib/utils'
import { getGstRateForHsn, getAllHsnCodes, registerHsnCodesFromDb, HsnMasterEntry } from '../../lib/hsnUtils'

type FormState = { code: string; name: string; packing: string; unit: string; manufacturer: string; salt: string; hsn: string; gstRate: number; stock: number; mrp: number; saleRate: number; purchaseRate: number; status: 'active' | 'banned'; scheduleClass:'OTC'|'H'|'H1'|'X'|'NDPS'; prescriptionRequired:boolean; coldChain:boolean; controlledSubstance:boolean; recalled:boolean }
const EMPTY: FormState = { code: '', name: '', packing: '', unit: '', manufacturer: '', salt: '', hsn: '', gstRate: 5, stock: 0, mrp: 0, saleRate: 0, purchaseRate: 0, status: 'active', scheduleClass:'OTC', prescriptionRequired:false, coldChain:false, controlledSubstance:false, recalled:false }

export default function ItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [salts, setSalts] = useState<string[]>([])
  const [hsnOptions, setHsnOptions] = useState<HsnMasterEntry[]>(() => getAllHsnCodes())
  const [batches, setBatches] = useState<any[]>([])
  const [resolvedItemId, setResolvedItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [newBatch, setNewBatch] = useState({
    batch: '',
    expiry: '',
    stock: 0,
    purchasePrice: 0,
    salePrice: 0,
    mrp: 0,
    rackNumber: ''
  })
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    Promise.all([
      getErp<any[]>('manufacturers').catch(() => []),
      getErp<any[]>('salts').catch(() => []),
      getErp<any[]>('hsn').catch(() => []),
      getErp<any[]>('items').catch(() => [])
    ]).then(([m, s, h, items]) => {
      setManufacturers(m.map((row) => row.name))
      setSalts(s.map((row) => row.name))

      if (Array.isArray(h) && h.length > 0) {
        registerHsnCodesFromDb(h)
      }
      setHsnOptions(getAllHsnCodes())

      if (id) {
        const item = items.find((row) => String(row.id) === String(id) || String(row.code) === String(id))
        if (item) {
          setResolvedItemId(item.id || id)
          const batchList = Array.isArray(item.batches) ? item.batches : []
          const initialStock = batchList.length > 0
            ? batchList.reduce((acc: number, b: any) => acc + (Number(b.stock) || 0), 0)
            : Number(item.stock || 0)

          const resolvedGst = item.gstRate !== undefined && item.gstRate !== null
            ? Number(item.gstRate)
            : getGstRateForHsn(item.hsn)

          setForm({
            code: item.code ?? '',
            name: item.name,
            packing: item.packing ?? '',
            unit: item.unit ?? '',
            manufacturer: item.manufacturer ?? '',
            salt: item.salt ?? '',
            hsn: item.hsn ?? '',
            gstRate: resolvedGst,
            stock: initialStock,
            mrp: Number(item.mrp || 0),
            saleRate: Number(item.saleRate || 0),
            purchaseRate: Number(item.purchaseRate || 0),
            status: item.status === 'banned' ? 'banned' : 'active',
            scheduleClass: item.scheduleClass ?? 'OTC',
            prescriptionRequired: Boolean(item.prescriptionRequired),
            coldChain: Boolean(item.coldChain),
            controlledSubstance: Boolean(item.controlledSubstance),
            recalled: Boolean(item.recalled)
          })
          setBatches(batchList)
        }
      } else {
        // Auto-generate item code for new items if blank
        setForm((prev) => ({
          ...prev,
          code: prev.code || `ITM-${Math.floor(100000 + Math.random() * 900000)}`,
          gstRate: prev.gstRate ?? 5
        }))
      }
    }).catch((e) => showToast(e.message))
  }, [id, showToast])

  const change = (field: keyof FormState, value: string | number | boolean) => setForm((current) => ({ ...current, [field]: value }))

  const handleHsnChange = (codeVal: string) => {
    const cleanCode = codeVal.trim().toUpperCase()
    const mappedGst = getGstRateForHsn(cleanCode)
    setForm((prev) => ({
      ...prev,
      hsn: cleanCode,
      gstRate: mappedGst
    }))
  }

  const handleMainStockChange = (val: number) => {
    const qty = Math.max(0, val)
    setForm((prev) => ({ ...prev, stock: qty }))
    if (batches.length === 1) {
      setBatches((prev) => [{ ...prev[0], stock: qty }])
    }
  }

  const handleBatchStockChange = (idx: number, val: number) => {
    const qty = Math.max(0, val)
    const updated = [...batches]
    updated[idx] = { ...updated[idx], stock: qty }
    setBatches(updated)
    const total = updated.reduce((s, b) => s + (Number(b.stock) || 0), 0)
    setForm((prev) => ({ ...prev, stock: total }))
  }

  const handleRemoveBatch = (idx: number) => {
    const updated = batches.filter((_, i) => i !== idx)
    setBatches(updated)
    const total = updated.reduce((s, b) => s + (Number(b.stock) || 0), 0)
    setForm((prev) => ({ ...prev, stock: total }))
  }

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBatch.batch.trim()) {
      showToast('Batch number is required.')
      return
    }
    const createdBatch = {
      id: `b-${Date.now()}`,
      batch: newBatch.batch.trim().toUpperCase(),
      expiry: newBatch.expiry || '',
      stock: Number(newBatch.stock || 0),
      costPrice: Number(newBatch.purchasePrice || form.purchaseRate || 0),
      purchasePrice: Number(newBatch.purchasePrice || form.purchaseRate || 0),
      salePrice: Number(newBatch.salePrice || form.saleRate || 0),
      mrp: Number(newBatch.mrp || form.mrp || 0),
      receivedOn: new Date().toISOString().slice(0, 10),
      rackNumber: newBatch.rackNumber.trim(),
      supplier: form.manufacturer || 'Direct Master Entry'
    }
    const updated = [...batches, createdBatch]
    setBatches(updated)
    const total = updated.reduce((s, b) => s + (Number(b.stock) || 0), 0)
    setForm((prev) => ({ ...prev, stock: total }))
    setNewBatch({ batch: '', expiry: '', stock: 0, purchasePrice: 0, salePrice: 0, mrp: 0, rackNumber: '' })
    setShowAddBatch(false)
    showToast(`Batch "${createdBatch.batch}" added with ${createdBatch.stock} units stock.`)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      showToast('Item name is required.')
      return
    }

    let finalBatches = [...batches]
    const totalStock = Number(form.stock || 0)

    if (finalBatches.length === 0 && totalStock > 0) {
      finalBatches = [
        {
          id: `b-${(form.code || id || 'itm').trim()}-opening`,
          batch: 'DEFAULT',
          expiry: '2028-12-31',
          stock: totalStock,
          costPrice: Number(form.purchaseRate || 0),
          purchasePrice: Number(form.purchaseRate || 0),
          salePrice: Number(form.saleRate || 0),
          mrp: Number(form.mrp || 0),
          receivedOn: new Date().toISOString().slice(0, 10),
          supplier: form.manufacturer || 'Direct Master Opening'
        }
      ]
    } else if (finalBatches.length === 1 && (finalBatches[0].stock ?? 0) !== totalStock) {
      finalBatches[0] = { ...finalBatches[0], stock: totalStock }
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim() || `ITM-${Math.floor(100000 + Math.random() * 900000)}`,
      packing: form.packing.trim(),
      unit: form.unit.trim(),
      manufacturer: form.manufacturer.trim(),
      salt: form.salt.trim(),
      hsn: form.hsn.trim(),
      gstRate: Number(form.gstRate ?? getGstRateForHsn(form.hsn)),
      stock: totalStock,
      mrp: Number(form.mrp || 0),
      saleRate: Number(form.saleRate || 0),
      purchaseRate: Number(form.purchaseRate || 0),
      batches: finalBatches,
      batchCount: finalBatches.length
    }

    setSaving(true)
    try {
      if (id) {
        await patchErp('items', resolvedItemId || id, payload)
        showToast(`Item "${payload.name}" updated successfully.`)
      } else {
        const created = await postErp<any>('items', payload)
        showToast(`Item "${created.name || payload.name}" created and added to master.`)
      }
      navigate('/masters/items')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save item.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Back to items" onClick={() => navigate('/masters/items')} className="glass-action rounded-lg p-2 hover:bg-secondary transition active:scale-[0.98]">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">{id ? 'Edit item' : 'New item'}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Product identity, tax classification and trade rates</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-600 px-4 h-9 text-xs sm:text-sm font-semibold text-white shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </div>
        <div className="glass-surface grid grid-cols-1 gap-4 rounded-2xl p-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Item code">
            <input
              placeholder="e.g. ITM-201948"
              value={form.code}
              onChange={(e) => change('code', e.target.value)}
            />
          </Field>
          <Field label="Item name *">
            <input
              required
              autoFocus
              placeholder="e.g. AZITHRAL 500MG TAB"
              value={form.name}
              onChange={(e) => change('name', e.target.value)}
            />
          </Field>
          <Field label="Packing">
            <input
              placeholder="e.g. 10x10 Tabs / 200ML"
              value={form.packing}
              onChange={(e) => change('packing', e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <input
              placeholder="e.g. NO., TAB, ML"
              value={form.unit}
              onChange={(e) => change('unit', e.target.value)}
            />
          </Field>
          <Field label="Manufacturer">
            <input
              list="item-manufacturers"
              placeholder="Select or type a new manufacturer"
              value={form.manufacturer}
              onChange={(e) => change('manufacturer', e.target.value)}
            />
            <p className="text-[11px] normal-case font-normal leading-4 text-muted-foreground">
              A new name is added to Manufacturer Master automatically when you save this item.
            </p>
            <datalist id="item-manufacturers">
              {manufacturers.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field label="Salt / composition">
            <input
              list="item-salts"
              placeholder="e.g. Azithromycin 500mg"
              value={form.salt}
              onChange={(e) => change('salt', e.target.value)}
            />
            <datalist id="item-salts">
              {salts.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field label="HSN code">
            <input
              list="item-hsn"
              placeholder="e.g. 30049011"
              value={form.hsn}
              onChange={(e) => handleHsnChange(e.target.value)}
            />
            <datalist id="item-hsn">
              {hsnOptions.map((v) => (
                <option key={v.code} value={v.code} label={`${v.code} (${v.gstRate}% GST) - ${v.description}`} />
              ))}
            </datalist>
          </Field>
          <Field label="GST rate (%)">
            <div className="flex items-center gap-2">
              <select
                value={form.gstRate}
                onChange={(e) => change('gstRate', Number(e.target.value))}
              >
                <option value={0}>0% - Exempt / Nil</option>
                <option value={5}>5% - Medicaments / Formulations (3004)</option>
                <option value={12}>12% - General / Surgical</option>
                <option value={18}>18% - Nutraceuticals / Foods (2106)</option>
                <option value={28}>28% - Luxury / Maximum Rate</option>
              </select>
              {form.hsn && (
                <span className="shrink-0 text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground font-semibold border border-border whitespace-nowrap">
                  {getGstRateForHsn(form.hsn)}% GST
                </span>
              )}
            </div>
          </Field>
          <Field label="Purchase rate (₹)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchaseRate || ''}
              placeholder="0.00"
              onChange={(e) => change('purchaseRate', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Sale rate (₹)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.saleRate || ''}
              placeholder="0.00"
              onChange={(e) => change('saleRate', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="MRP (₹)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.mrp || ''}
              placeholder="0.00"
              onChange={(e) => change('mrp', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Stock (Units)">
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock || ''}
              placeholder="0"
              onChange={(e) => handleMainStockChange(e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => change('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="banned">Blocked / banned</option>
            </select>
          </Field>
          <Field label="Drug schedule">
            <select value={form.scheduleClass} onChange={(e) => change('scheduleClass', e.target.value)}>
              <option value="OTC">OTC (Over the counter)</option>
              <option value="H">Schedule H</option>
              <option value="H1">Schedule H1</option>
              <option value="X">Schedule X</option>
              <option value="NDPS">NDPS (Narcotic)</option>
            </select>
          </Field>
          <Field label="Compliance controls">
            <div className="space-y-1 pt-1">
              <label className="flex items-center gap-2 text-xs normal-case cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={form.prescriptionRequired}
                  onChange={(e) => change('prescriptionRequired', e.target.checked)}
                />
                Prescription required
              </label>
              <label className="flex items-center gap-2 text-xs normal-case cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={form.coldChain}
                  onChange={(e) => change('coldChain', e.target.checked)}
                />
                Cold chain (2-8&deg;C)
              </label>
              <label className="flex items-center gap-2 text-xs normal-case cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={form.controlledSubstance}
                  onChange={(e) => change('controlledSubstance', e.target.checked)}
                />
                Controlled substance
              </label>
              <label className="flex items-center gap-2 text-xs normal-case cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={form.recalled}
                  onChange={(e) => change('recalled', e.target.checked)}
                />
                Product recalled
              </label>
            </div>
          </Field>
        </div>
      </form>

    {id && (
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">Registered Batches &amp; Import History</h2>
            <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Total Stock: {form.stock}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewBatch({
                batch: '',
                expiry: '',
                stock: 0,
                purchasePrice: form.purchaseRate || 0,
                salePrice: form.saleRate || 0,
                mrp: form.mrp || 0,
                rackNumber: ''
              })
              setShowAddBatch(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} className="text-primary" /> Add batch
          </button>
        </div>

        {/* Add Batch Inline Card */}
        {showAddBatch && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">Register New Batch</h3>
              <button
                type="button"
                onClick={() => setShowAddBatch(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Batch No *</label>
                <input
                  required
                  placeholder="e.g. B-2026"
                  value={newBatch.batch}
                  onChange={(e) => setNewBatch({ ...newBatch, batch: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground uppercase font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Expiry</label>
                <input
                  type="date"
                  value={newBatch.expiry}
                  onChange={(e) => setNewBatch({ ...newBatch, expiry: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Stock Qty *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newBatch.stock || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, stock: Number(e.target.value || 0) })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Purchase Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newBatch.purchasePrice || ''}
                  placeholder="0.00"
                  onChange={(e) => setNewBatch({ ...newBatch, purchasePrice: Number(e.target.value || 0) })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newBatch.mrp || ''}
                  placeholder="0.00"
                  onChange={(e) => setNewBatch({ ...newBatch, mrp: Number(e.target.value || 0) })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Rack No</label>
                <input
                  placeholder="e.g. R-12"
                  value={newBatch.rackNumber}
                  onChange={(e) => setNewBatch({ ...newBatch, rackNumber: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddBatch(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBatch}
                className="rounded-lg bg-primary hover:bg-primary/90 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs cursor-pointer transition"
              >
                Confirm Add Batch
              </button>
            </div>
          </div>
        )}
        
        {batches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground space-y-2 bg-muted/20">
            <p className="font-semibold text-foreground">No batches registered for this item yet.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You can edit the stock in the <strong className="text-foreground">Stock (Units)</strong> field above (a default batch will be automatically registered on save), or click <strong className="text-foreground">&quot;Add batch&quot;</strong> to enter a custom batch number and expiry.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1400px]">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider text-left text-[11px] font-semibold">
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Purchase Price</th>
                    <th className="px-4 py-3 text-right">Sale Price</th>
                    <th className="px-4 py-3 text-right">MRP</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-center">Sales Scheme</th>
                    <th className="px-4 py-3 text-center">Purchase Scheme</th>
                    <th className="px-4 py-3">Received Date</th>
                    <th className="px-4 py-3">Manufactured Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Invoice No / Date</th>
                    <th className="px-4 py-3">Rack No</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {batches.map((b, idx) => {
                    const salesScheme = `${b.salesSchemeDeal ?? 0}+${b.salesSchemeFree ?? 0}`;
                    const purchaseScheme = `${b.purchaseSchemeDeal ?? 0}+${b.purchaseSchemeFree ?? 0}`;
                    const val = b.reportedValue ?? ((Number(b.stock) || 0) * (b.costPrice ?? 0));
                    return (
                      <tr key={b.id || idx} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">{b.batch || 'UNSPECIFIED'}</td>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted-foreground font-medium">{b.expiry || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            value={b.stock ?? 0}
                            onChange={(e) => handleBatchStockChange(idx, Number(e.target.value))}
                            className="w-20 text-right rounded-md border border-input bg-background px-2 py-1 font-mono text-xs text-foreground font-bold focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none"
                            title="Edit stock for this batch"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(b.costPrice ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(b.purchasePrice ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(b.salePrice ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(b.mrp ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(val)}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-muted-foreground">{salesScheme}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-muted-foreground">{purchaseScheme}</td>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted-foreground">{b.receivedOn || '—'}</td>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap text-muted-foreground">{b.manufacturedOn || '—'}</td>
                        <td className="px-4 py-2.5 truncate max-w-[200px] font-medium" title={b.supplier}>{b.supplier || '—'}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <div className="font-semibold text-foreground">{b.invoiceNumber || '—'}</div>
                          {b.invoiceDate && <div className="text-[10px] text-muted-foreground mt-0.5">{b.invoiceDate}</div>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{b.rackNumber || '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBatch(idx)}
                            title="Remove this batch"
                            className="text-muted-foreground hover:text-destructive transition p-1.5 rounded-md hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:p-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:normal-case [&>input]:text-foreground [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:p-2.5 [&>select]:text-sm [&>select]:font-normal [&>select]:normal-case [&>select]:text-foreground">{children}</div></label> }
