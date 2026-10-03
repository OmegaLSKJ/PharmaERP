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
  Printer,
  Settings,
  Key
} from 'lucide-react'
import { scanInvoice } from '../../lib/ocr/ocrEngine'
import { parsePharmaInvoice } from '../../lib/ocr/pharmaInvoiceParser'
import { ExtractedInvoice, ExtractedLineItem } from '../../lib/ocr/types'
import { mapExtractedItemsToMaster, MasterItemOption, matchMedicineToMaster } from '../../lib/ocr/medicineMapper'
import { PHARMA_MASTER_CATALOG } from '../../lib/ocr/pharmaMasterCatalog'
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  hasGeminiApiKey,
  getStoredGeminiModel,
  setStoredGeminiModel,
  fetchAvailableGeminiModels,
  DEFAULT_GEMINI_CANDIDATE_MODELS
} from '../../lib/ocr/geminiOcrEngine'
import { formatCurrency } from '../../lib/utils'
import { getCached } from '../../lib/erpCache'
import BlankSheetModal from '../transactions/BlankSheetModal'

interface RawTextModalProps {
  isOpen: boolean
  initialText: string
  onClose: () => void
  onReparse: (text: string) => void
}

function RawTextModal({ isOpen, initialText, onClose, onReparse }: RawTextModalProps) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    setText(initialText)
  }, [initialText])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Scanned Document Text & Manual Input</h3>
              <p className="text-[11px] text-muted-foreground">
                Review OCR text, correct any characters, or paste invoice lines directly.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            className="w-full p-3 font-mono text-xs bg-muted/20 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
            placeholder="No text scanned yet. Paste invoice lines here (e.g. DOLO 650 10 30.00, PAN 40 20 146.90)..."
          />
          <p className="text-[11px] text-muted-foreground">
            💡 <strong>Format Tip:</strong> Each line should contain the medicine name followed by quantity and optional rate/MRP. E.g. <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">PAN 40MG TAB 10 38.50</code>
          </p>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onReparse(text)}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Re-parse & Auto-Map to Inventory</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  currentKey: string
  currentModel: string
  onSave: (key: string, model: string) => void
  onSwitchToLocal: () => void
}

