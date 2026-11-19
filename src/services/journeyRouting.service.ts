import type { GeoPoint, LngLatTuple } from '@/types/geo'
import { requireSupabase } from '@/lib/supabase'

export type TravelMode = 'walk' | 'cycle' | 'drive'
export type RoadRoute =
  | { status: 'ready'; geometry: LngLatTuple[]; distanceMeters: number; durationSeconds: number }
  | { status: 'unavailable' }

export interface JourneyRoutingProvider {
  getRoute(input: { requestId: string; origin: GeoPoint; destination: GeoPoint; mode: TravelMode; signal: AbortSignal }): Promise<RoadRoute>
}

const path: unknown = import.meta.env.VITE_SERVICE_ROUTE_PROXY_PATH
const proxy = typeof path === 'string' && /^\/[a-z\d/_-]+$/i.test(path) && !path.startsWith('//') ? path : null

function coordinates(value: unknown): value is LngLatTuple {
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90
}

// Opt-in, same-origin proxy. No browser requests to external routing services.
export const journeyRouting: JourneyRoutingProvider | null = proxy ? {
  async getRoute({ signal, ...input }) {
    try {
      const { data: { session } } = await requireSupabase().auth.getSession()
      if (!session) return { status: 'unavailable' }
      const response = await fetch(proxy, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        signal, redirect: 'error', cache: 'no-store', body: JSON.stringify(input),
      })
      if (!response.ok) return { status: 'unavailable' }
      const data = await response.json() as {
        geometry?: unknown; distanceMeters?: unknown; durationSeconds?: unknown
      }
      if (Array.isArray(data.geometry) && data.geometry.length >= 2 && data.geometry.every(coordinates)
        && typeof data.distanceMeters === 'number' && Number.isFinite(data.distanceMeters) && data.distanceMeters >= 0
        && typeof data.durationSeconds === 'number' && Number.isFinite(data.durationSeconds) && data.durationSeconds >= 0) {
        return { status: 'ready', geometry: data.geometry, distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds }
      }
    } catch {
      // A routing failure never interrupts GPS or the map.
    }
    return { status: 'unavailable' }
  },
} : null
