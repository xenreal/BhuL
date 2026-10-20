/**
 * Geocoding utility for BhuLekh land records.
 * Prioritizes: Village -> Tehsil -> District.
 * Supports offline demo documents via DEMO_LOCATIONS and online lookup via OpenStreetMap Nominatim.
 */

export interface GeocodeResult {
  lat: number
  lng: number
  precision: "village" | "tehsil" | "district"
  displayName?: string
}

// Cleans common Indian revenue prefixes/suffixes (e.g. "Mauza", "Village:", "तहसील", etc.)
export function cleanLocationName(raw: string): string {
  if (!raw) return ""
  let clean = raw.trim()
  // Remove parenthetical notes e.g. (ह. नं. 12) or (HB No 45)
  clean = clean.replace(/\([^)]*\)/g, " ")
  // Remove common prefixes (case insensitive, Hindi & English)
  clean = clean.replace(
    /^(village|gram|mauza|moza|tehsil|tahsil|taluka|taluk|district|dist|गाँव|गांव|ग्राम|मौजा|मौज़ा|तहसील|जिला|ज़िला)[:\s\-.]+/i,
    ""
  )
  // Remove punctuation delimiters
  clean = clean.replace(/[-:,;]/g, " ")
  // Collapse whitespace
  clean = clean.replace(/\s+/g, " ").trim()
  return clean
}

// Normalizes strings: trim, lowercase, collapse multiple whitespace characters
export function normalizeLocationString(str: string): string {
  return cleanLocationName(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

// Check if a string represents an empty or placeholder value
export function isInvalidLocation(val: string): boolean {
  const clean = normalizeLocationString(val)
  return (
    !clean ||
    clean === "n/a" ||
    clean === "na" ||
    clean === "none" ||
    clean === "null" ||
    clean === "-" ||
    clean === "--" ||
    clean === "not available" ||
    clean === "not found"
  )
}

/**
 * Hardcoded coordinates for demo documents.
 * Must work completely offline with no network connection.
 * Keys are normalized strings.
 *
 * TODO: Fill in coordinates for your demo documents' villages, tehsils, and districts.
 */
export const DEMO_LOCATIONS: Record<string, GeocodeResult> = {
  // Hamirpur / Anu / Nadaun / Rangas demo records (Himachal Pradesh)
  "anu|hamirpur|hamirpur": { lat: 31.6862, lng: 76.5213, precision: "village", displayName: "Anu, Hamirpur, HP" },
  "anu|hamirpur": { lat: 31.6862, lng: 76.5213, precision: "village", displayName: "Anu, Hamirpur, HP" },
  "anu": { lat: 31.6862, lng: 76.5213, precision: "village", displayName: "Anu, Hamirpur, HP" },
  "अणु": { lat: 31.6862, lng: 76.5213, precision: "village", displayName: "Anu, Hamirpur, HP" },

  "rangas|nadaun|hamirpur": { lat: 31.733, lng: 76.435, precision: "village", displayName: "Rangas, Nadaun, HP" },
  "rangas|hamirpur": { lat: 31.733, lng: 76.435, precision: "village", displayName: "Rangas, Nadaun, HP" },
  "rangas": { lat: 31.733, lng: 76.435, precision: "village", displayName: "Rangas, Nadaun, HP" },
  "रंगस": { lat: 31.733, lng: 76.435, precision: "village", displayName: "Rangas, Nadaun, HP" },

  "nadaun|hamirpur": { lat: 31.782, lng: 76.3475, precision: "tehsil", displayName: "Nadaun Tehsil, Hamirpur, HP" },
  "nadaun": { lat: 31.782, lng: 76.3475, precision: "tehsil", displayName: "Nadaun Tehsil, Hamirpur, HP" },
  "नदौन": { lat: 31.782, lng: 76.3475, precision: "tehsil", displayName: "Nadaun Tehsil, Hamirpur, HP" },

  "hamirpur": { lat: 31.6862, lng: 76.5213, precision: "district", displayName: "Hamirpur District, HP" },
  "हमीरपुर": { lat: 31.6862, lng: 76.5213, precision: "district", displayName: "Hamirpur District, HP" },

  // Bathinda / Deon demo records (Punjab)
  "deon|bathinda|bathinda": { lat: 30.1725, lng: 74.9658, precision: "village", displayName: "Deon, Bathinda, Punjab" },
  "deon|bathinda": { lat: 30.1725, lng: 74.9658, precision: "village", displayName: "Deon, Bathinda, Punjab" },
  "deon": { lat: 30.1725, lng: 74.9658, precision: "village", displayName: "Deon, Bathinda, Punjab" },
  "देओं": { lat: 30.1725, lng: 74.9658, precision: "village", displayName: "Deon, Bathinda, Punjab" },

  "bathinda": { lat: 30.211, lng: 74.9455, precision: "district", displayName: "Bathinda District, Punjab" },
  "बठिंडा": { lat: 30.211, lng: 74.9455, precision: "district", displayName: "Bathinda District, Punjab" },

  // Aligarh / Rampur demo records (Uttar Pradesh)
  "rampur|aligarh|aligarh": { lat: 27.8974, lng: 78.088, precision: "village", displayName: "Rampur, Aligarh, UP" },
  "rampur|aligarh": { lat: 27.8974, lng: 78.088, precision: "village", displayName: "Rampur, Aligarh, UP" },
  "rampur": { lat: 27.8974, lng: 78.088, precision: "village", displayName: "Rampur, Aligarh, UP" },
  "रामपुर": { lat: 27.8974, lng: 78.088, precision: "village", displayName: "Rampur, Aligarh, UP" },

  "aligarh": { lat: 27.8974, lng: 78.088, precision: "district", displayName: "Aligarh District, UP" },
  "अलीगढ़": { lat: 27.8974, lng: 78.088, precision: "district", displayName: "Aligarh District, UP" },
}

// In-memory cache keyed by normalized query to prevent duplicate network calls
const geocodeCache = new Map<string, GeocodeResult | null>()

interface NominatimResponseItem {
  lat: string
  lon: string
  display_name?: string
}

// Helper to query Nominatim with error handling
async function queryNominatim(query: string): Promise<{ lat: number; lng: number; displayName?: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    )
    if (!response.ok) return null

    const data = (await response.json()) as NominatimResponseItem[]
    if (Array.isArray(data) && data.length > 0 && data[0]?.lat && data[0]?.lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      }
    }
  } catch {
    // Network or parse error
    return null
  }
  return null
}

