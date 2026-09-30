import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Printer,
  Download,
  Eye,
  Sparkles,
  CheckCircle2,
  ScanLine,
  ExternalLink,
  X
} from 'lucide-react'
import { BlankSheetMode } from '../../components/transactions/BlankTransactionSheetPrint'
import InvoiceOcrModal from '../../components/ocr/InvoiceOcrModal'
import { MasterItemOption } from '../../lib/ocr/medicineMapper'
import { getCached } from '../../lib/erpCache'
import { useUIStore } from '../../store/uiStore'
import { getTemplateHtmlById } from '../../lib/ocr/templatesContent'

interface TemplateInfo {
  id: string
  title: string
  subtitle: string
  tag: string
  tagColor: string
  mode: BlankSheetMode | 'sample'
  description: string
  columns: string[]
  downloadName: string
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'sale',
    title: 'Sales Order Sheet (A4)',
    subtitle: 'Field Sales Rep Chemist Booking Form',
    tag: 'Sales & Rep Booking',
    tagColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    mode: 'sale',
    description: 'Formatted for sales representatives visiting retail chemist shops. High-contrast grid with 25 writable rows, corner calibration markers, and GST/MRP columns.',
    columns: ['S.No', 'Medicine Description', 'Pack', 'HSN', 'Batch No', 'Exp (MM/YY)', 'Qty', 'Free', 'Rate (₹)', 'MRP (₹)', 'GST%', 'Amount'],
    downloadName: 'PharmaERP_Sales_Order_Sheet_A4.html'
  },
  {
    id: 'purchase',
    title: 'Purchase Order Sheet (A4)',
    subtitle: 'Supplier & Distributor Procurement Form',
    tag: 'Purchase & Inward',
    tagColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    mode: 'purchase',
    description: 'Purchase requisition sheet for pharmaceutical suppliers and C&F distributors with purchase rate, taxable value, GST slab, and credit payment terms.',
    columns: ['S.No', 'Medicine / Product', 'Pack', 'HSN', 'Batch No', 'Exp', 'Order Qty', 'Free', 'Pur Rate', 'MRP', 'GST%', 'Amount'],
    downloadName: 'PharmaERP_Purchase_Order_Sheet_A4.html'
  },
  {
    id: 'challan',
    title: 'Delivery Challan Sheet (A4)',
    subtitle: 'Godown Dispatch & Consignment Slip',
    tag: 'Delivery & Transport',
    tagColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    mode: 'challan',
    description: 'Dispatch challan for branch stock transfers, delivery van runs, and chemist shipments with vehicle number, case count, and receiver sign-off.',
    columns: ['S.No', 'Item Description', 'Pack', 'HSN', 'Batch', 'Exp', 'Disp Qty', 'Free', 'Rate', 'MRP', 'Boxes/Pkgs', 'Remarks'],
    downloadName: 'PharmaERP_Delivery_Challan_Sheet_A4.html'
  },
  {
    id: 'voucher',
    title: 'Accounting Voucher Sheet (A4)',
    subtitle: 'Payment, Receipt, Journal & Contra Slip',
    tag: 'Accounting & Cash',
    tagColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    mode: 'sale',
    description: 'Universal accounting slip for payment, receipt, contra, and journal entries with Debit/Credit columns, UTR/Cheque reference, and audit sign-off.',
    columns: ['S.No', 'Dr/Cr', 'Particulars / Account Head', 'Bill/Inv Ref', 'Narration / Remarks', 'Debit (₹)', 'Credit (₹)'],
    downloadName: 'PharmaERP_Accounting_Voucher_Sheet_A4.html'
  },
  {
    id: 'sample',
    title: 'Pre-Filled Test Sheet (A4)',
    subtitle: 'Ready-Made Sample for Testing OCR',
    tag: 'Test & Calibration',
    tagColor: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    mode: 'sample',
    description: 'Pre-populated sample with 4 standard pharma medicines (PAN 40MG, MOXIKIND CV 625, TELMA 40MG, AUGMENTIN 625) to test OCR immediately without handwriting.',
    columns: ['PAN 40MG TAB', 'MOXIKIND CV 625 TAB', 'TELMA 40MG TAB', 'AUGMENTIN 625 DUO TAB'],
    downloadName: 'PharmaERP_Sample_Test_Sheet_A4.html'
  }
]

