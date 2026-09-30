import React, { useState } from 'react'
import { Printer, X, FileText, Download, Check, Sparkles } from 'lucide-react'
import BlankTransactionSheetPrint, { BlankSheetMode } from './BlankTransactionSheetPrint'
import PrintButton from '../common/PrintButton'

interface BlankSheetModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: BlankSheetMode
  initialParty?: string
}

export default function BlankSheetModal({
  isOpen,
  onClose,
  initialMode = 'sale',
  initialParty = ''
}: BlankSheetModalProps) {
  const [mode, setMode] = useState<BlankSheetMode>(initialMode)
  const [partyName, setPartyName] = useState(initialParty)
  const [partyGstin, setPartyGstin] = useState('')
  const [repName, setRepName] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-GB'))
  const [sheetNo, setSheetNo] = useState('')
  const [rowCount, setRowCount] = useState<number>(15)

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-card text-foreground border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Hidden on Print) */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                Print Blank A4 Order & Entry Sheet
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                  OCR-Optimized Grid
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Give these blank sheets to sales reps or warehouse managers to note down orders for OCR scanning
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

        {/* Configuration Controls Bar (Hidden on Print) */}
        <div className="px-5 py-3 border-b border-border bg-muted/10 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs no-print">
          <div>
            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Sheet Format</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as BlankSheetMode)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <option value="sale">Sales Rep Order Sheet</option>
              <option value="purchase">Purchase Goods Inward Sheet</option>
              <option value="challan">Delivery Challan Dispatch Sheet</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Party / Chemist (Optional)</label>
            <input
              type="text"
              placeholder="Leave blank for field rep"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Sales Rep / Manager</label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Rows per Page</label>
            <select
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <option value={15}>15 Rows (Large writing room)</option>
              <option value={18}>18 Rows (Standard A4 fit)</option>
              <option value={22}>22 Rows (Compact / high item density)</option>
            </select>
          </div>
        </div>

        {/* Live A4 Sheet Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900/60 flex justify-center">
          <div className="bg-white shadow-xl rounded border border-gray-300 w-full max-w-[210mm] overflow-x-auto">
            <BlankTransactionSheetPrint
              mode={mode}
              partyName={partyName}
              partyGstin={partyGstin}
              repName={repName}
              date={date}
              sheetNo={sheetNo}
              rowCount={rowCount}
            />
          </div>
        </div>

        {/* Bottom Actions Bar (Hidden on Print) */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/20 no-print">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-blue-500" />
            <span>Printed grid lines align precisely with our OCR scanning engine.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Blank A4 Sheet (Ctrl+P)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
