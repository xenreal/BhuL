import React, { useState, useEffect } from "react"
import { FileText, Shield } from "lucide-react"

interface ProcessingStateProps {
  fileName: string
  fileSize?: number
  previewUrl?: string | null
}

const PROCESSING_STEPS = [
  "Analyzing document layout & script...",
  "Reading Jamabandi revenue columns...",
  "Extracting landowner names & parcel numbers...",
  "Computing plot area conversions & fractional shares...",
  "Running cadastral cross-validation checks...",
]

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  fileName,
  fileSize,
  previewUrl,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [dots, setDots] = useState("")

  // Cycle through dots: . -> .. -> ... -> ""
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 450)
    return () => clearInterval(dotInterval)
  }, [])

  // Cycle through step messages
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % PROCESSING_STEPS.length)
    }, 4000)
    return () => clearInterval(stepInterval)
  }, [])

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 sm:p-12 shadow-xl backdrop-blur-xs transition-all">
        
        {/* Processing Circle Animation */}
        <div className="relative mx-auto mb-8 flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center">
          {/* Subtle Outer pulsing halo */}
          <div className="absolute inset-0 rounded-full bg-amber-200/40 animate-ping opacity-35" />
          
          {/* Outer dashed spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#9b673c]/30 animate-spin [animation-duration:8s]" />
          
          {/* Main smooth spinning ring with gradient */}
          <div className="absolute inset-1 rounded-full border-4 border-t-[#9b673c] border-r-[#9b673c] border-b-transparent border-l-transparent animate-spin [animation-duration:1.5s]" />

          {/* Center emblem */}
          <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-amber-50 text-[#9b673c] border border-amber-200 shadow-inner">
            <FileText className="h-8 w-8 sm:h-9 sm:w-9 animate-pulse" />
          </div>
        </div>

        {/* Dynamic Title with Animated Dots */}
        <div className="space-y-2 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
            Processing Document
            <span className="inline-block w-8 text-left text-[#9b673c] font-mono">{dots}</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#9b673c] transition-all duration-300">
            {PROCESSING_STEPS[currentStepIndex]}
          </p>
        </div>

        {/* File Details Badge */}
        <div className="mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Thumbnail"
              className="h-12 w-12 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-[#9b673c] shrink-0">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {fileName}
            </p>
            {fileSize && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {(fileSize / (1024 * 1024)).toFixed(2)} MB • Active Extraction
              </p>
            )}
          </div>
        </div>

        {/* Bottom Reassurance Banner */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>Automated revenue extraction with multi-rule validation checks</span>
        </div>

      </div>
    </div>
  )
}

