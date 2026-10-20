import React, { useEffect, useState, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2, MapPinOff, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
  geocodeLocation,
  isInvalidLocation,
  type GeocodeResult,
} from "@/lib/geocode"

// Fix Leaflet's default marker icon issue under Vite bundlers
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"

// Apply default icons fallback
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

export interface RecordMapProps {
  village: string
  tehsil: string
  district: string
  ownerName: string
  khasraNumber: string
  plotArea: string
  hasIssues: boolean
}

/**
 * Controller subcomponent to handle dynamic center/zoom updates and
 * container resizing (e.g. mobile tab switches or collapsible card toggles).
 */
function MapController({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true })
    map.invalidateSize()

    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => clearTimeout(timer)
  }, [map, center, zoom])

  useEffect(() => {
    const container = map.getContainer()
    if (!container || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })

    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [map])

  return null
}

/**
 * Custom SVG Marker Icon generator:
 * - Green pin (#16a34a) when hasIssues is false
 * - Amber pin (#d97706) when hasIssues is true
 * Uses L.divIcon so no external image requests are required.
 */
function createCustomPinIcon(hasIssues: boolean): L.DivIcon {
  const pinBg = hasIssues ? "#d97706" : "#16a34a"
  const pinStroke = hasIssues ? "#92400e" : "#15803d"
  const innerDot = hasIssues ? "#b45309" : "#166534"

  const html = `
    <div style="position: relative; width: 32px; height: 42px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 16 42 16 42C16 42 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z" fill="${pinBg}" stroke="${pinStroke}" stroke-width="1.5"/>
        <circle cx="16" cy="15" r="6.5" fill="#ffffff"/>
        <circle cx="16" cy="15" r="3.5" fill="${innerDot}"/>
      </svg>
    </div>
  `

  return L.divIcon({
    className: "!bg-transparent !border-0",
    html,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  })
}

export const RecordMap: React.FC<RecordMapProps> = ({
  village,
  tehsil,
  district,
  ownerName,
  khasraNumber,
  plotArea,
  hasIssues,
}) => {
  const [location, setLocation] = useState<GeocodeResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [tileError, setTileError] = useState(false)

  // Cache marker icon to avoid recreating every render
  const markerIcon = useMemo(() => createCustomPinIcon(hasIssues), [hasIssues])

  // Debounce geocoding lookups by 1000ms with cleanup cancellation flag
  useEffect(() => {
    let isCancelled = false

    const timer = setTimeout(async () => {
      // If both village and district are empty or "N/A", skip immediately
      if (isInvalidLocation(village) && isInvalidLocation(district)) {
        if (!isCancelled) {
          setLocation(null)
          setIsLoading(false)
          setHasSearched(true)
        }
        return
      }

      try {
        const result = await geocodeLocation(village, tehsil, district)
        if (!isCancelled) {
          setLocation(result)
          setIsLoading(false)
          setHasSearched(true)
        }
      } catch {
        if (!isCancelled) {
          setLocation(null)
          setIsLoading(false)
          setHasSearched(true)
        }
      }
    }, 1000)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [village, tehsil, district])

  // Determine appropriate zoom level based on precision
  const zoomLevel =
    location?.precision === "village"
      ? 13
      : location?.precision === "tehsil"
      ? 11
      : 9

  return (
    <div className="space-y-2">
      {/* Container: spacious responsive height with clean styling */}
      <div className="h-80 sm:h-[420px] lg:h-[480px] w-full rounded-xl overflow-hidden relative border border-slate-200 bg-slate-100 shadow-inner">
        {/* State 1: Initial Loading State */}
        {isLoading && !location && (
          <div className="absolute inset-0 z-[1000] bg-slate-50/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#9b673c]" />
            <span className="text-xs font-medium text-slate-700">Locating...</span>
          </div>
        )}

        {/* State 2: Not Found State */}
        {!isLoading && hasSearched && !location && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-50">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
              <MapPinOff className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-800">Location not found</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              Location not found. Check the village, tehsil, and district fields.
            </p>
          </div>
        )}

        {/* State 3 & 4: Map View with Leaflet Container */}
        {location && (
          <>
            {/* Background Active Re-locating indicator when user edits fields */}
            {isLoading && (
              <div className="absolute top-3 left-3 z-[1000] bg-white/90 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-medium text-slate-700 shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                <Loader2 className="h-3 w-3 animate-spin text-[#9b673c]" />
                <span>Locating...</span>
              </div>
            )}

            {/* Precision status badge */}
            {location.precision === "village" ? (
              <div className="absolute top-3 right-3 z-[1000] bg-emerald-50/95 border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Village level precision</span>
              </div>
            ) : location.precision === "tehsil" ? (
              <div className="absolute top-3 right-3 z-[1000] bg-amber-50/95 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>Approximate (tehsil level)</span>
              </div>
            ) : (
              <div className="absolute top-3 right-3 z-[1000] bg-amber-50/95 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>Approximate (district level)</span>
              </div>
            )}

            {/* Tile Error Resilience Notification */}
            {tileError && (
              <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/80 text-white px-2.5 py-1 rounded text-[10px] shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span>Map tiles offline; pin centered at coordinates.</span>
              </div>
            )}

            <MapContainer
              center={[location.lat, location.lng]}
              zoom={zoomLevel}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <MapController
                center={[location.lat, location.lng]}
                zoom={zoomLevel}
              />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{
                  tileerror: () => setTileError(true),
                }}
              />

              <Marker
                position={[location.lat, location.lng]}
                icon={markerIcon}
              >
                <Popup className="bhulekh-map-popup">
                  <div className="space-y-1.5 p-1 text-slate-800 font-sans min-w-[210px]">
                    <div className="border-b border-slate-200 pb-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                        Landowner
                      </span>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {ownerName || "Not specified"}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">Khasra No:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {khasraNumber || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">Plot Area:</span>
                        <span className="font-semibold text-slate-800">
                          {plotArea || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 shrink-0">Location:</span>
                        <span className="font-medium text-slate-800 text-right">
                          {[village, tehsil, district].filter(Boolean).join(", ") || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200">
                      {hasIssues ? (
                        <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded flex items-center gap-1 border border-amber-200">
                          <span>⚠️ Attention Needed (Flags detected)</span>
                        </div>
                      ) : (
                        <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1 border border-emerald-200">
                          <span>✓ All Clear (Validation Passed)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </>
        )}
      </div>

      {/* Subtle coordinate & precision footer info */}
      {location && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                hasIssues ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            <span>
              Pin: {location.lat.toFixed(4)}° N, {location.lng.toFixed(4)}° E
            </span>
          </span>
          <span className="capitalize text-slate-400">
            Precision: {location.precision}
          </span>
        </div>
      )}
    </div>
  )
}
