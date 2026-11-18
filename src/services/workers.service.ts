import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type { GeoPoint } from '@/types/geo'
import type { PricingMode } from '@/types/profile'
import type { NearbyWorker, Worker, WorkerAvailability, WorkerDetail, WorkerSearchParams } from '@/types/worker'

/* --------------------------------------------------------------------------
   Public worker directory (migration 0007). Clients never read worker tables
   directly: two SECURITY DEFINER RPCs return a fixed set of public columns
   and an APPROXIMATE location computed in the database.
   -------------------------------------------------------------------------- */

interface PublicWorkerRow {
  id: string
  first_name: string
  last_initial: string | null
  avatar_url: string | null
  profession: string
  experience_years: number | null
  availability_status: WorkerAvailability
  is_verified: boolean
  category_ids: string[] | null
  pricing_mode: PricingMode | null
  /** numeric arrives as number or string. */
  base_rate_bob: number | string | null
  zone_name: string | null
  approx_lat: number | null
  approx_lng: number | null
  distance_km: number | null
}

interface PublicWorkerDetailRow extends PublicWorkerRow {
  description: string
  service_radius_km: number
}

export const SEARCH_DEFAULT_RADIUS_KM = 15
// Matches the limits enforced by search_workers (migration 0007).
export const SEARCH_MIN_RADIUS_KM = 1
export const SEARCH_MAX_RADIUS_KM = 50
export const WORKER_SEARCH_QUERY_MAX_LENGTH = 60

function toWorker(row: PublicWorkerRow): Worker {
  const rate = row.base_rate_bob === null ? null : Number(row.base_rate_bob)
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_initial ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    profession: row.profession,
    experienceYears: row.experience_years,
    availability: row.availability_status,
    isVerified: row.is_verified,
    categoryIds: row.category_ids ?? [],
    pricingMode: row.pricing_mode,
    startingPrice: rate !== null && Number.isFinite(rate) ? { amount: rate, currency: 'BOB' } : null,
    zoneName: row.zone_name,
  }
}

function toNearbyWorker(row: PublicWorkerRow): NearbyWorker {
  const lat = Number(row.approx_lat ?? NaN)
  const lng = Number(row.approx_lng ?? NaN)
  const distanceKm = Number(row.distance_km ?? NaN)
  return {
    ...toWorker(row),
    location: Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null,
    distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : null,
  }
}

export interface WorkersService {
  search(params: WorkerSearchParams, signal?: AbortSignal): Promise<NearbyWorker[]>
  getFeatured(origin: GeoPoint | null): Promise<NearbyWorker[]>
  getById(id: string, origin: GeoPoint | null): Promise<WorkerDetail | null>
}

export const workersService: WorkersService = {
  async search({ query, categoryId, origin, includeBusy = false, radiusKm = SEARCH_DEFAULT_RADIUS_KM, limit = 50 }, signal) {
    const client = requireSupabase()
    const request = client.rpc('search_workers', {
      p_query: query?.trim().slice(0, WORKER_SEARCH_QUERY_MAX_LENGTH) || null,
      p_category_id: categoryId || null,
      p_lat: origin?.lat ?? null,
      p_lng: origin?.lng ?? null,
      p_radius_km: radiusKm,
      p_limit: limit,
      p_include_busy: includeBusy,
    })
    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    if (error) throw toDataError(error, 'No se pudo completar la búsqueda. Inténtalo de nuevo.')
    return ((data ?? []) as PublicWorkerRow[]).map(toNearbyWorker)
  },

  getFeatured(origin) {
    return workersService.search({ origin, radiusKm: 25, limit: 6 })
  },

  async getById(id, origin) {
    const client = requireSupabase()
    const { data, error } = await client
      .rpc('get_public_worker', { p_worker_id: id, p_lat: origin?.lat ?? null, p_lng: origin?.lng ?? null })
      .maybeSingle<PublicWorkerDetailRow>()
    if (error) {
      // Invalid UUIDs in the URL simply mean "not found".
      if (error.code === '22P02') return null
      throw toDataError(error, 'No se pudo cargar el perfil del profesional.')
    }
    if (!data) return null
    return { ...toNearbyWorker(data), description: data.description, serviceRadiusKm: data.service_radius_km }
  },
}
