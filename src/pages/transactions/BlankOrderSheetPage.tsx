import React, { useState } from 'react'
import { Printer, Sparkles, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import BlankTransactionSheetPrint from '../../components/transactions/BlankTransactionSheetPrint'
import InvoiceOcrModal from '../../components/ocr/InvoiceOcrModal'
import { getCached } from '../../lib/erpCache'
import { MasterItemOption } from '../../lib/ocr/medicineMapper'

export default function BlankOrderSheetPage() {
  const [mode, setMode] = useState<'sale' | 'purchase' | 'challan'>('sale')
  const [partyName, setPartyName] = useState('APOLLO PHARMACY & SURGICALS')
  const [salesRepName, setSalesRepName] = useState('RAHUL SHARMA (REP-04)')
  const [rowCount, setRowCount] = useState<number>(25)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)

  // Load cached ERP items or provide defaults for live matching
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
        stock: Number(it.stock || it.currentStock || 0),
        manufacturer: it.manufacturer || '',
        salt: it.salt || ''
      }))
    : [
        { id: '1', name: 'PAN 40MG TAB', label: 'PAN 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 155, rate: 112.5, purchaseRate: 98, gstRate: 12 },
        { id: '2', name: 'MOXIKIND CV 625 TAB', label: 'MOXIKIND CV 625 TAB', packing: '10\'S', hsn: '30041010', mrp: 220, rate: 168, purchaseRate: 145, gstRate: 12 },
        { id: '3', name: 'TELMA 40MG TAB', label: 'TELMA 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 135, rate: 98, purchaseRate: 84, gstRate: 12 },
        { id: '4', name: 'AUGMENTIN 625 DUO TAB', label: 'AUGMENTIN 625 DUO TAB', packing: '10\'S', hsn: '30041010', mrp: 240, rate: 185, purchaseRate: 160, gstRate: 12 }
      ]

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 print:p-0 print:bg-white text-slate-900 dark:text-slate-100">
      
      {/* Top Controls Bar - Hidden when printing */}
      <div className="max-w-[210mm] mx-auto mb-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              to="/transactions/sale"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Back to Sales"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Standard A4 Transaction Sheet
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                  OCR-Optimized
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Print for sales reps to record manual orders, then scan directly into PharmaERP using OCR.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOcrModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Sparkles size={14} /> Test OCR Now
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer size={15} /> Print Sheet (A4)
            </button>
          </div>
        </div>

        {/* Configuration Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Sheet Format</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="sale">Sales Order Sheet (Rep Order Booking)</option>
              <option value="purchase">Purchase Order Sheet</option>
              <option value="challan">Delivery Challan Sheet</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Chemist / Party Name</label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Leave blank for field entry"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Sales Rep / Booked By</label>
            <input
              type="text"
              value={salesRepName}
              onChange={(e) => setSalesRepName(e.target.value)}
              placeholder="Rep name & code"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Row Density</label>
            <select
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            >
              <option value={15}>15 Rows (Spacious handwriting)</option>
              <option value={20}>20 Rows (Balanced)</option>
              <option value={25}>25 Rows (Standard 25-row A4 - Recommended)</option>
            </select>
          </div>
        </div>

        {/* Quick Links banner */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-4">
            <a
              href="/blank_sales_order_sheet_a4.html"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <FileText size={13} /> Open Standalone Blank Sheet (.html)
            </a>
            <a
              href="/sample_filled_order_sheet.html"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <FileText size={13} /> Open Pre-Filled Sample Sheet (.html)
            </a>
          </div>
          <span className="text-[11px] text-slate-400">
            Precision 210mm × 297mm · Ready for laser printing
          </span>
        </div>
      </div>

      {/* A4 Sheet Container */}
      <div className="flex justify-center print:block">
        <div className="shadow-2xl print:shadow-none bg-white">
          <BlankTransactionSheetPrint
            mode={mode}
            partyName={partyName}
            repName={salesRepName}
            rowCount={rowCount}
          />
        </div>
      </div>

      {/* OCR Scanner Modal for Immediate Testing */}
      <InvoiceOcrModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        mode={mode}
        masterItems={masterItems}
        onApply={(data) => {
          setTestSuccess(true)
          setShowOcrModal(false)
          setTimeout(() => setTestSuccess(false), 5000)
        }}
      />

      {/* Success Notification Banner */}
      {testSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} />
          <div className="text-xs">
            <strong className="block font-bold">OCR Test Passed!</strong>
            Order items extracted and mapped with inventory master.
          </div>
        </div>
      )}
    </div>
  )
}