export default function OcrTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo>(TEMPLATES[0])
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [ocrSuccess, setOcrSuccess] = useState(false)

  const printIframeRef = useRef<HTMLIFrameElement>(null)

  // Load custom company profile if configured
  const storeCompany = useUIStore((s) => s.company)
  const companyInfo = {
    name: storeCompany.companyName || 'BORGANG DRUG DISTRIBUTORS',
    sub: 'WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS',
    address: `${storeCompany.city || 'Borgang'}, ${storeCompany.state || 'Assam'} - ${storeCompany.pincode || '784167'}`,
    gstin: storeCompany.gstin || '18AKWPP4417G1ZN',
    dlNo: storeCompany.dlNo || 'DNG/622/623',
    phone: storeCompany.phone || '+91 6000763703'
  }

  // Direct 1-Click Print Handler using embedded HTML
  const handleDirectPrint = (template: TemplateInfo) => {
    const html = getTemplateHtmlById(template.id, companyInfo)
    if (printIframeRef.current) {
      printIframeRef.current.srcdoc = html
      printIframeRef.current.onload = () => {
        setTimeout(() => {
          try {
            printIframeRef.current?.contentWindow?.focus()
            printIframeRef.current?.contentWindow?.print()
          } catch {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
              printWindow.document.write(html)
              printWindow.document.close()
              printWindow.focus()
              printWindow.print()
            }
          }
        }, 150)
      }
    } else {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
      }
    }
  }

  // Direct In-Memory HTML File Download (Zero Network latency / Zero 404s)
  const handleDownload = (template: TemplateInfo) => {
    const html = getTemplateHtmlById(template.id, companyInfo)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = template.downloadName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Master Items for OCR matching
  const cachedItems = getCached<any[]>('items') || []
  const masterItems: MasterItemOption[] = cachedItems.length > 0
    ? cachedItems.map((it: any) => ({
        id: it.id || it.itemId || String(Math.random()),
        itemId: it.id || it.itemId,
        name: it.name || it.itemName || it.label || '',
        label: it.name || it.itemName || it.label || '',
        packing: it.packing || '10x10',
        hsn: it.hsn || it.hsnCode || '30049099',
        mrp: Number(it.mrp || 0),
        rate: Number(it.rate || it.saleRate || 0),
        purchaseRate: Number(it.purchaseRate || 0),
        gstRate: Number(it.gstRate || it.gst || 12),
        stock: Number(it.stock || it.currentStock || 0)
      }))
    : [
        { id: '1', name: 'PAN 40MG TAB', label: 'PAN 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 155, rate: 112.5, purchaseRate: 98, gstRate: 12 },
        { id: '2', name: 'MOXIKIND CV 625 TAB', label: 'MOXIKIND CV 625 TAB', packing: '10\'S', hsn: '30041010', mrp: 220, rate: 168, purchaseRate: 145, gstRate: 12 },
        { id: '3', name: 'TELMA 40MG TAB', label: 'TELMA 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 135, rate: 98, purchaseRate: 84, gstRate: 12 },
        { id: '4', name: 'AUGMENTIN 625 DUO TAB', label: 'AUGMENTIN 625 DUO TAB', packing: '10\'S', hsn: '30041010', mrp: 240, rate: 185, purchaseRate: 160, gstRate: 12 }
      ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Hidden print iframe for background 1-click printing */}
      <iframe
        ref={printIframeRef}
        title="Print Frame"
        className="hidden"
        style={{ display: 'none', position: 'fixed', left: '-9999px' }}
      />

      {/* Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
            <ScanLine size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Standard OCR Templates</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                A4 Printable Suite
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Standard 210mm × 297mm pharmaceutical sheets for field sales reps, godowns, and billing desks.
              Print with 1 click, handwrite or fill in orders, and scan directly into vouchers using local OCR.
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowOcrModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Sparkles size={15} /> Test OCR Scanner
          </button>
          <a
            href="/all_a4_sheets_download.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border shadow-xs transition"
          >
            <ExternalLink size={14} /> Open Download Hub
          </a>
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-card border border-border hover:border-blue-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tmpl.tagColor}`}>
                  {tmpl.tag}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  210 × 297 mm
                </span>
              </div>

              <h2 className="text-base font-bold text-foreground group-hover:text-blue-500 transition-colors">
                {tmpl.title}
              </h2>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {tmpl.subtitle}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {tmpl.description}
              </p>

              {/* Column Pills */}
              <div className="border-t border-border/60 pt-3 mb-4">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  OCR Columns:
                </span>
                <div className="flex flex-wrap gap-1">
                  {tmpl.columns.slice(0, 6).map((col) => (
                    <span
                      key={col}
                      className="text-[10px] bg-secondary/80 text-secondary-foreground px-2 py-0.5 rounded border border-border/40 font-mono"
                    >
                      {col}
                    </span>
                  ))}
                  {tmpl.columns.length > 6 && (
                    <span className="text-[10px] text-muted-foreground px-1 self-center">
                      +{tmpl.columns.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-border">
              {/* Primary 1-Click Print Button */}
              <button
                onClick={() => handleDirectPrint(tmpl)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs active:scale-95 transition cursor-pointer"
              >
                <Printer size={15} /> 1-Click Print Sheet (A4)
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Live Preview Button */}
                <button
                  onClick={() => {
                    setSelectedTemplate(tmpl)
                    setShowPreviewModal(true)
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition cursor-pointer"
                >
                  <Eye size={13} /> Preview
                </button>

                {/* Direct Download HTML Button */}
                <button
                  onClick={() => handleDownload(tmpl)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition cursor-pointer"
                >
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Instructions Footer */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
          Method B: How Field Reps & Accounts Use These OCR Sheets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/60">
            <strong className="block text-foreground font-semibold mb-1">1. Print Sheet</strong>
            <p className="text-muted-foreground">Click "1-Click Print" to get a clean A4 sheet with 25 tabular rows and corner OCR calibration anchors.</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/60">
            <strong className="block text-foreground font-semibold mb-1">2. Fill Manually</strong>
            <p className="text-muted-foreground">The sales rep writes medicine names, batch, expiry (MM/YY), and quantities in clear BLOCK CAPITALS.</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/60">
            <strong className="block text-foreground font-semibold mb-1">3. Snap Photo</strong>
            <p className="text-muted-foreground">Use your smartphone camera or upload a scan right inside Sale, Purchase, or Challan entry.</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/60">
            <strong className="block text-foreground font-semibold mb-1">4. Auto-Mapping</strong>
            <p className="text-muted-foreground">The local OCR parses rows and maps medicines against your inventory master for 1-click confirmation.</p>
          </div>
        </div>
      </div>

      {/* Full Sheet Preview Modal - Instant in-memory rendering via srcDoc */}
      {showPreviewModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto no-print">
          <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedTemplate.tagColor}`}>
                  {selectedTemplate.tag}
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  {selectedTemplate.title} - A4 Print Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDirectPrint(selectedTemplate)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Printer size={13} /> Print This Sheet (A4)
                </button>
                <button
                  onClick={() => handleDownload(selectedTemplate)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition cursor-pointer"
                >
                  <Download size={13} /> Download HTML
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Iframe View with srcDoc (Zero 404s, renders instantly) */}
            <div className="flex-1 bg-slate-300/80 dark:bg-slate-950 p-4 sm:p-8 overflow-y-auto flex justify-center items-start">
              <div className="w-[216mm] max-w-full bg-white shadow-2xl rounded-md p-3 flex justify-center">
                <iframe
                  srcDoc={getTemplateHtmlById(selectedTemplate.id, companyInfo)}
                  title={selectedTemplate.title}
                  className="w-full min-h-[305mm] border-none bg-white"
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* OCR Scanner Modal for Testing */}
      <InvoiceOcrModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        mode="sale"
        masterItems={masterItems}
        onApply={(data) => {
          setOcrSuccess(true)
          setShowOcrModal(false)
          setTimeout(() => setOcrSuccess(false), 5000)
        }}
      />

      {/* Success Notification */}
      {ocrSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} />
          <div className="text-xs">
            <strong className="block font-bold">OCR Scan Verified!</strong>
            Order items mapped with inventory master successfully.
          </div>
        </div>
      )}

    </div>
  )
}
