import { useEffect, useMemo, useState } from 'react'
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { useErpAutoRefresh } from '../../hooks/useErpAutoRefresh'
import { cn } from '../../lib/utils'
import ActiveProductDetailPanel from '../../components/transactions/ActiveProductDetailPanel'

type Item = { id: string; code: string; name: string }
type Batch = { id: string; itemId: string; itemCode: string; itemName: string; batchNumber: string; expiryOn: string; receivedOn: string; manufacturedOn: string; mrp: number; costPrice: number; purchasePrice: number; salePrice: number; salesSchemeDeal: number; salesSchemeFree: number; purchaseSchemeDeal: number; purchaseSchemeFree: number; supplier: string; supplierInvoiceNumber: string; supplierInvoiceDate: string; rackNumber: string; sourceReportValue: number; stock: number }
type BatchForm = Omit<Batch, 'id' | 'itemCode' | 'itemName' | 'stock'>

const empty = (): BatchForm => ({ itemId: '', batchNumber: '', expiryOn: '', receivedOn: '', manufacturedOn: '', mrp: 0, costPrice: 0, purchasePrice: 0, salePrice: 0, salesSchemeDeal: 0, salesSchemeFree: 0, purchaseSchemeDeal: 0, purchaseSchemeFree: 0, supplier: '', supplierInvoiceNumber: '', supplierInvoiceDate: '', rackNumber: '', sourceReportValue: 0 })
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

