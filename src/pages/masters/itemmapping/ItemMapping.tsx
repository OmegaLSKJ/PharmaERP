import { useState } from 'react'
import { Plus, Search, Link2, Trash2 } from 'lucide-react'
import { cn, formatCurrency } from '../../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, postErp } from '../../../lib/erpApi'
import { useUIStore } from '../../../store/uiStore'

interface Map {
  id: string
  product: string
  code: string
  company: string
  batch: string
  unit: string
  stock: number
  cost: number
  purchase: number
  sale: number
  mrp: number
  value: number
  sales_scheme: string
  purchase_scheme: string
  received: string
  mfg: string
  exp: string
  supplier: string
  invoice_no: string
  invoice_date: string
  rack?: string
  status?: string
}

export default function ItemMapping() {
  const [mappings, setMappings] = useState<Map[]>([])
  const [search, setSearch] = useState('')
  const showToast = useUIStore((s) => s.showToast)

  useEffect(() => {
    getErp<any[]>('item-mappings')
      .then((rows) => {
        setMappings(
          rows.map((row) => {
            const getVal = (cleanKey: string, excelKeys: string[]) => {
              if (row[cleanKey] !== undefined) return row[cleanKey];
              for (const k of excelKeys) {
                if (row[k] !== undefined) return row[k];
                if (row[`${k} - nan`] !== undefined) return row[`${k} - nan`];
              }
              return undefined;
            };

            const product = getVal('product', ['Product Name', 'productName']) ?? row.supplierItem ?? '';
            const code = getVal('code', ['Code']) ?? '';
            const company = getVal('company', ['Company']) ?? '';
            const batch = getVal('batch', ['Batch']) ?? '';
            const unit = getVal('unit', ['Unit']) ?? row.packing ?? '';
            const stock = Number(getVal('stock', ['Current Stock']) ?? 0);
            const cost = Number(getVal('cost', ['Cost Price', 'Cost Price - Rate']) ?? 0);
            const purchase = Number(getVal('purchase', ['Purchase Price', 'Purchase Price - Rate']) ?? 0);
            const sale = Number(getVal('sale', ['Sales Price', 'Sales Price - Rate']) ?? 0);
            const mrp = Number(getVal('mrp', ['M.R.P.', 'M.R.P. - Rate']) ?? 0);
            const value = Number(getVal('value', ['Value', 'Value - At Cost']) ?? 0);

            // Scheme formatting
            const salesDeal = row.sales_scheme?.split('+')[0] ?? getVal('', ['Sales Scheme - Deal']) ?? '0';
            const salesFree = row.sales_scheme?.split('+')[1] ?? getVal('', ['Sales Scheme - Free', 'nan - Free']) ?? '0';
            const purcDeal = row.purchase_scheme?.split('+')[0] ?? getVal('', ['Purc.Scheme - Deal', 'Purchase Scheme - Deal']) ?? '0';
            const purcFree = row.purchase_scheme?.split('+')[1] ?? getVal('', ['Purc.Scheme - Free', 'Purchase Scheme - Free']) ?? '0';

            const received = getVal('received', ['Rec.Date', 'Received Date', 'received_date']) ?? '';
            const mfg = getVal('mfg', ['MFG', 'MFG - Date']) ?? '—';
            const exp = getVal('exp', ['EXP', 'EXP - Date']) ?? '';
            const supplier = getVal('supplier', ['Supplier', 'Supplier - Name']) ?? row.party ?? '';
            const invoice_no = getVal('invoice_no', ['Inv.No', 'Invoice No', 'invoiceNo']) ?? '';
            const invoice_date = getVal('invoice_date', ['Inv.Date', 'Invoice Date', 'invoiceDate']) ?? '';
            const rack = getVal('rack', ['Rack No.', 'Rack No']) ?? '';

            return {
              id: row.id,
              product: String(product),
              code: String(code),
              company: String(company),
              batch: String(batch),
              unit: String(unit),
              stock,
              cost,
              purchase,
              sale,
              mrp,
              value,
              sales_scheme: `${salesDeal}+${salesFree}`,
              purchase_scheme: `${purcDeal}+${purcFree}`,
              received: String(received),
              mfg: String(mfg),
              exp: String(exp),
              supplier: String(supplier),
              invoice_no: String(invoice_no),
              invoice_date: String(invoice_date),
              rack: String(rack),
              status: row.status === 'posted' ? 'active' : (row.status ?? 'active')
            };
          })
        )
      })
      .catch((e) => showToast(e.message))
  }, [showToast])

  const filtered = mappings.filter(
    (m) =>
      m.product.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      m.supplier.toLowerCase().includes(search.toLowerCase()) ||
      m.batch.toLowerCase().includes(search.toLowerCase()) ||
      m.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (m.rack && m.rack.toLowerCase().includes(search.toLowerCase()))
  )

  const addMapping = async () => {
    const product = window.prompt('Product name')
    if (!product) return
    const code = window.prompt('Product code')
    if (!code) return
    const company = window.prompt('Company name')
    if (!company) return
    try {
      const row = await postErp<any>('item-mappings', {
        product,
        code,
        company,
        batch: 'UNSPECIFIED',
        unit: 'NO.',
        stock: 0,
        cost: 0,
        purchase: 0,
        sale: 0,
        mrp: 0,
        value: 0,
        sales_scheme: '0+0',
        purchase_scheme: '0+0',
        received: new Date().toISOString().slice(0, 10),
        mfg: '—',
        exp: '',
        supplier: 'DIRECT',
        invoice_no: '',
        invoice_date: '',
        rack: '',
        status: 'posted'
      })
      setMappings((items) => [
        ...items,
        {
          id: row.id,
          product,
          code,
          company,
          batch: 'UNSPECIFIED',
          unit: 'NO.',
          stock: 0,
          cost: 0,
          purchase: 0,
          sale: 0,
          mrp: 0,
          value: 0,
          sales_scheme: '0+0',
          purchase_scheme: '0+0',
          received: new Date().toISOString().slice(0, 10),
          mfg: '—',
          exp: '',
          supplier: 'DIRECT',
          invoice_no: '',
          invoice_date: '',
          rack: '',
          status: 'active'
        }
      ])
      showToast('Item mapping saved.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save mapping.')
    }
  }

  const removeMapping = async (id: string) => {
    if (!window.confirm('Delete this mapping?')) return
    try {
      await deleteErp('item-mappings', id)
      setMappings((items) => items.filter((item) => item.id !== id))
      showToast('Mapping deleted.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete mapping.')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Item Mapping</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Link2 size={14} className="text-indigo-400" />
            Imported stock mapping with full batch, rate, supplier and rack details
          </p>
        </div>
        <button
          onClick={addMapping}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md"
        >
          <Plus size={16} /> New Mapping
        </button>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search product, supplier, batch, invoice or rack..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white text-sm outline-none focus:border-indigo-500"
        />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[1600px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Product / Code</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Batch / Unit</th>
              <th className="text-right px-4 py-3 font-medium">Stock</th>
              <th className="text-right px-4 py-3 font-medium">Cost</th>
              <th className="text-right px-4 py-3 font-medium">Purchase</th>
              <th className="text-right px-4 py-3 font-medium">Sale</th>
              <th className="text-right px-4 py-3 font-medium">MRP</th>
              <th className="text-right px-4 py-3 font-medium">Value</th>
              <th className="text-center px-4 py-3 font-medium">Sales Scheme</th>
              <th className="text-center px-4 py-3 font-medium">Purchase Scheme</th>
              <th className="text-left px-4 py-3 font-medium">Received</th>
              <th className="text-left px-4 py-3 font-medium">Mfg / Expiry</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 font-medium">Invoice</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-white">
                  <div>{m.product}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.code}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{m.company}</td>
                <td className="px-4 py-3 font-mono text-amber-400">
                  <div>{m.batch}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.unit}</div>
                </td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{m.stock}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(m.cost)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(m.purchase)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(m.sale)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(m.mrp)}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(m.value)}</td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{m.sales_scheme}</td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{m.purchase_scheme}</td>
                <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{m.received}</td>
                <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                  <div>{m.mfg}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.exp}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{m.supplier}</td>
                <td className="px-4 py-3 font-mono text-slate-300">
                  <div>{m.invoice_no || '—'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.invoice_date || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    aria-label={`Delete ${m.product}`}
                    onClick={() => removeMapping(m.id)}
                    className="p-1 hover:text-rose-400 text-slate-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
