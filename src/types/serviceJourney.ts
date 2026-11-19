import type { GeoPoint } from './geo'

export type JourneyStatus = 'waiting' | 'en_route' | 'paused' | 'arrived' | 'cancelled'
export type JourneyEnd = 'pause' | 'arrive' | 'cancel'

export interface JourneySnapshot {
  worker_id: string
  worker_name: string
  category_name: string
  status: JourneyStatus
  started_at: string | null
  last_fix_at: string | null
  lease_until: string | null
  server_time: string
  destination: { lat: number | null; lng: number | null; address: string; reference: string | null } | null
  position: (GeoPoint & { accuracy: number }) | null
}
