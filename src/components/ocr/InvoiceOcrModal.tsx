import React, { useState, useRef } from 'react'
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  X,
  FileCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { scanInvoice } from '../../lib/ocr/ocrEngine'
import { ExtractedInvoice, ExtractedLineItem } from '../../lib/ocr/types'
import { formatCurrency } from '../../lib/utils'

interface InvoiceOcrModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (data: ExtractedInvoice) => void
}

export default function InvoiceOcrModal({ isOpen, onClose, onApply }: InvoiceOcrModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setScanning(true)
    setProgress(5)
    setStatusMessage('Preparing file for scan…')

    try {
      const result = await scanInvoice(selectedFile, (pct, msg) => {
        setProgress(pct)
        setStatusMessage(msg)
      })
      setExtractedData(result)
    } catch (err: any) {
      console.error('OCR Error:', err)
      setError(err?.message || 'Failed to scan invoice. Please check the file and try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleUpdateItem = (index: number, field: keyof ExtractedLineItem, value: any) => {
    if (!extractedData) return
    const updated = [...extractedData.items]
    const item = { ...updated[index], [field]: value }

    // Recompute amount if qty or rate changed
    if (field === 'qty' || field === 'purchaseRate') {
      const q = field === 'qty' ? Number(value) : item.qty
      const r = field === 'purchaseRate' ? Number(value) : item.purchaseRate
      item.amount = Math.round(q * r * 100) / 100
    }

    updated[index] = item
    const newTotal = updated.reduce((s, it) => s + it.amount, 0)
    setExtractedData({
      ...extractedData,
      items: updated,
      totalAmount: Math.round(newTotal * 1.12 * 100) / 100
    })
  }

  const handleDeleteItem = (index: number) => {
    if (!extractedData) return
    const updated = extractedData.items.filter((_, i) => i !== index)
    const newTotal = updated.reduce((s, it) => s + it.amount, 0)
    setExtractedData({
      ...extractedData,
      items: updated,
      totalAmount: Math.round(newTotal * 1.12 * 100) / 100
    })
  }

  const handleAddItem = () => {
    if (!extractedData) return
    const newItem: ExtractedLineItem = {
      id: `manual-${Date.now()}`,
      itemName: 'NEW MEDICINE',
      packing: '10x10',
      hsn: '30049099',
      batch: 'BAT1001',
      expiry: '12/28',
      qty: 10,
      freeQty: 0,
      purchaseRate: 100,
      mrp: 140,
      saleRate: 125,
      discount: 0,
      gstRate: 12,
      amount: 1000
    }
    setExtractedData({
      ...extractedData,
      items: [...extractedData.items, newItem]
    })
  }

  const handleApply = () => {
    if (extractedData) {
      onApply(extractedData)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Free Local OCR Bill Scanner
                <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  100% In-Repo · Zero Cost
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Scans PDF distributor invoices & printed paper bills directly on your browser/server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Upload Dropzone */}
          {!extractedData && !scanning && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-blue-500/60 bg-muted/20 hover:bg-blue-500/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0])
                  }
                }}
              />
              <div className="p-4 rounded-2xl bg-card border border-border shadow-sm group-hover:scale-105 transition-transform text-blue-500 mb-3">
                <Upload size={32} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Drop your Purchase Invoice here, or <span className="text-blue-500 hover:underline">browse files</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Supports Marg ERP / Busy / Tally digital PDFs, scanned bills, and camera photos (PDF, PNG, JPG, WebP)
              </p>
            </div>
          )}

          {/* Scanning Progress */}
          {scanning && (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <Loader2 size={44} className="animate-spin text-blue-500" />
                <FileText size={20} className="absolute inset-0 m-auto text-blue-500/70" />
              </div>
              <div className="space-y-1.5 w-full max-w-md">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>{statusMessage}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Running local WebAssembly OCR worker. No cloud API or billing required.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Extracted Data View */}
          {extractedData && (
            <div className="space-y-4">
              {/* Header Details Card */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-muted/30 border border-border rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Supplier</span>
                  <input
                    type="text"
                    value={extractedData.supplierName}
                    onChange={(e) => setExtractedData({ ...extractedData, supplierName: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-semibold"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">GSTIN</span>
                  <input
                    type="text"
                    value={extractedData.supplierGstin}
                    onChange={(e) => setExtractedData({ ...extractedData, supplierGstin: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Invoice No</span>
                  <input
                    type="text"
                    value={extractedData.invoiceNo}
                    onChange={(e) => setExtractedData({ ...extractedData, invoiceNo: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Invoice Date</span>
                  <input
                    type="date"
                    value={extractedData.invoiceDate}
                    onChange={(e) => setExtractedData({ ...extractedData, invoiceDate: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Items Table Header & Action */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Extracted Medicines ({extractedData.items.length})
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                    {extractedData.sourceType === 'digital_pdf' ? 'Direct PDF Table' : 'WASM OCR Recognition'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExtractedData(null)
                      setFile(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-secondary cursor-pointer"
                  >
                    <RefreshCw size={12} /> Scan Another File
                  </button>
                  <button
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus size={13} /> Add Line Item
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-border rounded-xl overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border sticky top-0 z-10 text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Medicine Name</th>
                      <th className="p-2.5 w-20">HSN</th>
                      <th className="p-2.5 w-24">Batch</th>
                      <th className="p-2.5 w-20">Exp (MM/YY)</th>
                      <th className="p-2.5 w-16 text-right">Qty</th>
                      <th className="p-2.5 w-14 text-right">Free</th>
                      <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                      <th className="p-2.5 w-24 text-right">MRP (₹)</th>
                      <th className="p-2.5 w-16 text-right">GST %</th>
                      <th className="p-2.5 w-24 text-right">Amount (₹)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {extractedData.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                            className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleUpdateItem(idx, 'hsn', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.batch}
                            onChange={(e) => handleUpdateItem(idx, 'batch', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono uppercase text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.expiry}
                            onChange={(e) => handleUpdateItem(idx, 'expiry', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-center font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.freeQty}
                            onChange={(e) => handleUpdateItem(idx, 'freeQty', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right text-emerald-600 dark:text-emerald-400 font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.purchaseRate}
                            onChange={(e) => handleUpdateItem(idx, 'purchaseRate', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.mrp}
                            onChange={(e) => handleUpdateItem(idx, 'mrp', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.gstRate}
                            onChange={(e) => handleUpdateItem(idx, 'gstRate', e.target.value)}
                            className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-2 text-right font-semibold text-foreground">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition cursor-pointer"
                            title="Remove item"
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
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-muted/20">
          <div>
            {extractedData && (
              <span className="text-xs text-muted-foreground">
                Total Amount: <span className="font-bold text-foreground">{formatCurrency(extractedData.totalAmount)}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!extractedData || extractedData.items.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={14} /> Apply to Purchase Entry
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
