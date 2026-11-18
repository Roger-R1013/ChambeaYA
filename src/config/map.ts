import type { LatLngBoundsExpression } from 'leaflet'
import { DEFAULT_LOCATION } from '@/config/app'

/**
 * Map configuration (Leaflet + OpenStreetMap).
 *
 * Tiles: the public OSM servers are fine for development and low traffic, but
 * their usage policy (https://operations.osmfoundation.org/policies/tiles/)
 * forbids heavy/commercial use. Before launch set VITE_MAP_TILE_URL (and
 * VITE_MAP_TILE_ATTRIBUTION) to a provider with a suitable plan.
 */
const env = import.meta.env as Record<string, string | undefined>

export const MAP_CONFIG = {
  /** Initial view centered on the default search reference. */
  center: DEFAULT_LOCATION.point,
  zoom: 13,
  minZoom: 11,
  maxZoom: 18,
  tileUrl: env.VITE_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    env.VITE_MAP_TILE_ATTRIBUTION?.trim() ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
} as const

/** Santa Cruz metropolitan area. Must match `worker_locations_service_area` (migration 0007). */
export const SERVICE_AREA = { minLat: -18.3, maxLat: -17.2, minLng: -63.7, maxLng: -62.7 } as const

export const SERVICE_AREA_BOUNDS: LatLngBoundsExpression = [
  [SERVICE_AREA.minLat, SERVICE_AREA.minLng],
  [SERVICE_AREA.maxLat, SERVICE_AREA.maxLng],
]

export function isInServiceArea({ lat, lng }: { lat: number; lng: number }): boolean {
  return lat >= SERVICE_AREA.minLat && lat <= SERVICE_AREA.maxLat && lng >= SERVICE_AREA.minLng && lng <= SERVICE_AREA.maxLng
}

