import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type { GeoPoint } from '@/types/geo'
import type { WorkerAvailability } from '@/types/worker'

/* --------------------------------------------------------------------------
   The signed-in worker's availability and shared location (migration 0007).
   - RLS: each worker can only read/write their own row.
   - The database snaps every point to a ~550 m grid: the exact position is
     never stored. We also round here so the precise value never leaves the
     device.
   - Not live tracking: a single point, saved only when the worker decides.
   -------------------------------------------------------------------------- */

export type LocationSource = 'device' | 'manual'

export interface SharedLocation {
  point: GeoPoint
  source: LocationSource
  updatedAt: string
}

interface LocationRow {
  lat: number | string
  lng: number | string
  source: LocationSource
  updated_at: string
}

const GRID_DEGREES = 0.005

function snap(value: number): number {
  return Math.round(value / GRID_DEGREES) * GRID_DEGREES
}

export const availabilityService = {
  async getAvailability(userId: string): Promise<WorkerAvailability> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_profiles')
      .select('availability_status')
      .eq('id', userId)
      .maybeSingle<{ availability_status: WorkerAvailability }>()
    if (error) throw toDataError(error, 'No se pudo cargar tu disponibilidad.')
    if (!data) throw toDataError({ message: 'worker_profile_not_found' })
    return data.availability_status
  },

  async setAvailability(userId: string, availability: WorkerAvailability): Promise<void> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_profiles')
      .update({ availability_status: availability })
      .eq('id', userId)
      .select('id')
    if (error) throw toDataError(error, 'No se pudo actualizar tu disponibilidad.')
    if (!data || data.length !== 1) throw toDataError({ message: 'worker_profile_not_found' })
  },

  async getLocation(userId: string): Promise<SharedLocation | null> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_locations')
      .select('lat, lng, source, updated_at')
      .eq('worker_id', userId)
      .maybeSingle<LocationRow>()
    if (error) throw toDataError(error, 'No se pudo cargar tu ubicación compartida.')
    if (!data) return null
    return { point: { lat: Number(data.lat), lng: Number(data.lng) }, source: data.source, updatedAt: data.updated_at }
  },

  async saveLocation(userId: string, point: GeoPoint, source: LocationSource): Promise<SharedLocation> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_locations')
      .upsert({ worker_id: userId, lat: snap(point.lat), lng: snap(point.lng), source }, { onConflict: 'worker_id' })
      .select('lat, lng, source, updated_at')
      .single<LocationRow>()
    if (error) throw toDataError(error, 'No se pudo guardar tu ubicación.')
    return { point: { lat: Number(data.lat), lng: Number(data.lng) }, source: data.source, updatedAt: data.updated_at }
  },

  async clearLocation(userId: string): Promise<void> {
    const client = requireSupabase()
    const { error } = await client.from('worker_locations').delete().eq('worker_id', userId)
    if (error) throw toDataError(error, 'No se pudo dejar de compartir tu ubicación.')
  },
}

