import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'
import { formatCurrency } from '../../lib/utils'

type FormState = { code: string; name: string; packing: string; manufacturer: string; salt: string; hsn: string; mrp: number; saleRate: number; purchaseRate: number; status: 'active' | 'banned'; scheduleClass:'OTC'|'H'|'H1'|'X'|'NDPS'; prescriptionRequired:boolean; coldChain:boolean; controlledSubstance:boolean }
const EMPTY: FormState = { code: '', name: '', packing: '', manufacturer: '', salt: '', hsn: '', mrp: 0, saleRate: 0, purchaseRate: 0, status: 'active', scheduleClass:'OTC', prescriptionRequired:false, coldChain:false, controlledSubstance:false }

export default function ItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [salts, setSalts] = useState<string[]>([])
  const [hsnCodes, setHsnCodes] = useState<string[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    Promise.all([getErp<any[]>('manufacturers'), getErp<any[]>('salts'), getErp<any[]>('hsn'), getErp<any[]>('items')]).then(([m, s, h, items]) => {
      setManufacturers(m.map((row) => row.name)); setSalts(s.map((row) => row.name)); setHsnCodes(h.map((row) => row.code))
      if (id) {
        const item = items.find((row) => row.id === id);
        if (item) {
          setForm({
            code: item.code ?? '',
            name: item.name,
            packing: item.packing ?? '',
            manufacturer: item.manufacturer ?? '',
            salt: item.salt ?? '',
            hsn: item.hsn ?? '',
            mrp: item.mrp,
            saleRate: item.saleRate,
            purchaseRate: item.purchaseRate,
            status: item.status === 'banned' ? 'banned' : 'active',
            scheduleClass: item.scheduleClass ?? 'OTC',
            prescriptionRequired: Boolean(item.prescriptionRequired),
            coldChain: Boolean(item.coldChain),
            controlledSubstance: Boolean(item.controlledSubstance)
          })
          setBatches(item.batches ?? [])
        }
      }
    }).catch((e) => showToast(e.message))
  }, [id, showToast])

  const change = (field: keyof FormState, value: string | number | boolean) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { if (id) await patchErp('items', id, form); else await postErp('items', form); showToast(id ? 'Item updated.' : 'Item created.'); navigate('/masters/items') } catch (error) { showToast(error instanceof Error ? error.message : 'Unable to save item.') } finally { setSaving(false) } }

  return <div className="mx-auto max-w-5xl space-y-6">
    <form onSubmit={submit} className="space-y-5">
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
        <Field label="Drug schedule"><select value={form.scheduleClass} onChange={(e) => change('scheduleClass', e.target.value)}><option>OTC</option><option>H</option><option>H1</option><option>X</option><option>NDPS</option></select></Field>
        <Field label="Compliance controls"><label className="flex gap-2 py-1"><input type="checkbox" checked={form.prescriptionRequired} onChange={(e)=>change('prescriptionRequired',e.target.checked)}/> Prescription required</label><label className="flex gap-2 py-1"><input type="checkbox" checked={form.coldChain} onChange={(e)=>change('coldChain',e.target.checked)}/> Cold chain</label><label className="flex gap-2 py-1"><input type="checkbox" checked={form.controlledSubstance} onChange={(e)=>change('controlledSubstance',e.target.checked)}/> Controlled substance</label></Field>
      </div>
    </form>

    {id && (
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Registered Batches &amp; Import History</h2>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
          </span>
        </div>
        
        {batches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            No batches registered for this item yet.
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs min-w-[1400px]">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-left">
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium text-right">Current Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Cost Price</th>
                  <th className="px-4 py-3 font-medium text-right">Purchase Price</th>
                  <th className="px-4 py-3 font-medium text-right">Sale Price</th>
                  <th className="px-4 py-3 font-medium text-right">MRP</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-center">Sales Scheme</th>
                  <th className="px-4 py-3 font-medium text-center">Purchase Scheme</th>
                  <th className="px-4 py-3 font-medium">Received Date</th>
                  <th className="px-4 py-3 font-medium">Manufactured Date</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Invoice No / Date</th>
                  <th className="px-4 py-3 font-medium">Rack No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {batches.map((b, idx) => {
                  const salesScheme = `${b.salesSchemeDeal ?? 0}+${b.salesSchemeFree ?? 0}`;
                  const purchaseScheme = `${b.purchaseSchemeDeal ?? 0}+${b.purchaseSchemeFree ?? 0}`;
                  const val = b.reportedValue ?? ((b.stock ?? 0) * (b.costPrice ?? 0));
                  return (
                    <tr key={b.id || idx} className="hover:bg-slate-900/30">
                      <td className="px-4 py-3 font-mono font-medium text-amber-400">{b.batch || 'UNSPECIFIED'}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{b.expiry || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{b.stock ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.costPrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.purchasePrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.salePrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.mrp ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(val)}</td>
                      <td className="px-4 py-3 text-center font-mono">{salesScheme}</td>
                      <td className="px-4 py-3 text-center font-mono">{purchaseScheme}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{b.receivedOn || '—'}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{b.manufacturedOn || '—'}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]" title={b.supplier}>{b.supplier || '—'}</td>
                      <td className="px-4 py-3 font-mono">
                        <div>{b.invoiceNumber || '—'}</div>
                        {b.invoiceDate && <div className="text-[10px] text-slate-400 mt-0.5">{b.invoiceDate}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono">{b.rackNumber || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}<div className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-input [&>input]:bg-background [&>input]:p-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:normal-case [&>input]:text-foreground [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-input [&>select]:bg-background [&>select]:p-2.5 [&>select]:text-sm [&>select]:font-normal [&>select]:normal-case [&>select]:text-foreground">{children}</div></label> }
