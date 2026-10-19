import type { GeoPoint } from '@/types/geo'

export const APP_CONFIG = {
  name: 'ChambeaYA!',
  tagline: 'Servicios cerca de ti',
  splashDurationMs: 1800,
  /** Simulated network latency for mock services. */
  mockLatencyMs: 600,
} as const

/**
 * Reference location used until the Geolocation API is integrated.
 * Santa Cruz de la Sierra, Bolivia.
 */
export const DEFAULT_LOCATION: { label: string; point: GeoPoint } = {
  label: 'Santa Cruz de la Sierra',
  point: { lat: -17.7833, lng: -63.1821 },
}

export const STORAGE_KEYS = {
  session: 'chambeaya.session',
  users: 'chambeaya.users',
} as const
