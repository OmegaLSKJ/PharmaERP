import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  Square,
  Printer
} from 'lucide-react'
import { scanInvoice } from '../../lib/ocr/ocrEngine'
import { parsePharmaInvoice } from '../../lib/ocr/pharmaInvoiceParser'
import { ExtractedInvoice, ExtractedLineItem } from '../../lib/ocr/types'
import { mapExtractedItemsToMaster, MasterItemOption, matchMedicineToMaster } from '../../lib/ocr/medicineMapper'
import { formatCurrency } from '../../lib/utils'
import { getCached } from '../../lib/erpCache'
import BlankSheetModal from '../transactions/BlankSheetModal'

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
  const [showBlankSheetModal, setShowBlankSheetModal] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Load cached ERP items or provide rich defaults for comprehensive master mapping
  const effectiveMasterItems: MasterItemOption[] = useMemo(() => {
    if (masterItems && masterItems.length >= 6) return masterItems

    const cached = getCached<any[]>('items') || []
    if (cached.length > 0) {
      const fromCache: MasterItemOption[] = cached.map((it: any) => ({
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
      if (masterItems && masterItems.length > 0) {
        const existingIds = new Set(masterItems.map(m => m.id || m.itemId))
        return [...masterItems, ...fromCache.filter(c => !existingIds.has(c.id || c.itemId))]
      }
      return fromCache
    }

    const defaultCatalog: MasterItemOption[] = [
      { id: '1', name: 'PAN 40MG TAB', label: 'PAN 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 155, rate: 112.5, purchaseRate: 98, gstRate: 12, stock: 450 },
      { id: '2', name: 'MOXIKIND CV 625 TAB', label: 'MOXIKIND CV 625 TAB', packing: '10\'S', hsn: '30041010', mrp: 220, rate: 168, purchaseRate: 145, gstRate: 12, stock: 280 },
      { id: '3', name: 'TELMA 40MG TAB', label: 'TELMA 40MG TAB', packing: '15\'S', hsn: '30049099', mrp: 135, rate: 98, purchaseRate: 84, gstRate: 12, stock: 520 },
      { id: '4', name: 'AUGMENTIN 625 DUO TAB', label: 'AUGMENTIN 625 DUO TAB', packing: '10\'S', hsn: '30041010', mrp: 240, rate: 185, purchaseRate: 160, gstRate: 12, stock: 190 },
      { id: '5', name: 'DOLO 650 TAB', label: 'DOLO 650 TAB', packing: '15\'S', hsn: '30049099', mrp: 35, rate: 26.5, purchaseRate: 22, gstRate: 12, stock: 950 },
      { id: '6', name: 'AZITHRAL 500 TAB', label: 'AZITHRAL 500 TAB', packing: '5\'S', hsn: '30041010', mrp: 125, rate: 92, purchaseRate: 80, gstRate: 12, stock: 320 },
      { id: '7', name: 'CALPOL 500MG TAB', label: 'CALPOL 500MG TAB', packing: '15\'S', hsn: '30049099', mrp: 32, rate: 24, purchaseRate: 19.5, gstRate: 12, stock: 800 },
      { id: '8', name: 'CEFTUM 500MG TAB', label: 'CEFTUM 500MG TAB', packing: '10\'S', hsn: '30041010', mrp: 480, rate: 375, purchaseRate: 320, gstRate: 12, stock: 140 }
    ]

    return masterItems && masterItems.length > 0 ? [...masterItems, ...defaultCatalog.filter(d => !masterItems.some(m => m.name === d.name))] : defaultCatalog
  }, [masterItems])

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
      if (effectiveMasterItems.length > 0 && result.items.length > 0) {
        result.items = mapExtractedItemsToMaster(result.items, effectiveMasterItems)
      }

      setExtractedData(result)
    } catch (err: any) {
      console.error('OCR Scanning Error:', err)
      setError(err?.message || 'Failed to scan document. Please check the file clarity and try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleLoadSampleA4Sheet = async () => {
    setScanning(true)
    setProgress(20)
    setStatusMessage('Reading Standard A4 Field Order Sheet...')
    setError(null)

    await new Promise((r) => setTimeout(r, 300))
    setProgress(55)
    setStatusMessage('Scanning OCR tabular columns & extracting medicines...')

    await new Promise((r) => setTimeout(r, 300))
    setProgress(85)
    setStatusMessage('Matching medicines against your All Items catalog...')

    const sampleA4SheetText = `
[+ OCR-TL +]                                                                          [+ OCR-TR +]
====================================================================================================
BORGANG DRUG DISTRIBUTORS                                  STANDARD OCR FORM
WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS          SALES ORDER & BOOKING SHEET
Borgang, Biswanath, Assam - 784167 | Ph: +91 6000763703     REF: OCR-SALE-A4/2026
GSTIN: 18AKWPP4417G1ZN | D.L. No: DNG/622/623
----------------------------------------------------------------------------------------------------
CUSTOMER / CHEMIST SHOP NAME: APOLLO PHARMACY & SURGICALS
GSTIN: 18AABCA1234D1ZX   D.L. No: AS/BIS/2024/991
ORDER / SLIP NO: SO-2026/8841     DATE: 28/09/2026     SALES REP: RAHUL SHARMA (REP-04)
====================================================================================================
S.NO | MEDICINE / PRODUCT DESCRIPTION | PACK  | HSN      | BATCH NO  | EXP   | QTY | FREE | RATE   | MRP    | GST% | AMOUNT
----------------------------------------------------------------------------------------------------------------------------
1    | PAN 40MG TAB                   | 15'S  | 30049099 | BAT-8821  | 09/27 | 50  | 5    | 112.50 | 155.00 | 12%  | 5625.00
2    | MOXIKIND CV 625 TAB            | 10'S  | 30041010 | MK-9042   | 11/26 | 30  | 0    | 168.00 | 220.00 | 12%  | 5040.00
3    | TELMA 40MG TAB                 | 15'S  | 30049099 | TL-4410   | 04/28 | 40  | 4    | 98.00  | 135.00 | 12%  | 3920.00
4    | AUGMENTIN 625 DUO TAB          | 10'S  | 30041010 | AG-1190   | 08/27 | 25  | 0    | 185.00 | 240.00 | 12%  | 4625.00
====================================================================================================
ESTIMATED SUB TOTAL: 19210.00 | ESTIMATED TOTAL (WITH GST): 21515.20
[+ OCR-BL +]                                                                          [+ OCR-BR +]
`
    const parsed = parsePharmaInvoice(sampleA4SheetText, 'image_ocr')
    const mapped = mapExtractedItemsToMaster(parsed.items, effectiveMasterItems)

    setProgress(100)
    setStatusMessage('Sample A4 Sheet successfully processed!')
    setExtractedData({
      ...parsed,
      items: mapped
    })
    setScanning(false)
  }

  // Load Minimal Sheet (Where someone ONLY wrote Name + Qty + Free, leaving all other cells blank)
  const handleLoadMinimalA4Sheet = async () => {
    setScanning(true)
    setProgress(20)
    setStatusMessage('Reading Handwritten Order Sheet (Name + Qty + Free only)...')
    setError(null)

    await new Promise((r) => setTimeout(r, 300))
    setProgress(55)
    setStatusMessage('Extracting handwritten Medicine Names and Quantities...')

    await new Promise((r) => setTimeout(r, 300))
    setProgress(85)
    setStatusMessage('Auto-filling Pack, HSN, MRP, Rate, and GST% from All Items...')

    const minimalA4SheetText = `
[+ OCR-TL +]                                                                          [+ OCR-TR +]
====================================================================================================
BORGANG DRUG DISTRIBUTORS                                  STANDARD OCR FORM
WHOLESALE PHARMACEUTICAL DISTRIBUTORS & C&F AGENTS          SALES ORDER & BOOKING SHEET
Borgang, Biswanath, Assam - 784167 | Ph: +91 6000763703     REF: OCR-SALE-A4/2026
GSTIN: 18AKWPP4417G1ZN | D.L. No: DNG/622/623
----------------------------------------------------------------------------------------------------
CUSTOMER / CHEMIST SHOP NAME: APOLLO PHARMACY & SURGICALS
ORDER NO: SO-2026/8841     DATE: 28/09/2026     SALES REP: RAHUL SHARMA (REP-04)
====================================================================================================
S.NO | MEDICINE / PRODUCT DESCRIPTION | PACK | HSN | BATCH NO | EXP | QTY | FREE | RATE | MRP | GST% | AMOUNT
----------------------------------------------------------------------------------------------------
1    | PAN 40MG TAB                   |      |     |          |     | 50  | 5    |      |     |      | 
2    | MOXIKIND CV 625 TAB            |      |     |          |     | 30  | 0    |      |     |      | 
3    | TELMA 40MG TAB                 |      |     |          |     | 40  | 4    |      |     |      | 
4    | AUGMENTIN 625 DUO TAB          |      |     |          |     | 25  | 0    |      |     |      | 
====================================================================================================
[+ OCR-BL +]                                                                          [+ OCR-BR +]
`
    const parsed = parsePharmaInvoice(minimalA4SheetText, 'image_ocr')
    const mapped = mapExtractedItemsToMaster(parsed.items, effectiveMasterItems)

    const lineTotal = mapped.reduce((sum, item) => sum + item.amount, 0)
    const taxTotal = mapped.reduce((sum, item) => sum + (item.amount * item.gstRate) / 100, 0)

    setProgress(100)
    setStatusMessage('Minimal Sheet parsed & enriched with All Items!')
    setExtractedData({
      ...parsed,
      items: mapped,
      totalAmount: Math.round((lineTotal + taxTotal) * 100) / 100,
      taxAmount: Math.round(taxTotal * 100) / 100
    })
    setScanning(false)
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

    // If mapped item changed by user dropdown selection from All Items
    if (field === 'mappedItemId') {
      const selectedMaster = effectiveMasterItems.find((m) => (m.id || m.itemId) === value)
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
        if (selectedMaster.purchaseRate) item.purchaseRate = selectedMaster.purchaseRate
        else if (selectedMaster.rate) item.purchaseRate = Math.round(selectedMaster.rate * 0.8 * 100) / 100
        if (selectedMaster.mrp) item.mrp = selectedMaster.mrp
        item.stock = selectedMaster.stock ?? 0

        const effRate = item.saleRate > 0 ? item.saleRate : (item.purchaseRate > 0 ? item.purchaseRate : (item.mrp || 100))
        item.amount = Math.round((item.qty || 1) * effRate * 100) / 100
      } else if (value === 'unmapped') {
        item.mappedItemId = undefined
        item.mappedItemName = undefined
        item.matchStatus = 'unmapped'
        item.matchScore = 0
      }
    }

    // Recompute amount if qty or rate changed
    if (field === 'qty' || field === 'purchaseRate' || field === 'saleRate' || field === 'mrp') {
      const q = field === 'qty' ? Number(value) : item.qty
      const r = field === 'saleRate' || field === 'purchaseRate'
        ? Number(value)
        : (item.saleRate > 0 ? item.saleRate : (item.purchaseRate > 0 ? item.purchaseRate : item.mrp))
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

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[99990] bg-black/75 backdrop-blur-sm flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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

          {/* Quick Blank Sheet & Testing Toolbar */}
          {!extractedData && !scanning && (
            <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Printer size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    Standard A4 Transaction Sheet Template
                    <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      OCR-Ready
                    </span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Print a clean blank sheet for field reps, or test the OCR instantly with a pre-filled sample.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowBlankSheetModal(true)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-secondary text-foreground text-xs font-semibold border border-border shadow-xs transition cursor-pointer"
                >
                  <Printer size={13} /> Print Blank Sheet
                </button>
                <button
                  type="button"
                  onClick={handleLoadMinimalA4Sheet}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Test handwriting scenario where only Name, Qty, and Free Qty are entered"
                >
                  <Sparkles size={13} /> Test Minimal (Name + Qty + Free)
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleA4Sheet}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Test full A4 sheet with all 12 columns pre-filled"
                >
                  <Sparkles size={13} /> Test Full 12-Col Sample
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

              {/* Auto-Enrichment Notification Banner */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-500/20 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    ✓ AUTO-MAPPING
                  </span>
                  <span className="text-foreground font-medium">
                    When only <strong>Medicine Name</strong> & <strong>Qty</strong> (and <strong>Free Qty</strong>) are written, <strong>All Items Master</strong> automatically fills Pack, HSN, MRP, Rate, and GST%.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Search size={13} className="text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search items…"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="bg-card border border-border rounded-lg px-2 py-1 text-xs w-32 sm:w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Mapping Review Table */}
              <div className="border border-border rounded-xl overflow-x-auto max-h-[420px] overflow-y-auto shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 select-none">
                    {/* Dual Super Header Row */}
                    <tr className="border-b border-border bg-muted text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-1 text-center w-10">Select</th>
                      <th colSpan={3} className="p-1.5 text-center bg-blue-500/10 text-blue-700 dark:text-blue-300 border-x border-blue-500/20">
                        ✍️ Written on Sheet (OCR Read)
                      </th>
                      <th colSpan={8} className="p-1.5 text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-emerald-500/20">
                        📦 Matched in All Items (ERP Master Catalog)
                      </th>
                      <th className="p-1 w-8"></th>
                    </tr>
                    {/* Detailed Columns Header Row */}
                    <tr className="border-b border-border bg-muted/80 text-[11px] font-semibold text-muted-foreground divide-x divide-border/60">
                      <th className="p-2 w-10 text-center">Confirm</th>
                      
                      {/* Written Columns */}
                      <th className="p-2 min-w-[170px] bg-blue-500/5 text-blue-900 dark:text-blue-200">Written Medicine Name</th>
                      <th className="p-2 w-16 text-right bg-blue-500/5 text-blue-900 dark:text-blue-200">Qty</th>
                      <th className="p-2 w-14 text-right bg-blue-500/5 text-blue-900 dark:text-blue-200">Free</th>

                      {/* Master Catalog Columns */}
                      <th className="p-2 min-w-[210px] bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">ERP Item (All Items)</th>
                      <th className="p-2 w-16 text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">Stock</th>
                      <th className="p-2 w-14 text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">Pack</th>
                      <th className="p-2 w-20 text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">HSN</th>
                      <th className="p-2 w-20 text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">Rate (₹)</th>
                      <th className="p-2 w-20 text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">MRP (₹)</th>
                      <th className="p-2 w-14 text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">GST %</th>
                      <th className="p-2 w-24 text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 font-bold">Total (₹)</th>

                      <th className="p-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {extractedData.items
                      .map((item, originalIdx) => ({ item, originalIdx }))
                      .filter(({ item }) => {
                        if (!filterText) return true
                        const q = filterText.toLowerCase()
                        return (
                          item.itemName.toLowerCase().includes(q) ||
                          (item.mappedItemName && item.mappedItemName.toLowerCase().includes(q))
                        )
                      })
                      .map(({ item, originalIdx: idx }) => {
                        const isConfirmed = item.isConfirmed ?? false
                        const status = item.matchStatus || 'unmapped'

                        return (
                          <tr
                            key={item.id || idx}
                            className={`divide-x divide-border/40 transition-colors ${
                              isConfirmed ? 'bg-card hover:bg-muted/20' : 'bg-muted/10 opacity-80 hover:opacity-100'
                            }`}
                          >
                            {/* 1. Confirm Checkbox */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleConfirm(idx)}
                                className={`p-1 rounded transition cursor-pointer ${
                                  isConfirmed
                                    ? 'text-emerald-600 hover:text-emerald-700'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title={isConfirmed ? 'Confirmed (Ready to add)' : 'Click to confirm'}
                              >
                                {isConfirmed ? (
                                  <CheckCircle2 size={16} className="text-emerald-500" />
                                ) : (
                                  <Square size={16} />
                                )}
                              </button>
                            </td>

                            {/* 2. Written Medicine Name (OCR) */}
                            <td className="p-2 bg-blue-500/[0.02]">
                              <input
                                type="text"
                                value={item.itemName}
                                onChange={(e) => handleUpdateItem(idx, 'itemName', e.target.value)}
                                className="w-full bg-card border border-blue-200 dark:border-blue-900/50 rounded px-2 py-1 text-xs font-semibold text-foreground focus:ring-1 focus:ring-blue-500"
                                title="Original handwriting extracted by OCR"
                              />
                            </td>

                            {/* 3. Written Qty */}
                            <td className="p-2 bg-blue-500/[0.02]">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                                className="w-full bg-card border border-blue-200 dark:border-blue-900/50 rounded px-1.5 py-1 text-xs text-right font-bold text-blue-700 dark:text-blue-300"
                                title="Quantity read from sheet"
                              />
                            </td>

                            {/* 4. Written Free Qty */}
                            <td className="p-2 bg-blue-500/[0.02]">
                              <input
                                type="number"
                                value={item.freeQty}
                                onChange={(e) => handleUpdateItem(idx, 'freeQty', e.target.value)}
                                className="w-full bg-card border border-blue-200 dark:border-blue-900/50 rounded px-1.5 py-1 text-xs text-right font-bold text-emerald-600 dark:text-emerald-400"
                                title="Free scheme read from sheet"
                              />
                            </td>

                            {/* 5. Mapped Master Medicine Selector (from All Items) */}
                            <td className="p-2 bg-emerald-500/[0.02]">
                              <div className="space-y-1">
                                <select
                                  value={item.mappedItemId || 'unmapped'}
                                  onChange={(e) => handleUpdateItem(idx, 'mappedItemId', e.target.value)}
                                  className="w-full bg-card border border-emerald-300 dark:border-emerald-800/60 rounded px-2 py-1 text-xs font-medium cursor-pointer focus:ring-1 focus:ring-emerald-500"
                                >
                                  {item.mappedItemId && item.mappedItemName ? (
                                    <option value={item.mappedItemId}>{item.mappedItemName}</option>
                                  ) : (
                                    <option value="unmapped">⚠️ Not Mapped - Select Master Item</option>
                                  )}
                                  <optgroup label="Select from All Items Catalog">
                                    {effectiveMasterItems.map((m) => (
                                      <option key={m.id || m.itemId} value={m.id || m.itemId}>
                                        {m.name || m.label} {m.packing ? `(${m.packing})` : ''} - ₹{m.rate || m.mrp}
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
                                      ⚠️ Select from All Items
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 6. Stock in Hand */}
                            <td className="p-2 text-center bg-emerald-500/[0.02]">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                (item.stock ?? 0) > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'
                              }`}>
                                {item.stock ?? '-'}
                              </span>
                            </td>

                            {/* 7. Pack */}
                            <td className="p-2 text-center bg-emerald-500/[0.02]">
                              <span className="text-[11px] font-mono font-medium text-foreground">
                                {item.packing || '10x10'}
                              </span>
                            </td>

                            {/* 8. HSN */}
                            <td className="p-2 text-center bg-emerald-500/[0.02]">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.hsn || '30049099'}
                              </span>
                            </td>

                            {/* 9. Rate (₹) */}
                            <td className="p-2 bg-emerald-500/[0.02]">
                              <input
                                type="number"
                                step="0.01"
                                value={mode === 'purchase' ? item.purchaseRate : (item.saleRate || item.purchaseRate)}
                                onChange={(e) => handleUpdateItem(idx, mode === 'purchase' ? 'purchaseRate' : 'saleRate', e.target.value)}
                                className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                              />
                            </td>

                            {/* 10. MRP (₹) */}
                            <td className="p-2 bg-emerald-500/[0.02]">
                              <input
                                type="number"
                                step="0.01"
                                value={item.mrp}
                                onChange={(e) => handleUpdateItem(idx, 'mrp', e.target.value)}
                                className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-medium"
                              />
                            </td>

                            {/* 11. GST % */}
                            <td className="p-2 text-center bg-emerald-500/[0.02]">
                              <span className="text-[11px] font-medium text-foreground">
                                {item.gstRate || 12}%
                              </span>
                            </td>

                            {/* 12. Amount (₹) */}
                            <td className="p-2 text-right font-bold text-foreground bg-emerald-500/[0.02]">
                              {formatCurrency(item.amount)}
                            </td>

                            {/* 13. Delete Action */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
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

      {showBlankSheetModal && (
        <BlankSheetModal
          isOpen={showBlankSheetModal}
          onClose={() => setShowBlankSheetModal(false)}
          initialMode={mode}
        />
      )}
    </div>,
    document.body
  )
}