export default function BatchMaster() {
  const [items, setItems] = useState<Item[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [form, setForm] = useState<BatchForm>(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((state) => state.showToast)
  const load = () => Promise.all([getErp<Item[]>('items'), getErp<Batch[]>('item-batches')]).then(([itemRows, batchRows]) => { setItems(itemRows); setBatches(batchRows) }).catch((error) => showToast(error instanceof Error ? error.message : 'Could not load batches.'))
  useEffect(() => { load() }, [showToast])
  useErpAutoRefresh(['item-batches', 'items'], () => { load() })
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return term ? batches.filter((batch) => [batch.itemName, batch.itemCode, batch.batchNumber, batch.supplier, batch.rackNumber].some((value) => value.toLowerCase().includes(term))) : batches }, [batches, search])
  const activeBatch = filtered[activeIndex] || (filtered.length > 0 ? filtered[0] : null)
  const set = <K extends keyof BatchForm>(key: K, value: BatchForm[K]) => setForm((current) => ({ ...current, [key]: value }))
  const reset = () => { setForm(empty()); setEditingId(null) }
  const edit = (batch: Batch) => { setEditingId(batch.id); setForm({ itemId: batch.itemId, batchNumber: batch.batchNumber, expiryOn: batch.expiryOn, receivedOn: batch.receivedOn, manufacturedOn: batch.manufacturedOn, mrp: batch.mrp, costPrice: batch.costPrice, purchasePrice: batch.purchasePrice, salePrice: batch.salePrice, salesSchemeDeal: batch.salesSchemeDeal, salesSchemeFree: batch.salesSchemeFree, purchaseSchemeDeal: batch.purchaseSchemeDeal, purchaseSchemeFree: batch.purchaseSchemeFree, supplier: batch.supplier, supplierInvoiceNumber: batch.supplierInvoiceNumber, supplierInvoiceDate: batch.supplierInvoiceDate, rackNumber: batch.rackNumber, sourceReportValue: batch.sourceReportValue }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { if (editingId) await patchErp('item-batches', editingId, form); else await postErp('item-batches', form); showToast(editingId ? 'Batch updated.' : 'Batch created.'); reset(); load() } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save batch.') } finally { setSaving(false) } }
  const remove = async (batch: Batch) => { if (!window.confirm(`Delete batch ${batch.batchNumber}? This is only possible when it has no inventory or document history.`)) return; try { await deleteErp('item-batches', batch.id); setBatches((current) => current.filter((row) => row.id !== batch.id)); showToast('Batch deleted.') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to delete batch.') } }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Batch Master</h1><p className="mt-1 text-sm text-muted-foreground">Create, edit and review every batch-level rate, scheme, supplier and rack field.</p></div><button onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New batch</button></div>
    <form onSubmit={submit} className="glass-surface grid grid-cols-1 gap-4 rounded-2xl p-5 md:grid-cols-2 lg:grid-cols-4">
      <Field label="Item"><select required value={form.itemId} onChange={(event) => set('itemId', event.target.value)}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field>
      <Field label="Batch number"><input required value={form.batchNumber} onChange={(event) => set('batchNumber', event.target.value)} /></Field>
      <Field label="MRP"><NumberInput value={form.mrp} onChange={(value) => set('mrp', value)} /></Field>
      <Field label="Current stock"><div className="rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground">{editingId ? `${batches.find((batch) => batch.id === editingId)?.stock ?? 0} units` : 'Created through purchase/opening stock'}</div></Field>
      <Field label="Received date"><input type="date" value={form.receivedOn} onChange={(event) => set('receivedOn', event.target.value)} /></Field>
      <Field label="Manufactured date"><input type="date" value={form.manufacturedOn} onChange={(event) => set('manufacturedOn', event.target.value)} /></Field>
      <Field label="Expiry date"><input type="date" value={form.expiryOn} onChange={(event) => set('expiryOn', event.target.value)} /></Field>
      <Field label="Rack number"><input value={form.rackNumber} onChange={(event) => set('rackNumber', event.target.value)} /></Field>
      <Field label="Cost price"><NumberInput value={form.costPrice} onChange={(value) => set('costPrice', value)} /></Field>
      <Field label="Purchase price"><NumberInput value={form.purchasePrice} onChange={(value) => set('purchasePrice', value)} /></Field>
      <Field label="Sale price"><NumberInput value={form.salePrice} onChange={(value) => set('salePrice', value)} /></Field>
      <Field label="Source report value"><NumberInput value={form.sourceReportValue} onChange={(value) => set('sourceReportValue', value)} /></Field>
      <Field label="Sales scheme — deal"><NumberInput value={form.salesSchemeDeal} onChange={(value) => set('salesSchemeDeal', value)} /></Field>
      <Field label="Sales scheme — free"><NumberInput value={form.salesSchemeFree} onChange={(value) => set('salesSchemeFree', value)} /></Field>
      <Field label="Purchase scheme — deal"><NumberInput value={form.purchaseSchemeDeal} onChange={(value) => set('purchaseSchemeDeal', value)} /></Field>
      <Field label="Purchase scheme — free"><NumberInput value={form.purchaseSchemeFree} onChange={(value) => set('purchaseSchemeFree', value)} /></Field>
      <Field label="Supplier"><input value={form.supplier} onChange={(event) => set('supplier', event.target.value)} /></Field>
      <Field label="Supplier invoice number"><input value={form.supplierInvoiceNumber} onChange={(event) => set('supplierInvoiceNumber', event.target.value)} /></Field>
      <Field label="Supplier invoice date"><input type="date" value={form.supplierInvoiceDate} onChange={(event) => set('supplierInvoiceDate', event.target.value)} /></Field>
      <div className="flex items-end justify-end gap-3 lg:col-span-4"><button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm"><X size={16} /> Clear</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} /> {saving ? 'Saving…' : editingId ? 'Save batch' : 'Create batch'}</button></div>
    </form>
    <div className="flex max-w-md items-center gap-2 rounded-lg border border-input bg-background px-3 py-2"><input className="w-full bg-transparent text-sm outline-none" placeholder="Search item, batch, supplier or rack…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="overflow-x-auto rounded-xl border border-border"><table className="min-w-[1500px] w-full text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Item / batch</th><th className="p-3">Stock</th><th className="p-3">MFG / expiry</th><th className="p-3">Cost / purchase / sale / MRP</th><th className="p-3">Schemes</th><th className="p-3">Supplier invoice</th><th className="p-3">Rack</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{filtered.map((batch, idx) => {
      const isActive = idx === activeIndex
      return <tr key={batch.id} onClick={() => setActiveIndex(idx)} className={cn("border-t border-border cursor-pointer transition-colors", isActive ? "bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40 border-l-4 border-l-indigo-500" : "hover:bg-muted/30")}><td className="p-3"><div className="font-medium">{batch.itemName}</div><div className="font-mono text-xs text-muted-foreground">{batch.itemCode} · {batch.batchNumber}</div></td><td className="p-3 font-mono">{batch.stock}</td><td className="p-3 text-xs">{batch.manufacturedOn || '—'}<br />{batch.expiryOn || '—'}</td><td className="p-3 text-xs leading-6">{money(batch.costPrice)} / {money(batch.purchasePrice)} / {money(batch.salePrice)} / {money(batch.mrp)}</td><td className="p-3 text-xs">Sales {batch.salesSchemeDeal}+{batch.salesSchemeFree}<br />Purchase {batch.purchaseSchemeDeal}+{batch.purchaseSchemeFree}</td><td className="p-3 text-xs">{batch.supplier || '—'}<br />{batch.supplierInvoiceNumber || '—'} {batch.supplierInvoiceDate ? `· ${batch.supplierInvoiceDate}` : ''}</td><td className="p-3">{batch.rackNumber || '—'}</td><td className="p-3 text-right"><button aria-label={`Edit ${batch.batchNumber}`} onClick={(e) => { e.stopPropagation(); edit(batch) }} className="mr-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Edit2 size={16} /></button><button aria-label={`Delete ${batch.batchNumber}`} onClick={(e) => { e.stopPropagation(); remove(batch) }} className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>
    })}</tbody></table></div>

    {/* Marg ERP Style Inspection Panel for Batch Master */}
    {filtered.length > 0 && (
      <ActiveProductDetailPanel
        activeProduct={
          activeBatch
            ? {
                name: activeBatch.itemName,
                id: activeBatch.itemId,
                batchId: activeBatch.id,
                batch: activeBatch.batchNumber,
                expiry: activeBatch.expiryOn,
                stock: activeBatch.stock,
                saleRate: activeBatch.salePrice,
                purchaseRate: activeBatch.purchasePrice,
                costPrice: activeBatch.costPrice,
                mrp: activeBatch.mrp,
                salesSchemeDeal: activeBatch.salesSchemeDeal,
                salesSchemeFree: activeBatch.salesSchemeFree,
                purchaseSchemeDeal: activeBatch.purchaseSchemeDeal,
                purchaseSchemeFree: activeBatch.purchaseSchemeFree,
                manufacturer: activeBatch.supplier,
                location: activeBatch.rackNumber,
                refNo: activeBatch.supplierInvoiceNumber,
                date: activeBatch.supplierInvoiceDate,
              }
            : null
        }
        billSummary={{
          title: 'Batch Valuation',
          partyLabel: 'Supplier',
          partyName: activeBatch?.supplier || 'All Suppliers',
          valueOfGoods: filtered.reduce((s, b) => s + ((b.stock || 0) * (b.purchasePrice || 0)), 0),
          grandTotal: filtered.reduce((s, b) => s + ((b.stock || 0) * (b.purchasePrice || 0)), 0),
        }}
        totalRows={filtered.length}
        activeIndex={activeIndex}
        emptyMessage="Click any batch row to inspect live rates, stock, schemes, expiry, and supplier details."
      />
    )}
  </div>
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} /> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:p-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:normal-case [&>input]:text-foreground [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:p-2.5 [&>select]:text-sm [&>select]:font-normal [&>select]:normal-case [&>select]:text-foreground">{children}</div></label> }
