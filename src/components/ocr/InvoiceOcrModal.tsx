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
  Key,
  Cpu,
  Copy,
  Terminal,
  ExternalLink,
  Server
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
import {
  getStoredOllamaEndpoint,
  setStoredOllamaEndpoint,
  getStoredOllamaModel,
  setStoredOllamaModel,
  checkOllamaStatus,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_QWEN_MODELS,
  OllamaStatus
} from '../../lib/ocr/qwenOcrEngine'
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

interface OcrSettingsModalProps {
  isOpen: boolean
  initialTab?: 'qwen' | 'gemini'
  currentKey: string
  currentModel: string
  currentEndpoint: string
  currentOllamaModel: string
  onClose: () => void
  onSaveGemini: (key: string, model: string) => void
  onSaveQwen: (endpoint: string, model: string) => void
  onSwitchToTesseract: () => void
}

function OcrSettingsModal({
  isOpen,
  initialTab = 'qwen',
  currentKey,
  currentModel,
  currentEndpoint,
  currentOllamaModel,
  onClose,
  onSaveGemini,
  onSaveQwen,
  onSwitchToTesseract
}: OcrSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'qwen' | 'gemini'>(initialTab)

  // Local Qwen2-VL / Ollama State
  const [endpoint, setEndpoint] = useState(currentEndpoint || DEFAULT_OLLAMA_ENDPOINT)
  const [ollamaModel, setOllamaModel] = useState(currentOllamaModel || 'qwen2-vl:7b')
  const [customOllamaModel, setCustomOllamaModel] = useState('')
  const [isCheckingOllama, setIsCheckingOllama] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [copiedCmd, setCopiedCmd] = useState(false)

  // Gemini State
  const [key, setKey] = useState(currentKey)
  const [model, setModel] = useState(currentModel || 'auto')
  const [customModel, setCustomModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string; models?: string[] } | null>(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, isOpen])

  useEffect(() => {
    setEndpoint(currentEndpoint || DEFAULT_OLLAMA_ENDPOINT)
    const knownQwen = ['qwen2-vl:7b', 'qwen2-vl:2b', 'qwen2-vl:latest', 'qwen2.5-vl:7b', 'qwen2.5-vl:3b', 'llama3.2-vision:11b', 'llama3.2-vision:latest']
    if (knownQwen.includes(currentOllamaModel)) {
      setOllamaModel(currentOllamaModel)
    } else if (currentOllamaModel) {
      setOllamaModel('custom')
      setCustomOllamaModel(currentOllamaModel)
    } else {
      setOllamaModel('qwen2-vl:7b')
    }
  }, [currentEndpoint, currentOllamaModel])

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

  // Probe Ollama status on open if on Qwen tab
  useEffect(() => {
    if (isOpen && activeTab === 'qwen' && !ollamaStatus) {
      void handleCheckOllama()
    }
  }, [isOpen, activeTab])

  if (!isOpen) return null

  const handleCheckOllama = async () => {
    setIsCheckingOllama(true)
    try {
      const status = await checkOllamaStatus(endpoint)
      setOllamaStatus(status)
      if (status.online && status.detectedVisionModel && ollamaModel !== 'custom') {
        setOllamaModel(status.detectedVisionModel)
      }
    } finally {
      setIsCheckingOllama(false)
    }
  }

  const handleCopyCommand = (cmd: string) => {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(cmd)
      setCopiedCmd(true)
      setTimeout(() => setCopiedCmd(false), 2000)
    }
  }

  const handleTestKey = async () => {
    if (!key.trim()) {
      setTestResult({ status: 'error', message: 'Please enter an API key first.' })
      return
    }

    setIsTestingKey(true)
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
      setIsTestingKey(false)
    }
  }

  const effectiveGeminiModelToSave = model === 'custom' ? (customModel.trim() || 'auto') : model
  const effectiveOllamaModelToSave = ollamaModel === 'custom' ? (customOllamaModel.trim() || 'qwen2-vl:7b') : ollamaModel

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header with Navigation Tabs */}
        <div className="border-b border-border bg-muted/30">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">AI OCR Vision Engine Configuration</h3>
              <p className="text-[11px] text-muted-foreground">Select local offline neural vision or cloud vision for bill reading</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="flex border-t border-border/70 px-4 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('qwen')}
              className={`py-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'qwen'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cpu size={14} />
              <span>🧠 Local Qwen2-VL (Offline AI)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gemini')}
              className={`py-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'gemini'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles size={14} />
              <span>✨ Gemini AI Vision (Cloud)</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Local Qwen2-VL / Ollama */}
        {activeTab === 'qwen' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
              <p className="font-semibold text-purple-700 dark:text-purple-300">
                100% Offline & Private AI Vision Engine
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Qwen2-VL runs on your local machine using Ollama. Zero internet required, zero API costs, and understands complex medicine table layouts, handwriting, rates, and batches.
              </p>
            </div>

            {/* Ollama Endpoint */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Server size={13} className="text-purple-500" />
                  <span>Local Ollama Service URL</span>
                </label>
                <button
                  type="button"
                  onClick={handleCheckOllama}
                  disabled={isCheckingOllama}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isCheckingOllama ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>{isCheckingOllama ? 'Testing…' : 'Test Connection'}</span>
                </button>
              </div>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            {/* Qwen2-VL Model Selector */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Vision Model
              </label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 font-medium"
              >
                <option value="qwen2-vl:7b">Qwen2-VL 7B (Recommended — High Accuracy, ~4.5 GB)</option>
                <option value="qwen2-vl:2b">Qwen2-VL 2B (Ultra-Fast / Low VRAM, ~1.5 GB)</option>
                <option value="qwen2.5-vl:7b">Qwen2.5-VL 7B (Latest Generation Vision)</option>
                <option value="qwen2.5-vl:3b">Qwen2.5-VL 3B</option>
                <option value="llama3.2-vision:11b">Llama 3.2 Vision 11B</option>
                <option value="custom">Custom Installed Model Name…</option>
              </select>

              {ollamaModel === 'custom' && (
                <input
                  type="text"
                  placeholder="e.g. qwen2-vl:latest or my-custom-model"
                  value={customOllamaModel}
                  onChange={(e) => setCustomOllamaModel(e.target.value)}
                  className="w-full mt-2 px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                />
              )}
            </div>

            {/* Connection Status Card */}
            {ollamaStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                  ollamaStatus.online
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                {ollamaStatus.online ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold">
                    {ollamaStatus.online ? '✓ Local Ollama Service is Running!' : 'Ollama Service Not Reachable'}
                  </p>
                  {ollamaStatus.online ? (
                    <p className="text-[11px] opacity-90">
                      Installed models detected:{' '}
                      <span className="font-mono font-bold">
                        {ollamaStatus.models.length > 0 ? ollamaStatus.models.join(', ') : 'None yet'}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      Could not reach Ollama at <code className="font-mono">{endpoint}</code>. Make sure Ollama is downloaded and running on this machine.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Terminal Command to Download & Run */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-black/40 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal size={13} className="text-purple-400" />
                  <span>One-Command Setup in Terminal:</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCommand(`ollama run ${effectiveOllamaModelToSave}`)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedCmd ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>
              <div className="bg-black/60 rounded-lg p-2 font-mono text-[11px] text-purple-300 select-all overflow-x-auto">
                ollama run {effectiveOllamaModelToSave}
              </div>
              <p className="text-[10px] text-slate-400">
                This downloads Qwen2-VL locally (once) and starts the offline vision daemon immediately.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Gemini AI Vision */}
        {activeTab === 'gemini' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Google Gemini AI Vision runs in the cloud and provides near 100% accuracy on Indian pharmacy bills, handwriting, and medicine catalog extraction.
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
                  disabled={isTestingKey || !key.trim()}
                  onClick={handleTestKey}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingKey ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>{isTestingKey ? 'Testing Key…' : 'Test Key & Detect Models'}</span>
                </button>
              </div>

              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-medium"
              >
                <option value="auto">✨ Auto-detect Best Available Model (Recommended)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (GenAI Document AI - Latest & Recommended)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Fastest Layout Parsing)</option>
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
                <option value="gemini-1.5-flash-002">Gemini 1.5 Flash (002)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                <option value="gemini-3.1-pro">Gemini 3.1 Pro (Flagship Reasoning)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
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
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <button
            type="button"
            onClick={() => {
              onSwitchToTesseract()
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
            {activeTab === 'qwen' ? (
              <button
                type="button"
                onClick={() => {
                  onSaveQwen(endpoint, effectiveOllamaModelToSave)
                  onClose()
                }}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Cpu size={14} />
                <span>Save & Use Local Qwen2-VL</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSaveGemini(key, effectiveGeminiModelToSave)
                  onClose()
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Save & Use Gemini</span>
              </button>
            )}
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
  const [ocrEngine, setOcrEngine] = useState<'gemini' | 'qwen' | 'openrouter' | 'tesseract'>('qwen')
  const [geminiApiKey, setGeminiApiKey] = useState(() => getStoredGeminiApiKey())
  const [geminiModel, setGeminiModel] = useState(() => getStoredGeminiModel() || 'auto')
  const [ollamaEndpoint, setOllamaEndpoint] = useState(() => getStoredOllamaEndpoint())
  const [ollamaModel, setOllamaModel] = useState(() => getStoredOllamaModel() || 'qwen2-vl:7b')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'qwen' | 'gemini'>('qwen')
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
      setSettingsTab('gemini')
      setShowSettingsModal(true)
      return
    }

    setFile(selectedFile)
    setError(null)
    setScanning(true)
    setProgress(5)
    setStatusMessage(
      ocrEngine === 'gemini'
        ? 'Analyzing invoice with Gemini AI Vision…'
        : ocrEngine === 'qwen'
        ? `Processing invoice with Local Qwen2-VL (${ollamaModel}) offline…`
        : ocrEngine === 'openrouter'
        ? 'Sending invoice to OpenRouter cloud (Gemma-4 / Qwen3.8 — Free)…'
        : 'Preparing image for local OCR scan…'
    )

    try {
      const result = await scanInvoice(
        selectedFile,
        (pct, msg) => {
          setProgress(pct)
          setStatusMessage(msg)
        },
        {
          engine: ocrEngine,
          apiKey: activeKey,
          model: activeModel,
          endpoint: ollamaEndpoint,
          ollamaModel
        }
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
        setSettingsTab('gemini')
        setShowSettingsModal(true)
        setError(err?.message === 'INVALID_GEMINI_API_KEY' ? 'Invalid Gemini API Key. Please verify your key.' : 'Please enter your Gemini API Key to use AI Vision.')
      } else if (err?.message?.includes('Cannot reach local Ollama') || err?.message?.includes('Failed to communicate with Local Qwen2-VL')) {
        setPendingFile(selectedFile)
        setSettingsTab('qwen')
        setShowSettingsModal(true)
        setError(err.message)
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
      <div className="bg-card text-foreground border border-border w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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
                          setSettingsTab('gemini')
                          setShowSettingsModal(true)
                        }}
                        title="Configure Gemini API Key & Vision Model"
                        className="hover:text-foreground text-muted-foreground transition p-0.5 ml-0.5 cursor-pointer"
                      >
                        <Settings size={12} />
                      </button>
                    </div>
                  ) : ocrEngine === 'openrouter' ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span>🌐 OpenRouter Cloud (Gemma-4-31B — Free)</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const current = typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('OPENROUTER_API_KEY') || '') : ''
                          const key = window.prompt('Enter your OpenRouter API Key (sk-or-v1-...):\n\nGet free key at https://openrouter.ai/keys (no credit card needed):', current)
                          if (key !== null) {
                            localStorage.setItem('openrouter_api_key', key.trim())
                            addToast('OpenRouter API key saved!', 'success')
                          }
                        }}
                        title="Set / Change OpenRouter API Key"
                        className="hover:text-foreground text-muted-foreground transition p-0.5 ml-0.5 cursor-pointer"
                      >
                        <Settings size={12} />
                      </button>
                    </div>
                  ) : ocrEngine === 'qwen' ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      <span>🧠 Local Qwen2-VL ({ollamaModel.replace(/^qwen2-vl:/, '') || '7b'} Offline AI)</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSettingsTab('qwen')
                          setShowSettingsModal(true)
                        }}
                        title="Configure Local Ollama / Qwen2-VL Model"
                        className="hover:text-foreground text-muted-foreground transition p-0.5 ml-0.5 cursor-pointer"
                      >
                        <Settings size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span>Local Tesseract (LSTM tessdata_best)</span>
                    </div>
                  )}

                  {/* Engine toggle buttons */}
                  <button
                    type="button"
                    onClick={() => {
                      if (ocrEngine === 'gemini') {
                        setOcrEngine('qwen')
                      } else {
                        setOcrEngine('gemini')
                      }
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline transition ml-0.5 cursor-pointer font-normal"
                  >
                    Switch to {ocrEngine === 'gemini' ? 'Local Qwen2-VL (Offline AI)' : 'Gemini AI Vision'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOcrEngine(ocrEngine === 'openrouter' ? 'qwen' : 'openrouter')}
                    className="text-[10px] text-muted-foreground hover:text-green-500 transition ml-1 cursor-pointer opacity-70 hover:opacity-100"
                    title="Use free cloud OCR via OpenRouter (Gemma-4-31B, Qwen3.8-27B)"
                  >
                    {ocrEngine === 'openrouter' ? '(Use Local Qwen2-VL)' : '(OpenRouter — Free Cloud)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOcrEngine(ocrEngine === 'tesseract' ? 'qwen' : 'tesseract')
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition ml-1 cursor-pointer opacity-70 hover:opacity-100"
                    title="Toggle legacy browser-based Tesseract"
                  >
                    {ocrEngine === 'tesseract' ? '(Use Qwen2-VL)' : '(Use Tesseract)'}
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
                {ocrEngine === 'openrouter' && (
                  <button
                    type="button"
                    onClick={() => {
                      const current = typeof window !== 'undefined' ? (localStorage.getItem('openrouter_api_key') || localStorage.getItem('OPENROUTER_API_KEY') || '') : ''
                      const key = window.prompt('Enter your OpenRouter API Key (sk-or-v1-...):\n\nGet free key at https://openrouter.ai/keys (no credit card needed):', current)
                      if (key !== null) {
                        localStorage.setItem('openrouter_api_key', key.trim())
                        addToast('OpenRouter API key saved!', 'success')
                        if (file) void handleFileSelect(file)
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Settings size={13} />
                    Set / Change OpenRouter Key
                  </button>
                )}
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
              <div className="border border-border rounded-xl overflow-x-auto max-h-[440px] overflow-y-auto shadow-inner">
                <table className="w-full min-w-[1180px] text-left text-xs">
                  <thead className="sticky top-0 z-10 select-none">
                    {/* Dual Super Header Row */}
                    <tr className="border-b border-border bg-muted text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-1 text-center w-12 min-w-[48px]">Select</th>
                      <th colSpan={3} className="p-1.5 text-center bg-blue-500/10 text-blue-700 dark:text-blue-300 border-x border-blue-500/20">
                        ✍️ Written on Sheet (OCR Read)
                      </th>
                      <th colSpan={8} className="p-1.5 text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-emerald-500/20">
                        📦 Matched in All Items (ERP Master Catalog)
                      </th>
                      <th className="p-1 w-10 min-w-[40px]"></th>
                    </tr>
                    {/* Detailed Columns Header Row */}
                    <tr className="border-b border-border bg-muted/80 text-[11px] font-semibold text-muted-foreground divide-x divide-border/60">
                      <th className="p-2 w-12 min-w-[48px] text-center">Confirm</th>
                      
                      {/* Written Columns */}
                      <th className="p-2 w-52 min-w-[180px] bg-blue-500/5 text-blue-900 dark:text-blue-200">Written Medicine Name</th>
                      <th className="p-2 w-20 min-w-[70px] text-right bg-blue-500/5 text-blue-900 dark:text-blue-200">Qty</th>
                      <th className="p-2 w-18 min-w-[65px] text-right bg-blue-500/5 text-blue-900 dark:text-blue-200">Free</th>

                      {/* Master Catalog Columns */}
                      <th className="p-2 min-w-[240px] bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">ERP Item (All Items)</th>
                      <th className="p-2 w-16 min-w-[58px] text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">Stock</th>
                      <th className="p-2 w-16 min-w-[62px] text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">Pack</th>
                      <th className="p-2 w-24 min-w-[85px] text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">HSN</th>
                      <th className="p-2 w-24 min-w-[85px] text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">Rate (₹)</th>
                      <th className="p-2 w-24 min-w-[85px] text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">MRP (₹)</th>
                      <th className="p-2 w-16 min-w-[55px] text-center bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 whitespace-nowrap">GST %</th>
                      <th className="p-2 w-28 min-w-[100px] text-right bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 font-bold whitespace-nowrap">Total (₹)</th>

                      <th className="p-2 w-10 min-w-[40px] text-center"></th>
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
                            <td className="p-2 text-center w-12 min-w-[48px]">
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
                                className="w-full min-w-[160px] bg-card border border-blue-200 dark:border-blue-900/50 rounded px-2 py-1 text-xs font-semibold text-foreground focus:ring-1 focus:ring-blue-500"
                                title="Original handwriting extracted by OCR"
                              />
                            </td>

                            {/* 3. Written Qty */}
                            <td className="p-2 bg-blue-500/[0.02] text-right">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                                className="w-full min-w-[56px] bg-card border border-blue-200 dark:border-blue-900/50 rounded px-2 py-1 text-xs text-right font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Quantity read from sheet"
                              />
                            </td>

                            {/* 4. Written Free Qty */}
                            <td className="p-2 bg-blue-500/[0.02] text-right">
                              <input
                                type="number"
                                value={item.freeQty}
                                onChange={(e) => handleUpdateItem(idx, 'freeQty', e.target.value)}
                                className="w-full min-w-[50px] bg-card border border-blue-200 dark:border-blue-900/50 rounded px-2 py-1 text-xs text-right font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Free scheme read from sheet"
                              />
                            </td>

                            {/* 5. Mapped Master Medicine Selector (from All Items) */}
                            <td className="p-2 bg-emerald-500/[0.02]">
                              <div className="space-y-1">
                                <select
                                  value={item.mappedItemId || 'unmapped'}
                                  onChange={(e) => handleUpdateItem(idx, 'mappedItemId', e.target.value)}
                                  className="w-full min-w-[210px] bg-card border border-emerald-300 dark:border-emerald-800/60 rounded px-2 py-1 text-xs font-medium cursor-pointer focus:ring-1 focus:ring-emerald-500"
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
                            <td className="p-2 text-center bg-emerald-500/[0.02] whitespace-nowrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                (item.stock ?? 0) > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'
                              }`}>
                                {item.stock ?? '-'}
                              </span>
                            </td>

                            {/* 7. Pack */}
                            <td className="p-2 text-center bg-emerald-500/[0.02] whitespace-nowrap">
                              <span className="text-[11px] font-mono font-medium text-foreground">
                                {item.packing || '10x10'}
                              </span>
                            </td>

                            {/* 8. HSN */}
                            <td className="p-2 text-center bg-emerald-500/[0.02] whitespace-nowrap">
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
                                className="w-full min-w-[76px] bg-card border border-border rounded px-2 py-1 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>

                            {/* 10. MRP (₹) */}
                            <td className="p-2 bg-emerald-500/[0.02]">
                              <input
                                type="number"
                                step="0.01"
                                value={item.mrp}
                                onChange={(e) => handleUpdateItem(idx, 'mrp', e.target.value)}
                                className="w-full min-w-[76px] bg-card border border-border rounded px-2 py-1 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>

                            {/* 11. GST % */}
                            <td className="p-2 text-center bg-emerald-500/[0.02] whitespace-nowrap">
                              <span className="text-[11px] font-medium text-foreground">
                                {item.gstRate || 12}%
                              </span>
                            </td>

                            {/* 12. Amount (₹) */}
                            <td className="p-2 text-right font-bold text-foreground bg-emerald-500/[0.02] whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </td>

                            {/* 13. Delete Action */}
                            <td className="p-2 text-center w-10 min-w-[40px]">
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

      {showSettingsModal && (
        <OcrSettingsModal
          isOpen={showSettingsModal}
          initialTab={settingsTab}
          currentKey={geminiApiKey}
          currentModel={geminiModel}
          currentEndpoint={ollamaEndpoint}
          currentOllamaModel={ollamaModel}
          onClose={() => setShowSettingsModal(false)}
          onSaveGemini={(key, model) => {
            handleSaveApiKey(key, model)
            setOcrEngine('gemini')
          }}
          onSaveQwen={(endpoint, model) => {
            setStoredOllamaEndpoint(endpoint)
            setOllamaEndpoint(endpoint)
            setStoredOllamaModel(model)
            setOllamaModel(model)
            setOcrEngine('qwen')
            if (pendingFile) {
              const f = pendingFile
              setPendingFile(null)
              void handleFileSelect(f)
            }
          }}
          onSwitchToTesseract={() => setOcrEngine('tesseract')}
        />
      )}
    </div>,
    document.body
  )
}
