import type { GeoPoint } from './geo'
import type { PricingMode } from './profile'

/** Mirrors `public.availability_status`. */
export type WorkerAvailability = 'available' | 'busy' | 'offline'

export type CurrencyCode = 'BOB'

export interface Money {
  amount: number
  currency: CurrencyCode
}

/**
 * Public data of a worker, as returned by the `search_workers` /
 * `get_public_worker` RPCs (migration 0007). Contains NO private data:
 * no phone, email, documents, review notes or exact location.
 */
export interface Worker {
  id: string
  firstName: string
  /** Only the initial is public, e.g. "M." */
  lastName: string
  avatarUrl?: string
  profession: string
  experienceYears: number | null
  availability: WorkerAvailability
  /** Identity reviewed and approved by the ChambeaYA! team. */
  isVerified: boolean
  categoryIds: string[]
  pricingMode: PricingMode | null
  /** Reference ("desde") rate. Only with per_hour / per_job. */
  startingPrice: Money | null
  zoneName: string | null
}

/**
 * Worker plus data computed for the viewer. The location is APPROXIMATE
 * (~550 m grid + fixed offset, computed in the database), never the exact one.
 */
export interface NearbyWorker extends Worker {
  location: GeoPoint | null
  /** From the viewer's location to the approximate point. Null without origin. */
  distanceKm: number | null
}

export interface WorkerDetail extends NearbyWorker {
  description: string
  serviceRadiusKm: number
}

export interface WorkerSearchParams {
  query?: string
  categoryId?: string | null
  origin?: GeoPoint | null
  /** Include workers marked as busy (offline workers are never returned). */
  includeBusy?: boolean
  radiusKm?: number
  limit?: number
}