function ApiKeyModal({ isOpen, onClose, currentKey, currentModel, onSave, onSwitchToLocal }: ApiKeyModalProps) {
  const [key, setKey] = useState(currentKey)
  const [model, setModel] = useState(currentModel || 'auto')
  const [customModel, setCustomModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string; models?: string[] } | null>(null)

  useEffect(() => {
    setKey(currentKey)
    const knownCandidates: string[] = ['auto', ...DEFAULT_GEMINI_CANDIDATE_MODELS]
    if (knownCandidates.includes(currentModel)) {
      setModel(currentModel)
    } else if (currentModel) {
      setModel('custom')
      setCustomModel(currentModel)
    } else {
      setModel('auto')
    }
  }, [currentKey, currentModel])

  if (!isOpen) return null

  const handleTestKey = async () => {
    if (!key.trim()) {
      setTestResult({ status: 'error', message: 'Please enter an API key first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const models = await fetchAvailableGeminiModels(key.trim())
      if (models && models.length > 0) {
        setTestResult({
          status: 'success',
          message: `Connected successfully! Found ${models.length} supported models (e.g. ${models.slice(0, 3).join(', ')}).`,
          models
        })
      } else {
        setTestResult({
          status: 'error',
          message: 'API key responded, but no models supporting generateContent were found for this key/region.'
        })
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err?.message || 'Failed to connect to Google Gemini API. Please check your network and API key.'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const effectiveModelToSave = model === 'custom' ? (customModel.trim() || 'auto') : model

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Gemini AI Vision Configuration</h3>
              <p className="text-[11px] text-muted-foreground">High-precision multimodal OCR for Indian pharma purchase bills</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Gemini AI Vision provides <strong>near 100% accuracy</strong> on dot-matrix prints, camera photos, Indian medicine brand names, dosage strengths, batches, expiries, and scheme free quantities.
          </p>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded cursor-pointer"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Gemini Vision Model
              </label>
              <button
                type="button"
                disabled={isTesting || !key.trim()}
                onClick={handleTestKey}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>{isTesting ? 'Testing Key…' : 'Test Key & Detect Models'}</span>
              </button>
            </div>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-medium"
            >
              <option value="auto">✨ Auto-detect Best Available Model (Recommended)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fastest, High Accuracy)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
              <option value="gemini-1.5-flash-002">Gemini 1.5 Flash (002)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Low Latency)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
              <option value="custom">Custom Model Name...</option>
            </select>

            {model === 'custom' && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g. gemini-2.5-flash"
                className="mt-2 w-full px-3 py-1.5 text-xs bg-muted/20 border border-border rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            )}
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              {testResult.status === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{testResult.message}</div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-muted-foreground space-y-1.5">
            <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles size={13} />
              <span>Free Tier: 15 Scans / Minute</span>
            </div>
            <p>
              Get your free key from Google AI Studio without needing a credit card:{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                Get Free API Key →
              </a>
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <button
            type="button"
            onClick={() => {
              onSwitchToLocal()
              onClose()
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Use Local Tesseract (Offline)
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(key, effectiveModelToSave)
                onClose()
              }}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Save & Use Gemini
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

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
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'paste'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null)
  const [rawOcrText, setRawOcrText] = useState('')
  const [showRawTextModal, setShowRawTextModal] = useState(false)
  const [pasteInputText, setPasteInputText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showBlankSheetModal, setShowBlankSheetModal] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [ocrEngine, setOcrEngine] = useState<'gemini' | 'tesseract'>('gemini')
  const [geminiApiKey, setGeminiApiKey] = useState(() => getStoredGeminiApiKey())
  const [geminiModel, setGeminiModel] = useState(() => getStoredGeminiModel() || 'auto')
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Load cached ERP items or provide rich defaults for comprehensive master mapping
  const effectiveMasterItems: MasterItemOption[] = useMemo(() => {
    const baseCatalog: MasterItemOption[] = [...PHARMA_MASTER_CATALOG]

    let combined: MasterItemOption[] = []
    if (masterItems && masterItems.length > 0) {
      combined = [...masterItems]
    } else {
      const cached = getCached<any[]>('items') || []
      if (cached.length > 0) {
        combined = cached.map((it: any) => ({
          id: it.id || it.itemId || String(Math.random()),
          itemId: it.id || it.itemId,
          name: it.name || it.itemName || it.label || '',
          label: it.name || it.itemName || it.label || '',
          packing: it.packing || '10x10',
          hsn: it.hsn || it.hsnCode || '30049099',
          mrp: Number(it.mrp || 0),
          rate: Number(it.rate || it.saleRate || 0),
          purchaseRate: Number(it.purchaseRate || 0),
          gstRate: Number(it.gstRate || it.gst || 5),
          stock: Number(it.stock || it.currentStock || 0),
          manufacturer: it.manufacturer || '',
          salt: it.salt || ''
        }))
      }
    }

    const existingNames = new Set(combined.map(c => (c.name || c.label || '').toLowerCase().trim()))
    for (const b of baseCatalog) {
      const nameKey = (b.name || b.label || '').toLowerCase().trim()
      if (!existingNames.has(nameKey)) {
        combined.push(b)
        existingNames.add(nameKey)
      }
    }

    return combined
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

  const handleFileSelect = async (selectedFile: File, explicitKey?: string, explicitModel?: string) => {
    const activeKey = explicitKey || geminiApiKey || getStoredGeminiApiKey()
    const activeModel = explicitModel || geminiModel || getStoredGeminiModel()

    // If Gemini selected but no key is available anywhere, open configuration modal
    if (ocrEngine === 'gemini' && !activeKey && !hasGeminiApiKey()) {
      setPendingFile(selectedFile)
      setShowApiKeyModal(true)
      return
    }

    setFile(selectedFile)
    setError(null)
    setScanning(true)
    setProgress(5)
    setStatusMessage(ocrEngine === 'gemini' ? 'Analyzing invoice with Gemini AI Vision…' : 'Preparing image for OCR scan…')

    try {
      const result = await scanInvoice(
        selectedFile,
        (pct, msg) => {
          setProgress(pct)
          setStatusMessage(msg)
        },
        { engine: ocrEngine, apiKey: activeKey, model: activeModel }
      )

      // Auto-map extracted medicines against master catalog
      if (effectiveMasterItems.length > 0 && result.items.length > 0) {
        result.items = mapExtractedItemsToMaster(result.items, effectiveMasterItems)
      }

      setExtractedData(result)
      setRawOcrText(result.rawText || '')
    } catch (err: any) {
      console.error('OCR Scanning Error:', err)
      if (err?.message === 'GEMINI_API_KEY_REQUIRED' || err?.message === 'INVALID_GEMINI_API_KEY') {
        setPendingFile(selectedFile)
        setShowApiKeyModal(true)
        setError(err?.message === 'INVALID_GEMINI_API_KEY' ? 'Invalid Gemini API Key. Please verify your key.' : 'Please enter your Gemini API Key to use AI Vision.')
      } else {
        setError(err?.message || 'Failed to scan document. Please check the file clarity and try again.')
      }
    } finally {
      setScanning(false)
    }
  }

  const handleSaveApiKey = (key: string, model: string) => {
    setStoredGeminiApiKey(key)
    setGeminiApiKey(key)
    setStoredGeminiModel(model)
    setGeminiModel(model)
    if (pendingFile) {
      const f = pendingFile
      setPendingFile(null)
      void handleFileSelect(f, key, model)
    }
  }

  const handleReparseCustomText = (textToParse: string) => {
    if (!textToParse.trim()) return
    setError(null)
    setScanning(true)
    setProgress(40)
    setStatusMessage('Parsing invoice text and running Pharma NLP matching…')

    setTimeout(() => {
      try {
        const reparsed = parsePharmaInvoice(textToParse, 'image_ocr')
        if (effectiveMasterItems.length > 0 && reparsed.items.length > 0) {
          reparsed.items = mapExtractedItemsToMaster(reparsed.items, effectiveMasterItems)
        }
        setExtractedData(reparsed)
        setRawOcrText(reparsed.rawText || textToParse)
        setShowRawTextModal(false)
      } catch (err: any) {
        setError(err?.message || 'Failed to parse invoice text.')
      } finally {
        setScanning(false)
      }
    }, 50)
  }

  const handleParsePastedText = (text: string) => {
    if (!text.trim()) return
    handleReparseCustomText(text)
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

    // If user edited written medicine name, run real-time NLP matching against master catalog
    if (field === 'itemName' && typeof value === 'string') {
      const nlpMatch = matchMedicineToMaster(value, effectiveMasterItems)
      const matched = nlpMatch.matchedItem
      item.matchScore = nlpMatch.score
      item.matchStatus = nlpMatch.matchStatus
      item.suggestions = nlpMatch.suggestions
      item.matchReasons = nlpMatch.reasons

      if (matched && (nlpMatch.matchStatus === 'exact' || nlpMatch.matchStatus === 'high')) {
        item.mappedItemId = matched.id || matched.itemId
        item.mappedItemName = matched.name || matched.label
        item.isConfirmed = true
        if (matched.hsn) item.hsn = matched.hsn
        if (matched.packing) item.packing = matched.packing
        if (matched.gstRate) item.gstRate = matched.gstRate
        if (matched.rate) item.saleRate = matched.rate
        if (matched.purchaseRate) item.purchaseRate = matched.purchaseRate
        else if (matched.rate) item.purchaseRate = Math.round(matched.rate * 0.8 * 100) / 100
        if (matched.mrp) item.mrp = matched.mrp
        item.stock = matched.stock ?? 0

        const effRate = item.saleRate > 0 ? item.saleRate : (item.purchaseRate > 0 ? item.purchaseRate : (item.mrp || 100))
        item.amount = Math.round((item.qty || 1) * effRate * 100) / 100
      } else if (!matched) {
        item.mappedItemId = undefined
        item.mappedItemName = undefined
        item.matchStatus = 'unmapped'
      }
    }

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

  const handleReRunNlpMapping = () => {
    if (!extractedData) return
    const remapped = mapExtractedItemsToMaster(extractedData.items, effectiveMasterItems)
    setExtractedData({
      ...extractedData,
      items: remapped
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
    <div className="fixed inset-0 z-[99990] bg-black/75 backdrop-blur-sm flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto no-print">
      <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 flex-wrap">
                {getModeTitle()}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ocrEngine === 'gemini' ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span>✨ Gemini AI Vision {geminiModel && geminiModel !== 'auto' ? `(${geminiModel.replace(/^gemini-/, '')})` : ''}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowApiKeyModal(true)
                        }}
                        title="Configure Gemini API Key & Vision Model"
                        className="hover:text-foreground text-muted-foreground transition p-0.5 ml-0.5 cursor-pointer"
                      >
                        <Settings size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span>Local Tesseract (Offline)</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const next = ocrEngine === 'gemini' ? 'tesseract' : 'gemini'
                      setOcrEngine(next)
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline transition ml-0.5 cursor-pointer font-normal"
                  >
                    Switch to {ocrEngine === 'gemini' ? 'Local Tesseract' : 'Gemini AI Vision'}
                  </button>
                </div>
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
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText size={14} /> Paste / Type Invoice Text
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

          {/* 3. Paste Invoice Text */}
          {!extractedData && !scanning && activeTab === 'paste' && (
            <div className="border border-border bg-card rounded-2xl p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" /> Paste Invoice Text / Order Message
                </h3>
                <p className="text-xs text-muted-foreground">
                  Paste copied text from digital PDFs, Marg/Tally bills, WhatsApp orders, or physical sheets. The NLP Engine will auto-detect medicines, pack sizes, quantities, and rates.
                </p>
              </div>

              <textarea
                value={pasteInputText}
                onChange={(e) => setPasteInputText(e.target.value)}
                placeholder="Example:&#10;1 25 10's PENTAB 40 TAB 3004 REE EV260080 Mar-28 168.09 38.50 962.50&#10;2 20 10'S PENTAB-DSR CAP 3004 ALEM EV6232003 Feb-28 145.21 38.50 770.00&#10;DOLO 650 TAB 50 30.00&#10;TELMA 40 TAB 20 45.00"
                rows={10}
                className="w-full p-3 font-mono text-xs bg-muted/20 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPasteInputText('')}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={!pasteInputText.trim()}
                  onClick={() => handleParsePastedText(pasteInputText)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <Sparkles size={14} /> Parse & Auto-Map to Inventory
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
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">
                  {error}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-destructive/15 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setOcrEngine('tesseract')
                    if (file) {
                      void handleFileSelect(file)
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Sparkles size={13} />
                  Switch to Local Tesseract (Offline)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApiKeyModal(true)
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-card hover:bg-secondary border border-border text-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Settings size={13} />
                  Change Gemini Key / Model
                </button>
                {ocrEngine === 'gemini' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoredGeminiModel('auto')
                      setGeminiModel('auto')
                      if (file) {
                        void handleFileSelect(file, undefined, 'auto')
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <RefreshCw size={13} />
                    Retry with Auto Model Detection
                  </button>
                )}
              </div>
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
                    onClick={handleReRunNlpMapping}
                    title="Re-run Pharma NLP Engine across all medicines"
                    className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold transition cursor-pointer"
                  >
                    <Sparkles size={12} className="text-emerald-600" />
                    <span>Re-run NLP Match</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRawTextModal(true)}
                    title="View, edit, or re-parse the raw text extracted by OCR"
                    className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary font-semibold transition cursor-pointer"
                  >
                    <FileText size={12} className="text-muted-foreground" />
                    <span>Raw Text</span>
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

              {/* Alert when 0 items were extracted */}
              {totalItemsCount === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="font-bold">No medicine line items were auto-detected from this document</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        The header was read, but the table items could not be parsed automatically. Click below to view the raw OCR text, paste invoice lines directly, or add items manually.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRawTextModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      View / Edit OCR Text
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground font-semibold text-xs hover:bg-secondary transition cursor-pointer"
                    >
                      + Add Row Manually
                    </button>
                  </div>
                </div>
              )}

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

                                {/* Status Badge & Reasons */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {status === 'exact' && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      ✓ Exact Match
                                    </span>
                                  )}
                                  {status === 'high' && (
                                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                      NLP Match: {Math.round((item.matchScore || 0.8) * 100)}%
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
                                  {item.matchReasons && item.matchReasons.length > 0 && (
                                    <span className="text-[9px] text-muted-foreground italic truncate max-w-[130px]" title={item.matchReasons.join(' • ')}>
                                      ({item.matchReasons[0]})
                                    </span>
                                  )}
                                </div>

                                {/* Quick Click Suggestions for 1-Click Mapping */}
                                {item.suggestions && item.suggestions.length > 0 && status !== 'exact' && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                      <Sparkles size={9} className="text-amber-500" /> Suggest:
                                    </span>
                                    {item.suggestions.slice(0, 2).map((sug: any) => (
                                      <button
                                        key={sug.id || sug.itemId}
                                        type="button"
                                        onClick={() => handleUpdateItem(idx, 'mappedItemId', sug.id || sug.itemId)}
                                        className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded px-1 py-0.5 font-medium transition cursor-pointer truncate max-w-[125px]"
                                        title={`Map to ${sug.name || sug.label}`}
                                      >
                                        {sug.name || sug.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
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

      {showRawTextModal && (
        <RawTextModal
          isOpen={showRawTextModal}
          initialText={rawOcrText}
          onClose={() => setShowRawTextModal(false)}
          onReparse={handleReparseCustomText}
        />
      )}

      {showApiKeyModal && (
        <ApiKeyModal
          isOpen={showApiKeyModal}
          currentKey={geminiApiKey}
          currentModel={geminiModel}
          onClose={() => setShowApiKeyModal(false)}
          onSave={handleSaveApiKey}
          onSwitchToLocal={() => setOcrEngine('tesseract')}
        />
      )}
    </div>,
    document.body
  )
}
