import { useState, useRef } from "react"
import { UploadCloud, FileText, Lock, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UploadSectionProps {
  isLoggedIn: boolean
  onOpenLogin: () => void
  onUpload: (file: File, region: string) => Promise<void>
  isLoading?: boolean
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  isLoggedIn,
  onOpenLogin,
  onUpload,
  isLoading = false,
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [region, setRegion] = useState("north_central")
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn) return
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const validateAndSetFile = (file: File) => {
    setFileError(null)
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      setFileError("Please upload a valid image file (JPG, PNG, or WEBP).")
      return
    }
    // Limit file size to 25MB
    if (file.size > 25 * 1024 * 1024) {
      setFileError("Document scan size should be less than 25MB.")
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (!isLoggedIn) {
      onOpenLogin()
      return
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleStartUpload = async () => {
    if (!selectedFile) return
    await onUpload(selectedFile, region)
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setFileError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      
      {/* Title & Guidelines */}
      <div className="text-center mb-6 sm:mb-8 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/60 text-[#9b673c] text-xs font-semibold border border-amber-200/60">
          <FileText className="h-3.5 w-3.5" />
          <span>Land Records Digitization</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 font-serif">
          Digitize Scanned Land Records
        </h1>
        <p className="text-xs sm:text-base text-slate-600 max-w-2xl mx-auto">
          Upload scanned Jamabandi records to automatically extract and verify landowner names, plot numbers, and area details.
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div className="relative rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 sm:p-8 transition-all">
        
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={!isLoggedIn || isLoading}
        />

        {/* Locked / Disabled Overlay if NOT Logged In */}
        {!isLoggedIn && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-slate-900/40 backdrop-blur-xs p-6 text-center transition-all">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white text-[#9b673c] shadow-lg mb-3.5 border border-amber-100">
              <Lock className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 font-serif">
              Officer Authentication Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 max-w-md mb-5 leading-relaxed">
              The drag & drop upload feature is protected. Please sign in as a Patwari or Tehsildar
              to access document digitization and official registry tools.
            </p>
            <Button
              onClick={onOpenLogin}
              className="bg-[#9b673c] hover:bg-[#85552f] text-white shadow-md font-medium text-xs sm:text-sm px-6 py-2.5 rounded-xl transition"
            >
              Sign In with Mock Officer Account
            </Button>
          </div>
        )}

        {/* Active Upload Card Content */}
        <div className={`space-y-6 ${!isLoggedIn ? "opacity-30 pointer-events-none filter blur-xs select-none" : ""}`}>
          
          {/* Region Format Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Document Region & Format
              </span>
              <p className="text-xs text-slate-400">
                Select region to apply appropriate revenue terminology
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "north_central", label: "North/Central (Jamabandi)", badge: "Hindi / English", planned: false },
                { id: "south", label: "South (Patta/Chitta)", badge: "Tamil (Planned)", planned: true },
                { id: "west", label: "West (7/12 Extract)", badge: "Marathi (Planned)", planned: true },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => !r.planned && setRegion(r.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    region === r.id
                      ? "border-[#9b673c] bg-amber-50/70 text-[#9b673c] shadow-2xs font-semibold"
                      : r.planned
                      ? "border-slate-200 bg-slate-50/60 text-slate-400 opacity-75 cursor-default"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span>{r.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    region === r.id ? "bg-amber-100/80 text-[#9b673c]" : "bg-slate-100 text-slate-400"
                  }`}>
                    {r.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Dropzone Box */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => isLoggedIn && !isLoading && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-[#9b673c] bg-amber-50/40 scale-[1.005]"
                : "border-slate-200 hover:border-[#9b673c]/60 hover:bg-slate-50/60"
            } ${selectedFile ? "bg-amber-50/20 border-[#9b673c]/40" : ""}`}
          >
            {/* Inner Content: File Selected vs Empty State */}
            {selectedFile ? (
              <div className="w-full max-w-lg space-y-4 text-center">
                {previewUrl ? (
                  <div className="mx-auto h-36 w-48 sm:h-44 sm:w-60 overflow-hidden rounded-xl border border-slate-200 shadow-xs bg-slate-50">
                    <img
                      src={previewUrl}
                      alt="Scan preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-[#9b673c]">
                    <FileText className="h-8 w-8" />
                  </div>
                )}

                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-slate-900 truncate max-w-md mx-auto">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI extraction
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearFile()
                    }}
                    className="text-xs text-slate-600 hover:text-red-600 hover:border-red-200"
                  >
                    Change File
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartUpload()
                    }}
                    className="bg-[#9b673c] hover:bg-[#85552f] text-white text-xs px-5 shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Running Qwen Vision...
                      </>
                    ) : (
                      <>
                        Extract & Validate
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-amber-50 text-[#9b673c] border border-amber-200/50 shadow-xs">
                  <UploadCloud className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold text-slate-800">
                    Drag and drop your scanned document here
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    or <span className="font-semibold text-[#9b673c] underline underline-offset-2">browse files</span> from your computer
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">JPG</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">PNG</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">WEBP</span>
                  <span>(up to 25MB)</span>
                </div>
              </div>
            )}
          </div>

          {/* Validation Error Message */}
          {fileError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Bottom Security / Authenticity Notice */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Official Revenue Document Verification System</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Formats: Jamabandi (Punjab, Himachal Pradesh, Haryana, Rajasthan)
            </div>
          </div>

        </div>

      </div>

    </section>
  )
}
