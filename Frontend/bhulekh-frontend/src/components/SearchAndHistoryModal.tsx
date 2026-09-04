import React, { useState, useEffect, useRef } from "react"
import {
  Search,
  X,
  History,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Calendar,
  MapPin,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { searchDocuments, listDocuments, getDocumentById } from "@/lib/api"
import type { UploadResponse } from "@/lib/api"

interface SearchAndHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDocument: (doc: UploadResponse, imageUrl: string) => void
}

export const SearchAndHistoryModal: React.FC<SearchAndHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectDocument,
}) => {
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<"all" | "name" | "id" | "place">("all")
  const [results, setResults] = useState<any[]>([])
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpeningDoc, setIsOpeningDoc] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent documents when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      loadRecentDocuments()
    }
  }, [isOpen])

  const loadRecentDocuments = async () => {
    setIsLoading(true)
    try {
      const docs = await listDocuments()
      setRecentDocs(docs || [])
    } catch {
      setRecentDocs([])
    } finally {
      setIsLoading(false)
    }
  }

  // Live debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const data = await searchDocuments(query.trim(), searchType)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchType])

  const handleSelect = async (docId: string, fallbackImageUrl?: string) => {
    setIsOpeningDoc(true)
    try {
      const doc = await getDocumentById(docId)
      const fullImageUrl = doc.image_url
        ? (doc.image_url.startsWith("http") ? doc.image_url : `http://127.0.0.1:8000${doc.image_url}`)
        : (fallbackImageUrl || "")
      onSelectDocument(doc, fullImageUrl)
      onClose()
    } catch {
      // If full fetch failed, alert user
    } finally {
      setIsOpeningDoc(false)
    }
  }

  if (!isOpen) return null

  const isSearching = query.trim().length > 0
  const displayItems = isSearching ? results : recentDocs

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 backdrop-blur-xs p-4 sm:p-6 pt-12 sm:pt-20 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Top Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-200 px-4 py-3 sm:py-4 bg-slate-50/50">
          <Search className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Khasra No. (e.g. 274), Landowner Name (e.g. लीला प्रकाश), or Village..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md mr-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100 text-xs overflow-x-auto">
          <span className="text-slate-400 text-[11px] uppercase font-semibold mr-1">
            Filter:
          </span>
          {[
            { id: "all", label: "All Records" },
            { id: "id", label: "By Khasra / ID" },
            { id: "name", label: "By Landowner" },
            { id: "place", label: "By Village" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSearchType(tab.id as any)}
              className={`px-2.5 py-1 rounded-md transition font-medium text-xs ${
                searchType === tab.id
                  ? "bg-[#9b673c] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results / History List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/30">
          
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              {isSearching ? (
                <>
                  <Search className="h-3.5 w-3.5 text-[#9b673c]" />
                  Search Results ({results.length})
                </>
              ) : (
                <>
                  <History className="h-3.5 w-3.5 text-[#9b673c]" />
                  Recent Digitized Records ({recentDocs.length})
                </>
              )}
            </span>
            {isLoading && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
              </span>
            )}
          </div>

          {/* Empty State */}
          {!isLoading && displayItems.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                {isSearching ? "No matching land records found" : "No digitized records yet"}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isSearching
                  ? `No records match "${query}". Try searching by Khasra number (e.g. 274) or Landowner name.`
                  : "Upload and commit your first scanned Jamabandi to see it appear here."}
              </p>
            </div>
          )}

          {/* List Items */}
          {displayItems.map((item) => {
            const docId = item.document_id || item.id
            const landownerName = item.landowner_details?.name || (typeof item.landowner_details === "string" ? item.landowner_details : null)
            const khasra = item.khasra_number
            const village = item.village
            const isCommitted = item.status === "committed"
            const isVerified = item.status === "verified"

            return (
              <div
                key={docId}
                onClick={() => !isOpeningDoc && handleSelect(docId, item.image_url)}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-[#9b673c]/60 hover:bg-amber-50/20 hover:shadow-xs transition cursor-pointer group"
              >
                <div className="space-y-1 min-w-0 flex-1 pr-3">
                  {/* Top line: Name and Status badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {landownerName || item.filename || "Scanned Land Record"}
                    </span>
                    <Badge
                      variant={isCommitted ? "verified" : isVerified ? "confident" : "unsure"}
                      className="text-[10px] px-2 py-0"
                    >
                      {isCommitted ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Committed
                        </>
                      ) : isVerified ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="mr-1 h-3 w-3" /> Flagged
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Metadata line: Khasra, Village, Date */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {khasra && (
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                        खसरा नं {khasra}
                      </span>
                    )}
                    {village && (
                      <span className="flex items-center gap-1 text-[11px]">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {village}
                      </span>
                    )}
                    {item.uploaded_at && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Arrow Icon */}
                <div className="flex items-center text-slate-400 group-hover:text-[#9b673c] group-hover:translate-x-0.5 transition">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            )
          })}

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
          <span>Click any record to inspect original scan & extraction</span>
          <span className="text-[11px]">Press Esc to close</span>
        </div>

      </div>
    </div>
  )
}
