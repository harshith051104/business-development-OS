/**
 * City-level coordinate resolver for approximate org placement.
 * Returns city-center coordinates when city is known, null otherwise.
 * No hash jitter — markers land at city center. Precision = APPROXIMATE.
 */

interface Coordinates {
  lat: number
  lng: number
}

// ── Global Business Cities ──────────────────────────────────────────────────
const CITY_COORDINATES: Record<string, Coordinates> = {
  // India
  singapore: { lat: 1.3521, lng: 103.8198 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  bombay: { lat: 19.0760, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.3910 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  madras: { lat: 13.0827, lng: 80.2707 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  cochin: { lat: 9.9312, lng: 76.2673 },
  trivandrum: { lat: 8.5241, lng: 76.9366 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  indore: { lat: 22.7196, lng: 75.8577 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },

  // Asia-Pacific
  tokyo: { lat: 35.6762, lng: 139.6503 },
  seoul: { lat: 37.5665, lng: 126.9780 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  brisbane: { lat: -27.4698, lng: 153.0251 },
  jakarta: { lat: -6.2088, lng: 106.8456 },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  manila: { lat: 14.5995, lng: 120.9842 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 },
  hanoi: { lat: 21.0285, lng: 105.8542 },

  // Middle East
  dubai: { lat: 25.2048, lng: 55.2708 },
  'abu dhabi': { lat: 24.4539, lng: 54.3773 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  doha: { lat: 25.2854, lng: 51.5310 },
  'tel aviv': { lat: 32.0853, lng: 34.7818 },

  // Europe & UK
  london: { lat: 51.5074, lng: -0.1278 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  birmingham: { lat: 52.4862, lng: -1.8904 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  berlin: { lat: 52.5200, lng: 13.4050 },
  munich: { lat: 48.1351, lng: 11.5820 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  paris: { lat: 48.8566, lng: 2.3522 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  brussels: { lat: 50.8503, lng: 4.3517 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  oslo: { lat: 59.9139, lng: 10.7522 },
  helsinki: { lat: 60.1699, lng: 24.9384 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  milan: { lat: 45.4642, lng: 9.1900 },
  rome: { lat: 41.9028, lng: 12.4964 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  warsaw: { lat: 52.2297, lng: 21.0122 },

  // Americas
  'new york': { lat: 40.7128, lng: -74.0060 },
  nyc: { lat: 40.7128, lng: -74.0060 },
  brooklyn: { lat: 40.6782, lng: -73.9442 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'silicon valley': { lat: 37.3861, lng: -122.0839 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  austin: { lat: 30.2672, lng: -97.7431 },
  boston: { lat: 42.3601, lng: -71.0589 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  denver: { lat: 39.7392, lng: -104.9903 },
  atlanta: { lat: 33.7490, lng: -84.3880 },
  miami: { lat: 25.7617, lng: -80.1918 },
  dallas: { lat: 32.7767, lng: -96.7970 },
  houston: { lat: 29.7604, lng: -95.3698 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  vancouver: { lat: 49.2827, lng: -123.1207 },
  montreal: { lat: 45.5017, lng: -73.5673 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  buenos_aires: { lat: -34.6037, lng: -58.3816 },

  // Africa
  'cape town': { lat: -33.9249, lng: 18.4241 },
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  nairobi: { lat: -1.2921, lng: 36.8219 },
  lagos: { lat: 6.5244, lng: 3.3792 },
  cairo: { lat: 30.0444, lng: 31.2357 },
}

/**
 * Resolve city name to [lat, lng]. Returns null when city is unknown.
 * Caller should not place a marker when null is returned.
 */
export function resolveCoordinates(
  _address: string | undefined | null,
  city: string | undefined | null,
  _country: string | undefined | null,
  _seed?: number | string,
): [number, number] | null {
  if (!city) return null

  const cityLower = city.toLowerCase().trim()

  // Direct match
  if (CITY_COORDINATES[cityLower]) {
    const c = CITY_COORDINATES[cityLower]
    return [c.lat, c.lng]
  }

  // Substring match — e.g. "Bengaluru, Karnataka" contains "bengaluru"
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (cityLower.includes(key)) {
      return [coords.lat, coords.lng]
    }
  }

  // No match — don't place a marker
  return null
}