/**
 * Geocodes a land record location strictly following the hierarchy:
 *   1. Village first (DEMO_LOCATIONS -> Nominatim village queries)
 *   2. Tehsil second (if village not found/empty: DEMO_LOCATIONS -> Nominatim tehsil queries)
 *   3. District third (if neither village nor tehsil found: DEMO_LOCATIONS -> Nominatim district queries)
 *   4. null if all fail or inputs are invalid
 */
export async function geocodeLocation(
  village: string,
  tehsil: string,
  district: string
): Promise<GeocodeResult | null> {
  const normVillage = normalizeLocationString(village)
  const normTehsil = normalizeLocationString(tehsil)
  const normDistrict = normalizeLocationString(district)

  const villageEmpty = isInvalidLocation(normVillage)
  const tehsilEmpty = isInvalidLocation(normTehsil)
  const districtEmpty = isInvalidLocation(normDistrict)

  // Skip entirely if village, tehsil, and district are all empty or "N/A"
  if (villageEmpty && tehsilEmpty && districtEmpty) {
    return null
  }

  const cacheKey = `${normVillage}|${normTehsil}|${normDistrict}`
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null
  }

  // =========================================================================
  // PRIORITY 1: POINT TO THE VILLAGE FIRST
  // =========================================================================
  if (!villageEmpty) {
    // 1a. Try DEMO_LOCATIONS for village (works completely offline)
    const fullKey = `${normVillage}|${normTehsil}|${normDistrict}`
    if (DEMO_LOCATIONS[fullKey]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[fullKey], precision: "village" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    const vdKey = `${normVillage}|${normDistrict}`
    if (DEMO_LOCATIONS[vdKey]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[vdKey], precision: "village" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    if (DEMO_LOCATIONS[normVillage]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[normVillage], precision: "village" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    // 1b. Try Nominatim online village queries (best match candidates)
    const villageQueries: string[] = []
    if (!districtEmpty) {
      villageQueries.push(`${normVillage}, ${normDistrict}, India`)
      if (!tehsilEmpty) {
        villageQueries.push(`${normVillage}, ${normTehsil}, ${normDistrict}, India`)
      }
      villageQueries.push(`${normVillage} village, ${normDistrict}, India`)
    }
    villageQueries.push(`${normVillage}, India`)

    for (const q of villageQueries) {
      const nomResult = await queryNominatim(q)
      if (nomResult) {
        const result: GeocodeResult = {
          lat: nomResult.lat,
          lng: nomResult.lng,
          precision: "village",
          displayName: nomResult.displayName,
        }
        geocodeCache.set(cacheKey, result)
        return result
      }
    }
  }

  // =========================================================================
  // PRIORITY 2: IF NOT VILLAGE, THEN POINT TO TEHSIL
  // =========================================================================
  if (!tehsilEmpty) {
    // 2a. Try DEMO_LOCATIONS for tehsil
    const tdKey = `${normTehsil}|${normDistrict}`
    if (DEMO_LOCATIONS[tdKey]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[tdKey], precision: "tehsil" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    if (DEMO_LOCATIONS[normTehsil]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[normTehsil], precision: "tehsil" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    // 2b. Try Nominatim online tehsil queries
    const tehsilQueries: string[] = []
    if (!districtEmpty) {
      tehsilQueries.push(`${normTehsil}, ${normDistrict}, India`)
      tehsilQueries.push(`${normTehsil} tehsil, ${normDistrict}, India`)
    }
    tehsilQueries.push(`${normTehsil}, India`)

    for (const q of tehsilQueries) {
      const nomResult = await queryNominatim(q)
      if (nomResult) {
        const result: GeocodeResult = {
          lat: nomResult.lat,
          lng: nomResult.lng,
          precision: "tehsil",
          displayName: nomResult.displayName,
        }
        geocodeCache.set(cacheKey, result)
        return result
      }
    }
  }

  // =========================================================================
  // PRIORITY 3: IF NOT BOTH, THEN POINT TO DISTRICT
  // =========================================================================
  if (!districtEmpty) {
    // 3a. Try DEMO_LOCATIONS for district
    if (DEMO_LOCATIONS[normDistrict]) {
      const res: GeocodeResult = { ...DEMO_LOCATIONS[normDistrict], precision: "district" }
      geocodeCache.set(cacheKey, res)
      return res
    }

    // 3b. Try Nominatim online district queries
    const distQueries = [`${normDistrict} district, India`, `${normDistrict}, India`]
    for (const q of distQueries) {
      const nomResult = await queryNominatim(q)
      if (nomResult) {
        const result: GeocodeResult = {
          lat: nomResult.lat,
          lng: nomResult.lng,
          precision: "district",
          displayName: nomResult.displayName,
        }
        geocodeCache.set(cacheKey, result)
        return result
      }
    }
  }

  // =========================================================================
  // PRIORITY 4: ALL FAILED -> RETURN NULL
  // =========================================================================
  geocodeCache.set(cacheKey, null)
  return null
}
