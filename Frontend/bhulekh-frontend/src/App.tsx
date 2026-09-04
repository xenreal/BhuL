import { useState } from "react"
import { Header } from "@/components/Header"
import { MockLoginModal } from "@/components/MockLoginModal"
import type { UserProfile } from "@/components/MockLoginModal"
import { UploadSection } from "@/components/UploadSection"
import { ProcessingState } from "@/components/ProcessingState"
import { ExtractionReviewView } from "@/components/ExtractionReviewView"
import { SearchAndHistoryModal } from "@/components/SearchAndHistoryModal"
import { uploadDocument, getImageUrl } from "@/lib/api"
import type { UploadResponse } from "@/lib/api"
import { AlertCircle, PlayCircle } from "lucide-react"

// Sample Jamabandi response for quick demo/preview of the split-screen workspace
const SAMPLE_JAMABANDI_DEMO: UploadResponse = {
  document_id: "bf243dfb-3226-422c-bb3c-b412b8a8549f",
  status: "verified",
  region: "north_central",
  fields: [
    {
      field_name: "landowner_details.name",
      value: "लीला प्रकाश, माधविन्द्र, कृष्ण चन्द",
      confidence: 0.65,
      status: "unsure",
    },
    {
      field_name: "khasra_number",
      value: "274, 276, 544",
      confidence: 0.82,
      status: "confident",
    },
    {
      field_name: "khata_number",
      value: "4",
      confidence: 0.85,
      status: "confident",
    },
    {
      field_name: "khatauni_number",
      value: "7, 8, 10, 13",
      confidence: 0.82,
      status: "confident",
    },
    {
      field_name: "plot_area",
      value: {
        value: "00-08-09",
        unit: "Kanal-Marla",
      },
      confidence: 0.76,
      status: "confident",
    },
    {
      field_name: "village",
      value: "अणु (Anu)",
      confidence: 0.86,
      status: "confident",
    },
    {
      field_name: "tehsil",
      value: "हमीरपुर (Hamirpur)",
      confidence: 0.87,
      status: "confident",
    },
    {
      field_name: "district",
      value: "हमीरपुर (Hamirpur)",
      confidence: 0.88,
      status: "confident",
    },
  ],
  validation_flags: [
    {
      rule_name: "required_fields",
      passed: true,
      detail: "All mandatory cadastral identifiers and landowner details are present.",
    },
    {
      rule_name: "area_aggregation",
      passed: true,
      detail: "Total parcel area matches the sum of sub-parcels (00-08-09 Kanal-Marla).",
    },
    {
      rule_name: "fractional_share_sum",
      passed: true,
      detail: "Owner co-shares sum to 1.0 (Equal 1/3 share each).",
    },
    {
      rule_name: "duplicate_detection",
      passed: true,
      detail: "No conflicting cadastral mutations recorded for Khasra 274, 276, 544.",
    },
  ],
  extracted_data: {},
}

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  
  // File and Upload Lifecycle state
  const [activeFile, setActiveFile] = useState<File | null>(null)
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractedDoc, setExtractedDoc] = useState<UploadResponse | null>(null)

  // Stats refresh trigger for live dashboard
  const [statsTrigger, setStatsTrigger] = useState(0)

  const handleLogin = (profile: UserProfile) => {
    setCurrentUser(profile)
  }

  const handleLogout = () => {
    setCurrentUser(null)
  }

  const handleUpload = async (file: File, region: string) => {
    setActiveFile(file)
    const localUrl = URL.createObjectURL(file)
    setLocalImageUrl(localUrl)
    setIsProcessing(true)
    setUploadError(null)

    try {
      const response = await uploadDocument(file, region)
      setExtractedDoc(response)
      // Auto-refresh the dashboard counts
      setStatsTrigger((prev) => prev + 1)
    } catch (err: any) {
      setUploadError(
        err.message || "Failed to process document. Please ensure the backend server is running on port 8000."
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoadSampleDemo = () => {
    setExtractedDoc(SAMPLE_JAMABANDI_DEMO)
    // Use an existing uploaded sample scan from the backend static directory
    setLocalImageUrl("http://127.0.0.1:8000/uploaded_images/ca40623f-b107-4353-8f63-798ff55ad1ef.jpg")
    setUploadError(null)
    setIsProcessing(false)
  }

  const handleReset = () => {
    setExtractedDoc(null)
    setActiveFile(null)
    setLocalImageUrl(null)
    setUploadError(null)
    setIsProcessing(false)
  }

  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleSelectHistoricalRecord = (doc: UploadResponse, fullImageUrl: string) => {
    setExtractedDoc(doc)
    setLocalImageUrl(fullImageUrl)
    setIsProcessing(false)
    setUploadError(null)
  }

  return (
    <div className="min-h-screen w-full bg-[#fcfbf9] text-slate-900 flex flex-col antialiased selection:bg-amber-100 selection:text-[#9b673c]">
      
      {/* 1. Header with Light Brown BhuLekh, Search, Dashboard Drawer, Mock Login */}
      <Header
        user={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={() => {
          handleLogout()
          setIsDashboardOpen(false)
        }}
        isDashboardOpen={isDashboardOpen}
        onToggleDashboard={() => setIsDashboardOpen((prev) => !prev)}
        onOpenSearch={() => setIsSearchOpen(true)}
        refreshTrigger={statsTrigger}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col items-center">
        
        {/* Mock Login Modal */}
        <MockLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLogin}
        />

        {/* Search & Records History Modal */}
        <SearchAndHistoryModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectDocument={handleSelectHistoricalRecord}
        />

        {/* Global Error Banner */}
        {uploadError && (
          <div className="w-full max-w-5xl px-4 sm:px-6 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <span className="font-semibold">Processing Failed: </span>
                  {uploadError}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSampleDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-900 text-xs font-semibold hover:bg-red-50 transition shadow-2xs"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-red-700" />
                  View Demo Split-Screen
                </button>
                <button
                  onClick={() => setUploadError(null)}
                  className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Demo Preview Bar (Available anytime in upload view) */}
        {!extractedDoc && !isProcessing && (
          <div className="w-full max-w-5xl px-4 sm:px-6 pt-2 flex justify-end">
            <button
              onClick={handleLoadSampleDemo}
              className="inline-flex items-center gap-1.5 text-xs text-[#9b673c] hover:text-[#7f502c] font-medium transition underline underline-offset-4"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Instant Demo Preview (View Sample Jamabandi Split-Screen)
            </button>
          </div>
        )}

        {/* View State:
            1. isProcessing -> Circular processing animation with animated dots
            2. extractedDoc -> Split-screen Review (Left: image, Right: table & validation flags)
            3. default -> Login-gated drag & drop upload section
        */}
        {isProcessing ? (
          <ProcessingState
            fileName={activeFile?.name || "Scanned Land Record"}
            fileSize={activeFile?.size}
            previewUrl={localImageUrl}
          />
        ) : extractedDoc ? (
          <ExtractionReviewView
            documentData={extractedDoc}
            imageUrl={
              localImageUrl ||
              getImageUrl(`/uploaded_images/${extractedDoc.document_id}_${activeFile?.name}`) ||
              ""
            }
            onReset={handleReset}
            onCommitted={() => setStatsTrigger((prev) => prev + 1)}
          />
        ) : (
          <UploadSection
            isLoggedIn={!!currentUser}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onUpload={handleUpload}
            isLoading={isProcessing}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/60 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BhuLekh Land Records Modernization System</span>
          <span className="text-[11px] text-slate-400">
            Government Land Records Verification Portal
          </span>
        </div>
      </footer>

    </div>
  )
}

export default App
