/**
 * BhuLekh API Client Layer
 * Connects the React frontend to the FastAPI backend (http://127.0.0.1:8000).
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000"

export interface DocumentField {
  field_name: string
  value: any
  confidence: number
  status: "confident" | "unsure"
}

export interface ValidationFlag {
  rule_name: string
  passed: boolean
  detail: string
}

export interface UploadResponse {
  document_id: string
  status: "uploaded" | "processing" | "flagged" | "verified" | "committed" | "failed"
  region: string
  fields: DocumentField[]
  validation_flags: ValidationFlag[]
  extracted_data: Record<string, any>
}

export interface DashboardStats {
  uploaded_count: number
  committed_count: number
  pending_count: number
  verified_count: number
  flagged_count: number
  failed_count?: number
  avg_confidence: number
}

export interface DocumentListItem {
  id: string
  filename: string
  region: string
  status: string
  image_url: string | null
  uploaded_at: string | null
}

export interface CommitResponse {
  document_id: string
  status: string
  corrections_logged?: number
}

/**
 * Uploads a scanned land record document to be processed synchronously.
 * Runs OCR -> Qwen 2.5 VL Extraction -> Validation Engine.
 */
export async function uploadDocument(
  file: File,
  region: string = "north_central"
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("region", region)

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Fetches real-time dashboard metric cards for the drawer:
 * - uploaded_count
 * - committed_count
 * - pending_count
 * - avg_confidence
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE_URL}/stats`)
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard stats (${response.status})`)
  }
  return response.json()
}

/**
 * Commits a verified/corrected document to the registry (Section 2b & 9).
 * Sends inline corrections back, which are logged to few-shot learning memory.
 */
export async function commitDocument(
  documentId: string,
  corrections?: Record<string, any>
): Promise<CommitResponse> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/commit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ corrections: corrections || {} }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Commit failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Lists previously uploaded documents with optional filters.
 */
export async function listDocuments(
  statusFilter?: string,
  regionFilter?: string
): Promise<DocumentListItem[]> {
  const params = new URLSearchParams()
  if (statusFilter) params.append("status_filter", statusFilter)
  if (regionFilter) params.append("region_filter", regionFilter)

  const queryString = params.toString() ? `?${params.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}/documents${queryString}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch documents list (${response.status})`)
  }

  return response.json()
}

/**
 * Fetches full extraction and validation history for a single document.
 */
export async function getDocumentById(documentId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch document ${documentId} (${response.status})`)
  }
  return response.json()
}

/**
 * Searches digitized documents by identifier, landowner name, or geography (Section 11a).
 */
export async function searchDocuments(
  query: string,
  type: "id" | "name" | "place" | "all" = "all"
): Promise<any[]> {
  const params = new URLSearchParams({ query, type })
  const response = await fetch(`${API_BASE_URL}/documents/search?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`)
  }
  return response.json()
}

/**
 * Formats full image URL for rendering original scans in <img> tags.
 */
export function getImageUrl(imagePathOrUrl: string | null): string | null {
  if (!imagePathOrUrl) return null
  if (imagePathOrUrl.startsWith("http://") || imagePathOrUrl.startsWith("https://")) {
    return imagePathOrUrl
  }
  const cleanPath = imagePathOrUrl.startsWith("/") ? imagePathOrUrl : `/${imagePathOrUrl}`
  return `${API_BASE_URL}${cleanPath}`
}

