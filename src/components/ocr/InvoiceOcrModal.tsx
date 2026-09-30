import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileText,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  X,
  Sparkles,
  RefreshCw,
  Check,
  SwitchCamera,
  Search,
  CheckSquare,
  Square
} from 'lucide-react'
import { scanInvoice } from '../../lib/ocr/ocrEngine'
import { ExtractedInvoice, ExtractedLineItem } from '../../lib/ocr/types'
import { mapExtractedItemsToMaster, MasterItemOption, matchMedicineToMaster } from '../../lib/ocr/medicineMapper'
import { formatCurrency } from '../../lib/utils'

export interface InvoiceOcrModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (data: ExtractedInvoice) => void
  masterItems?: MasterItemOption[]
  mode?: 'purchase' | 'sale' | 'challan'
}

export default function InvoiceOcrModal({
  isOpen,
  onClose,
  onApply,
  masterItems = [],
  mode = 'purchase'
}: InvoiceOcrModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Camera State
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Start Camera Stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null)
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err: any) {
      console.warn('Camera access error:', err)
      setCameraError('Unable to access camera directly. You can use the "Take Photo with Phone" button below.')
      setCameraActive(false)
    }
  }, [])

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    setCameraActive(false)
  }, [])

  // Switch camera when tab or facingMode changes
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      void startCamera(facingMode)
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, activeTab, facingMode, startCamera, stopCamera])

  if (!isOpen) return null

  const handleCapturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopCamera()

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `camera-scan-${Date.now()}.png`, { type: 'image/png' })
        void handleFileSelect(capturedFile)
      }
    }, 'image/png')
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setScanning(true)
    setProgress(5)
    setStatusMessage('Preparing image for OCR scan…')

    try {
      const result = await scanInvoice(selectedFile, (pct, msg) => {
        setProgress(pct)
        setStatusMessage(msg)
      })

      // Auto-map extracted medicines against master catalog
      if (masterItems.length > 0 && result.items.length > 0) {
        result.items = mapExtractedItemsToMaster(result.items, masterItems)
      }

      setExtractedData(result)
    } catch (err: any) {
      console.error('OCR Scanning Error:', err)
      setError(err?.message || 'Failed to scan document. Please check the file clarity and try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleUpdateItem = (index: number, field: keyof ExtractedLineItem, value: any) => {
    if (!extractedData) return
    const updated = [...extractedData.items]
    const item = { ...updated[index], [field]: value }

    // If mapped item changed by user dropdown selection
    if (field === 'mappedItemId') {
      const selectedMaster = masterItems.find((m) => (m.id || m.itemId) === value)
      if (selectedMaster) {
        item.mappedItemId = selectedMaster.id || selectedMaster.itemId
        item.mappedItemName = selectedMaster.name || selectedMaster.label
        item.matchStatus = 'exact'
        item.matchScore = 1.0
        item.isConfirmed = true
        if (selectedMaster.hsn) item.hsn = selectedMaster.hsn
        if (selectedMaster.packing) item.packing = selectedMaster.packing
        if (selectedMaster.gstRate) item.gstRate = selectedMaster.gstRate
        if (selectedMaster.rate) item.saleRate = selectedMaster.rate
        if (selectedMaster.mrp) item.mrp = selectedMaster.mrp
      } else if (value === 'unmapped') {
        item.mappedItemId = undefined
        item.mappedItemName = undefined
        item.matchStatus = 'unmapped'
        item.matchScore = 0
      }
    }

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

  const handleToggleConfirm = (index: number) => {
    if (!extractedData) return
    const updated = [...extractedData.items]
    updated[index] = { ...updated[index], isConfirmed: !updated[index].isConfirmed }
    setExtractedData({ ...extractedData, items: updated })
  }

  const handleToggleConfirmAll = () => {
    if (!extractedData) return
    const allConfirmed = extractedData.items.every((it) => it.isConfirmed)
    const updated = extractedData.items.map((it) => ({ ...it, isConfirmed: !allConfirmed }))
    setExtractedData({ ...extractedData, items: updated })
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
      amount: 1000,
      matchStatus: 'unmapped',
      isConfirmed: true
    }
    setExtractedData({
      ...extractedData,
      items: [...extractedData.items, newItem]
    })
  }

  const confirmedCount = extractedData?.items.filter((it) => it.isConfirmed).length || 0
  const mappedCount = extractedData?.items.filter((it) => it.mappedItemId).length || 0
  const totalItemsCount = extractedData?.items.length || 0

  const handleApply = () => {
    if (extractedData) {
      // Transfer only confirmed items
      const confirmedItems = extractedData.items.filter((it) => it.isConfirmed)
      if (confirmedItems.length === 0) {
        setError('Please confirm at least one medicine item before applying.')
        return
      }
      onApply({
        ...extractedData,
        items: confirmedItems
      })
      onClose()
    }
  }

  const getModeTitle = () => {
    switch (mode) {
      case 'sale':
        return 'Scan Prescription / Sale Invoice'
      case 'challan':
        return 'Scan Delivery Challan'
      default:
        return 'Scan Purchase Bill / Invoice'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                {getModeTitle()}
                <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Free Local OCR · Auto-Mapped
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload invoice PDF or take a live camera photo to auto-map medicines with your inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Selector Tabs (Upload vs Camera) */}
        {!extractedData && !scanning && (
          <div className="px-5 pt-3 pb-0 flex items-center gap-2 border-b border-border bg-muted/10">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload size={14} /> Upload Invoice (PDF / Image)
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'camera'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera size={14} /> Take Photo Immediately
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* 1. Upload Dropzone */}
          {!extractedData && !scanning && activeTab === 'upload' && (
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
                    void handleFileSelect(e.target.files[0])
                  }
                }}
              />
              <div className="p-4 rounded-2xl bg-card border border-border shadow-sm group-hover:scale-105 transition-transform text-blue-500 mb-3">
                <Upload size={32} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Drop your document here, or <span className="text-blue-500 hover:underline">browse files</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Supports Marg ERP / Busy / Tally invoices, distributor bills, and photos (PDF, PNG, JPG, WebP)
              </p>
            </div>
          )}

          {/* 2. Live Camera Viewfinder */}
          {!extractedData && !scanning && activeTab === 'camera' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-full max-w-lg aspect-4/3 bg-black rounded-2xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-6 text-center text-muted-foreground space-y-3">
                    <Camera size={44} className="mx-auto text-muted-foreground/60" />
                    <p className="text-xs">Initializing camera viewfinder…</p>
                  </div>
                )}

                {/* Target Alignment Crosshairs */}
                <div className="absolute inset-8 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[11px] font-medium text-white/70 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-xs">
                    Align medicine bill or strip within frame
                  </span>
                </div>

                {/* Camera Flip Switch */}
                {cameraActive && (
                  <button
                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer backdrop-blur-xs"
                    title="Flip Camera"
                  >
                    <SwitchCamera size={16} />
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 max-w-lg w-full">
                  <AlertCircle size={15} />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Action Buttons for Camera */}
              <div className="flex items-center gap-3">
                {cameraActive && (
                  <button
                    onClick={handleCapturePhoto}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <Camera size={16} /> Capture & Scan Medicine
                  </button>
                )}

                {/* Native Mobile Camera Fallback */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      void handleFileSelect(e.target.files[0])
                    }
                  }}
                />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card hover:bg-secondary text-foreground text-xs font-semibold border border-border shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Upload size={14} /> Open Native Mobile Camera
                </button>
              </div>
            </div>
          )}

          {/* 3. Scanning Progress */}
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
                  Running local WebAssembly OCR + Master Medicine Mapping Engine…
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

          {/* 4. Extracted Data & Medicine Mapping View */}
          {extractedData && (
            <div className="space-y-4">
              
              {/* Header Details Card */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-muted/30 border border-border rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Party / Supplier</span>
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
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Invoice / Ref No</span>
                  <input
                    type="text"
                    value={extractedData.invoiceNo}
                    onChange={(e) => setExtractedData({ ...extractedData, invoiceNo: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Date</span>
                  <input
                    type="date"
                    value={extractedData.invoiceDate}
                    onChange={(e) => setExtractedData({ ...extractedData, invoiceDate: e.target.value })}
                    className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Medicine Mapping Stats & Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-foreground">
                    Medicines: <span className="text-blue-600 dark:text-blue-400">{totalItemsCount}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Mapped: {mappedCount} / {totalItemsCount}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-foreground">
                    Confirmed: <span className="text-blue-600 dark:text-blue-400">{confirmedCount}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleConfirmAll}
                    className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary font-semibold transition cursor-pointer"
                  >
                    {confirmedCount === totalItemsCount ? <CheckSquare size={13} className="text-blue-600" /> : <Square size={13} />}
                    <span>{confirmedCount === totalItemsCount ? 'Uncheck All' : 'Confirm All'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setExtractedData(null)
                      setFile(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-secondary cursor-pointer"
                  >
                    <RefreshCw size={12} /> Scan Another
                  </button>
                  <button
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus size={13} /> Add Item
                  </button>
                </div>
              </div>

              {/* Items Mapping Review Table */}
              <div className="border border-border rounded-xl overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b border-border sticky top-0 z-10 text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Confirm</th>
                      <th className="p-2.5 min-w-[180px]">Scanned Medicine (OCR)</th>
                      <th className="p-2.5 min-w-[220px]">Mapped Master Medicine</th>
                      <th className="p-2.5 w-20">HSN</th>
                      <th className="p-2.5 w-24">Batch</th>
                      <th className="p-2.5 w-20">Exp (MM/YY)</th>
                      <th className="p-2.5 w-16 text-right">Qty</th>
                      <th className="p-2.5 w-14 text-right">Free</th>
                      <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                      <th className="p-2.5 w-24 text-right">MRP (₹)</th>
                      <th className="p-2.5 w-16 text-right">GST %</th>
                      <th className="p-2.5 w-24 text-right">Total (₹)</th>
                      <th className="p-2.5 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {extractedData.items.map((item, idx) => {
                      const isConfirmed = item.isConfirmed ?? false
                      const status = item.matchStatus || 'unmapped'

                      return (
                        <tr
                          key={item.id || idx}
                          className={`transition-colors ${
                            isConfirmed ? 'bg-card hover:bg-muted/20' : 'bg-muted/10 opacity-75 hover:opacity-100'
                          }`}
                        >
                          {/* Confirm Checkbox */}
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleToggleConfirm(idx)}
                              className={`p-1 rounded transition cursor-pointer ${
                                isConfirmed
                                  ? 'text-blue-600 hover:text-blue-700'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              title={isConfirmed ? 'Confirmed' : 'Click to confirm'}
                            >
                              {isConfirmed ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>

                          {/* OCR Scanned Name */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                              className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-semibold"
                              title="Original text extracted by OCR"
                            />
                          </td>

                          {/* Mapped Master Medicine Selector */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <select
                                value={item.mappedItemId || 'unmapped'}
                                onChange={(e) => handleUpdateItem(idx, 'mappedItemId', e.target.value)}
                                className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-medium cursor-pointer"
                              >
                                {item.mappedItemId && item.mappedItemName ? (
                                  <option value={item.mappedItemId}>{item.mappedItemName}</option>
                                ) : (
                                  <option value="unmapped">⚠️ Not Mapped - Select Master Item</option>
                                )}
                                <optgroup label="Select from Catalog">
                                  {masterItems.map((m) => (
                                    <option key={m.id || m.itemId} value={m.id || m.itemId}>
                                      {m.name || m.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>

                              {/* Status Badge */}
                              <div className="flex items-center gap-1.5">
                                {status === 'exact' && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    ✓ Exact Match
                                  </span>
                                )}
                                {status === 'high' && (
                                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    Match: {Math.round((item.matchScore || 0.8) * 100)}%
                                  </span>
                                )}
                                {status === 'fuzzy' && (
                                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Fuzzy ({Math.round((item.matchScore || 0.5) * 100)}%)
                                  </span>
                                )}
                                {status === 'unmapped' && (
                                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                    Unmapped
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* HSN */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.hsn}
                              onChange={(e) => handleUpdateItem(idx, 'hsn', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono text-center"
                            />
                          </td>

                          {/* Batch */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.batch}
                              onChange={(e) => handleUpdateItem(idx, 'batch', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono uppercase text-center"
                            />
                          </td>

                          {/* Expiry */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.expiry}
                              onChange={(e) => handleUpdateItem(idx, 'expiry', e.target.value)}
                              placeholder="MM/YY"
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-center font-mono"
                            />
                          </td>

                          {/* Qty */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                            />
                          </td>

                          {/* Free */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.freeQty}
                              onChange={(e) => handleUpdateItem(idx, 'freeQty', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right text-emerald-600 dark:text-emerald-400 font-medium"
                            />
                          </td>

                          {/* Rate */}
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.purchaseRate}
                              onChange={(e) => handleUpdateItem(idx, 'purchaseRate', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                            />
                          </td>

                          {/* MRP */}
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.mrp}
                              onChange={(e) => handleUpdateItem(idx, 'mrp', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                            />
                          </td>

                          {/* GST % */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.gstRate}
                              onChange={(e) => handleUpdateItem(idx, 'gstRate', e.target.value)}
                              className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                            />
                          </td>

                          {/* Amount */}
                          <td className="p-2 text-right font-semibold text-foreground">
                            {formatCurrency(item.amount)}
                          </td>

                          {/* Delete */}
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
                      )
                    })}
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
              disabled={!extractedData || confirmedCount === 0}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Confirm & Add to Voucher ({confirmedCount} {confirmedCount === 1 ? 'item' : 'items'})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
