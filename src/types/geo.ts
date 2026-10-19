/** WGS84 coordinate pair, compatible with MapLibre ([lng, lat]) via `toLngLat`. */
export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Snapshot of a device position. Mirrors the Geolocation API shape so the
 * future real-time tracking module can persist/stream it without mapping.
 */
export interface GeoPosition extends GeoPoint {
  accuracy?: number
  heading?: number | null
  speed?: number | null
  timestamp: number
}

export type LngLatTuple = [lng: number, lat: number]
