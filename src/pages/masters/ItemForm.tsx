import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

type FormState = { code: string; name: string; packing: string; manufacturer: string; salt: string; hsn: string; mrp: number; saleRate: number; purchaseRate: number; status: 'active' | 'banned' }
const EMPTY: FormState = { code: '', name: '', packing: '', manufacturer: '', salt: '', hsn: '', mrp: 0, saleRate: 0, purchaseRate: 0, status: 'active' }

export default function ItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [salts, setSalts] = useState<string[]>([])
  const [hsnCodes, setHsnCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    Promise.all([getErp<any[]>('manufacturers'), getErp<any[]>('salts'), getErp<any[]>('hsn'), getErp<any[]>('items')]).then(([m, s, h, items]) => {
      setManufacturers(m.map((row) => row.name)); setSalts(s.map((row) => row.name)); setHsnCodes(h.map((row) => row.code))
      if (id) { const item = items.find((row) => row.id === id); if (item) setForm({ code: item.code ?? '', name: item.name, packing: item.packing ?? '', manufacturer: item.manufacturer ?? '', salt: item.salt ?? '', hsn: item.hsn ?? '', mrp: item.mrp, saleRate: item.saleRate, purchaseRate: item.purchaseRate, status: item.status === 'banned' ? 'banned' : 'active' }) }
    }).catch((e) => showToast(e.message))
  }, [id, showToast])

  const change = (field: keyof FormState, value: string | number) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { if (id) await patchErp('items', id, form); else await postErp('items', form); showToast(id ? 'Item updated.' : 'Item created.'); navigate('/masters/items') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save item.') } finally { setSaving(false) } }

  return <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><button type="button" aria-label="Back to items" onClick={() => navigate('/masters/items')} className="glass-action rounded-lg p-2"><ArrowLeft size={18} /></button><div><h1 className="text-2xl font-semibold">{id ? 'Edit item' : 'New item'}</h1><p className="text-sm text-muted-foreground">Product identity, tax classification and trade rates</p></div></div><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving…' : 'Save item'}</button></div>
    <div className="glass-surface grid grid-cols-1 gap-4 rounded-2xl p-5 md:grid-cols-2 lg:grid-cols-3">
      <Field label="Item code"><input required value={form.code} onChange={(e) => change('code', e.target.value)} /></Field>
      <Field label="Item name"><input required autoFocus value={form.name} onChange={(e) => change('name', e.target.value)} /></Field>
      <Field label="Packing"><input value={form.packing} onChange={(e) => change('packing', e.target.value)} /></Field>
      <Field label="Manufacturer"><input list="item-manufacturers" value={form.manufacturer} onChange={(e) => change('manufacturer', e.target.value)} /><datalist id="item-manufacturers">{manufacturers.map((v) => <option key={v} value={v} />)}</datalist></Field>
      <Field label="Salt / composition"><input list="item-salts" value={form.salt} onChange={(e) => change('salt', e.target.value)} /><datalist id="item-salts">{salts.map((v) => <option key={v} value={v} />)}</datalist></Field>
      <Field label="HSN code"><input list="item-hsn" value={form.hsn} onChange={(e) => change('hsn', e.target.value)} /><datalist id="item-hsn">{hsnCodes.map((v) => <option key={v} value={v} />)}</datalist></Field>
      <Field label="Purchase rate"><input type="number" min="0" step="0.01" value={form.purchaseRate} onChange={(e) => change('purchaseRate', Number(e.target.value))} /></Field>
      <Field label="Sale rate"><input type="number" min="0" step="0.01" value={form.saleRate} onChange={(e) => change('saleRate', Number(e.target.value))} /></Field>
      <Field label="MRP"><input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => change('mrp', Number(e.target.value))} /></Field>
      <Field label="Status"><select value={form.status} onChange={(e) => change('status', e.target.value)}><option value="active">Active</option><option value="banned">Blocked / banned</option></select></Field>
    </div>
  </form>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:p-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:normal-case [&>input]:text-foreground [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:p-2.5 [&>select]:text-sm [&>select]:font-normal [&>select]:normal-case [&>select]:text-foreground">{children}</div></label> }
