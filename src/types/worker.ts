import type { CategoryId } from './category'
import type { GeoPoint } from './geo'

export type WorkerAvailability = 'available' | 'busy' | 'offline'

export type CurrencyCode = 'BOB'

export interface Money {
  amount: number
  currency: CurrencyCode
}

export interface Worker {
  id: string
  firstName: string
  lastName: string
  profession: string
  categoryId: CategoryId
  avatarUrl?: string
  rating: number
  reviewsCount: number
  availability: WorkerAvailability
  startingPrice: Money
  location: GeoPoint
}

/** Worker enriched with data relative to the viewer (computed client-side for now). */
export interface NearbyWorker extends Worker {
  distanceKm: number
}
