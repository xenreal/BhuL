import React, { useState } from "react"
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Save,
  Check,
  Building,
  ShieldCheck,
  FileCheck2,
  Loader2,
  Flag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { commitDocument } from "@/lib/api"
import type { UploadResponse } from "@/lib/api"
import { transliterateSentence } from "@/lib/hindiTransliterator"

interface ExtractionReviewViewProps {
  documentData: UploadResponse
  imageUrl: string
  onReset: () => void
  onCommitted?: () => void
}

// Friendly human-readable labels for extracted fields
const FIELD_LABELS: Record<string, string> = {
  "landowner_details.name": "Landowner Names (नाम मालिक)",
  "landowner_details": "Landowner Details",
  "khata_number": "Khata / Khewat No. (खेवट / खाता नं)",
  "khatauni_number": "Khatauni Number (खतौनी नं)",
  "khasra_number": "Khasra Number (खसरा नं)",
  "plot_area": "Plot Area (रकबा)",
  "village": "Village / Mauza (गाँव / मौज़ा)",
  "tehsil": "Tehsil (तहसील)",
  "district": "District (ज़िला)",
  "ownership_details": "Ownership & Shareholding",
  "survey_number": "Survey Number",
}

export const ExtractionReviewView: React.FC<ExtractionReviewViewProps> = ({
  documentData,
  imageUrl,
  onReset,
  onCommitted,
}) => {
  // Zoom state for image viewer
  const [zoomLevel, setZoomLevel] = useState(1)
  
  // Track field values (allows inline Patwari corrections)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    documentData.fields.forEach((f) => {
      if (typeof f.value === "object" && f.value !== null) {
        if ("value" in f.value && "unit" in f.value) {
          initial[f.field_name] = `${f.value.value} ${f.value.unit}`
        } else {
          initial[f.field_name] = JSON.stringify(f.value)
        }
      } else {
        initial[f.field_name] = f.value !== null && f.value !== undefined ? String(f.value) : ""
      }
    })
    return initial
  })

  // Track original values to detect diffs for commit
  const originalValues = React.useMemo(() => {
    const orig: Record<string, string> = {}
    documentData.fields.forEach((f) => {
      if (typeof f.value === "object" && f.value !== null) {
        if ("value" in f.value && "unit" in f.value) {
          orig[f.field_name] = `${f.value.value} ${f.value.unit}`
        } else {
          orig[f.field_name] = JSON.stringify(f.value)
        }
      } else {
        orig[f.field_name] = f.value !== null && f.value !== undefined ? String(f.value) : ""
      }
    })
    return orig
  }, [documentData])

  // Commit state
  const [isCommitting, setIsCommitting] = useState(false)
  const [isCommitted, setIsCommitted] = useState(documentData.status === "committed")
  const [commitMessage, setCommitMessage] = useState<string | null>(null)

  // Phonetic Hindi typing toggle (enabled by default for Indian Land Records)
  const [hindiTypingEnabled, setHindiTypingEnabled] = useState(true)

  // Mobile/Tablet responsive view mode: 'both' | 'scan' | 'fields'
  const [mobileTab, setMobileTab] = useState<"both" | "scan" | "fields">("both")

  const handleFieldChange = (fieldName: string, newVal: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: newVal,
    }))
  }

  // Real-time phonetic transliteration: triggers when space or delimiter is typed
  const handleInputChange = (fieldName: string, rawVal: string) => {
    if (hindiTypingEnabled && (rawVal.endsWith(" ") || rawVal.endsWith(","))) {
      const converted = transliterateSentence(rawVal)
      handleFieldChange(fieldName, converted)
    } else {
      handleFieldChange(fieldName, rawVal)
    }
  }

  // Transliterates any remaining English phonetics on blur
  const handleInputBlur = (fieldName: string) => {
    if (hindiTypingEnabled) {
      const val = fieldValues[fieldName] ?? ""
      if (/[a-zA-Z]/.test(val)) {
        handleFieldChange(fieldName, transliterateSentence(val))
      }
    }
  }

  // Count how many fields were edited
  const editedCount = Object.keys(fieldValues).filter(
    (k) => fieldValues[k] !== originalValues[k]
  ).length

  const handleCommit = async () => {
    setIsCommitting(true)
    setCommitMessage(null)

    // Build corrections dictionary of changed values
    const corrections: Record<string, any> = {}
    Object.keys(fieldValues).forEach((key) => {
      if (fieldValues[key] !== originalValues[key]) {
        corrections[key] = fieldValues[key]
      }
    })

    try {
      await commitDocument(documentData.document_id, corrections)
      setIsCommitted(true)
      setCommitMessage(
        editedCount > 0
          ? `Record committed with ${editedCount} field correction(s) logged to learning memory.`
          : "Record verified and successfully committed to registry."
      )
      if (onCommitted) {
        onCommitted()
      }
    } catch (err: any) {
      setCommitMessage(err.message || "Failed to commit document to database.")
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Upload New Document
          </Button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Document ID:
            </span>
            <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
              {documentData.document_id.slice(0, 13)}...
            </code>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Status Badge */}
          {isCommitted ? (
            <Badge variant="verified" className="px-3 py-1 text-xs">
              <Check className="mr-1 h-3.5 w-3.5" />
              Committed to Registry
            </Badge>
          ) : documentData.status === "verified" ? (
            <Badge variant="confident" className="px-3 py-1 text-xs">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Verified (High Confidence)
            </Badge>
          ) : (
            <Badge variant="unsure" className="px-3 py-1 text-xs">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              Review Required (Flagged)
            </Badge>
          )}

          <Badge variant="outline" className="text-xs bg-white text-slate-600">
            Region: {documentData.region}
          </Badge>
        </div>
      </div>

      {/* Commit Feedback Banner */}
      {commitMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-3 border shadow-xs animate-in fade-in ${
            isCommitted
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {isCommitted ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{commitMessage}</span>
        </div>
      )}

      {/* Responsive Mobile/Tablet Segmented Switcher (< lg viewports) */}
      <div className="flex lg:hidden items-center justify-between p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileTab("fields")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === "fields"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📝 Extracted Data
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("scan")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === "scan"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📄 Document Scan
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("both")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === "both"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          ⬍ Both
        </button>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT SIDE: Original Document Scan Viewer ================= */}
        <div className={`lg:col-span-5 xl:col-span-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[460px] sm:h-[580px] lg:h-[780px] ${
          mobileTab === "fields" ? "hidden lg:flex" : "flex"
        }`}>
          
          {/* Image Viewer Header & Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-[#9b673c]" />
              Original Document Scan
            </span>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-600 select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded border-l border-slate-100 ml-0.5"
                title="Reset Zoom"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Image Area */}
          <div className="flex-1 overflow-auto bg-slate-100/60 p-4 flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Uploaded scan"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
              className="max-w-full rounded shadow-md border border-slate-300 transition-transform duration-150"
            />
          </div>

          {/* Footer Guide */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Inspect handwritten Devanagari / Urdu / English text</span>
            <span className="font-mono">Use zoom controls to inspect</span>
          </div>

        </div>


        {/* ================= RIGHT SIDE: Extracted Table & Validation Flags ================= */}
        <div className={`lg:col-span-7 xl:col-span-7 space-y-6 ${
          mobileTab === "scan" ? "hidden lg:block" : "block"
        }`}>
          
          {/* Card 1: Extracted Revenue Fields Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-slate-50/75 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-[#9b673c]" />
                  Extracted Revenue Records
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review extracted fields. Cells can be edited directly to correct any values.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Phonetic Hindi Typing Toggle */}
                <button
                  type="button"
                  onClick={() => setHindiTypingEnabled((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    hindiTypingEnabled
                      ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Type phonetically in English (e.g. 'ram') to produce Hindi ('राम')"
                >
                  <span className="font-serif font-bold text-[#9b673c]">अ</span>
                  <span>Hindi Typing:</span>
                  <span className={hindiTypingEnabled ? "text-emerald-700 font-bold" : "text-slate-400"}>
                    {hindiTypingEnabled ? "ON" : "OFF"}
                  </span>
                </button>

                {editedCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {editedCount} field(s) edited
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[460px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3 text-xs font-semibold text-slate-700">Revenue Field</TableHead>
                    <TableHead className="w-1/2 text-xs font-semibold text-slate-700">Extracted Value</TableHead>
                    <TableHead className="w-1/6 text-right text-xs font-semibold text-slate-700">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentData.fields.map((field) => {
                    const fieldName = field.field_name
                    const label = FIELD_LABELS[fieldName] || fieldName
                    const currentValue = fieldValues[fieldName] ?? ""
                    const isEdited = currentValue !== originalValues[fieldName]
                    const isConfident = field.confidence >= 0.7
                    const hasLatinText = /[a-zA-Z]/.test(currentValue)

                    return (
                      <TableRow key={fieldName} className={isEdited ? "bg-amber-50/30" : ""}>
                        {/* Field Label */}
                        <TableCell className="align-top py-3 text-xs font-medium text-slate-800">
                          <div>
                            <span>{label}</span>
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                              {fieldName}
                            </span>
                          </div>
                        </TableCell>

                        {/* Editable Field Input with Phonetic Transliteration */}
                        <TableCell className="py-2.5">
                          <div className="relative">
                            <Input
                              value={currentValue}
                              onChange={(e) => handleInputChange(fieldName, e.target.value)}
                              onBlur={() => handleInputBlur(fieldName)}
                              placeholder={hindiTypingEnabled ? "Type in English or Hindi (e.g. ram -> राम)" : ""}
                              className={`text-xs h-8 pr-16 ${
                                isEdited
                                  ? "border-amber-400 bg-amber-50/40 text-amber-950 font-medium"
                                  : !isConfident
                                  ? "border-amber-300 bg-amber-50/20"
                                  : "border-slate-200 focus:border-[#9b673c]"
                              }`}
                            />
                            
                            {/* Convert button if untransliterated Latin text exists and Hindi typing is active */}
                            {hindiTypingEnabled && hasLatinText ? (
                              <button
                                type="button"
                                onClick={() => handleFieldChange(fieldName, transliterateSentence(currentValue))}
                                className="absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition shadow-2xs"
                                title="Click to convert English phonetics to Hindi"
                              >
                                अ Convert
                              </button>
                            ) : isEdited ? (
                              <span className="absolute right-2 top-2 text-[10px] font-semibold text-amber-700">
                                Edited
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Confidence Score & Badge */}
                        <TableCell className="text-right align-middle py-2.5">
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant={isConfident ? "confident" : "unsure"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {isConfident ? "Confident" : "Unsure"}
                            </Badge>
                            <span className="text-[10px] font-mono text-slate-500">
                              {Math.round(field.confidence * 100)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Commit Action Bar */}
            <div className="p-4 bg-slate-50/75 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isCommitted ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> This record is committed and synced with the land registry.
                  </span>
                ) : editedCount > 0 ? (
                  <span>
                    Ready to commit. Your changes will update the registry and improve future AI accuracy.
                  </span>
                ) : (
                  <span>Check values against original scan on the left before committing.</span>
                )}
              </div>

              <Button
                onClick={handleCommit}
                disabled={isCommitting || isCommitted}
                className={`text-xs px-5 shadow-sm font-medium ${
                  isCommitted
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-[#9b673c] hover:bg-[#85552f] text-white"
                }`}
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Committing...
                  </>
                ) : isCommitted ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Committed
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Commit to Registry {editedCount > 0 ? `(${editedCount} Edits)` : ""}
                  </>
                )}
              </Button>
            </div>

          </div>


          {/* Card 2: Flags */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-3">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-[#9b673c]" />
                <h4 className="text-sm font-bold text-slate-900">
                  Flags
                </h4>
              </div>
              {documentData.validation_flags.some((v) => !v.passed) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                  {documentData.validation_flags.filter((v) => !v.passed).length} Attention Needed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                  All Clear (0 Issues)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {documentData.validation_flags.map((flag, idx) => {
                const passed = flag.passed
                const friendlyRuleNames: Record<string, string> = {
                  required_fields: "Required Fields",
                  area_aggregation: "Area Match",
                  fractional_share_sum: "Ownership Shares",
                  duplicate_detection: "Cadastral Boundary",
                  multi_parcel_holding: "Sub-Plots & Khasra",
                }
                const label = friendlyRuleNames[flag.rule_name] || flag.rule_name.replace(/_/g, " ")

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-md ${
                      passed
                        ? "bg-slate-50/70 border-slate-200/80 text-slate-800 hover:bg-slate-200/70 hover:border-slate-300"
                        : "bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100/90 hover:border-amber-400"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {label}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            passed
                              ? "bg-emerald-100/80 text-emerald-800"
                              : "bg-amber-200/80 text-amber-900"
                          }`}
                        >
                          {passed ? "Clean" : "Flagged"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                        {flag.detail || (passed ? "No issues detected." : "Please inspect values.")}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>

        </div>

      </div>

    </div>
  )
}

