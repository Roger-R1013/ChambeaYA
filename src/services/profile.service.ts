import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type {
  CatalogCategory,
  PersonalInfoInput,
  PricingMode,
  ServiceZone,
  VerificationStatus,
  WorkerProfile,
  WorkerProfileInput,
} from '@/types/profile'
import type { WorkerAvailability } from '@/types/worker'
import { IMAGE_MIME_TYPES, buildStoragePath, prepareImage, validateUploadFile } from '@/utils/files'

/* --------------------------------------------------------------------------
   Profile data (Stage 3). Every query runs with the user's JWT, so Row Level
   Security limits it to the caller's own rows. Only columns granted to the
   `authenticated` role are written (see migrations 0002 and 0004):
     profiles        -> first_name, last_name, phone, avatar_url (own file only)
     worker_profiles -> profession, description, experience_years,
                        service_radius_km, availability_status,
                        service_zone_id, pricing_mode, base_rate_bob
   verification_status and account_type are never sent from the client.
   -------------------------------------------------------------------------- */

interface WorkerProfileRow {
  id: string
  profession: string | null
  description: string | null
  experience_years: number | null
  service_radius_km: number
  availability_status: WorkerAvailability
  verification_status: VerificationStatus
  verification_note: string | null
  service_zone_id: string | null
  pricing_mode: PricingMode | null
  /** numeric is returned as number or string depending on precision. */
  base_rate_bob: number | string | null
}

const WORKER_COLUMNS =
  'id, profession, description, experience_years, service_radius_km, availability_status, verification_status, verification_note, service_zone_id, pricing_mode, base_rate_bob'

/** Maximum categories per worker. Enforced by the database (trigger + RPC); mirrored here for the UI. */
export const MAX_WORKER_CATEGORIES = 5

const AVATAR_BUCKET = 'avatars'

function normalizePhone(phone: string): string | null {
  const value = phone.replace(/[\s-]/g, '')
  return value === '' ? null : value
}

/** Object path inside the avatars bucket, only if the URL points to the caller's own folder. */
function ownAvatarPath(url: string | undefined, userId: string): string | null {
  if (!url) return null
  const encoded = /\/storage\/v1\/object\/public\/avatars\/([^?#]+)$/.exec(url)?.[1]
  const path = encoded ? decodeURIComponent(encoded) : null
  return path && path.startsWith(`${userId}/`) ? path : null
}

export const profileService = {
  async updatePersonalInfo(userId: string, { firstName, lastName, phone }: PersonalInfoInput): Promise<void> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: normalizePhone(phone) })
      .eq('id', userId)
      .select('id')
    if (error) throw toDataError(error, 'No se pudieron guardar tus datos. Inténtalo de nuevo.')
    // RLS hides foreign rows instead of failing: 0 rows means nothing was saved.
    if (!data || data.length !== 1) throw toDataError({ message: 'profile_not_found' })
  },

  async getWorkerProfile(userId: string): Promise<WorkerProfile> {
    const client = requireSupabase()
    const [profileResult, categoriesResult] = await Promise.all([
      client.from('worker_profiles').select(WORKER_COLUMNS).eq('id', userId).maybeSingle<WorkerProfileRow>(),
      client.from('worker_categories').select('category_id').eq('worker_id', userId),
    ])
    if (profileResult.error) throw toDataError(profileResult.error, 'No se pudo cargar tu perfil profesional.')
    if (!profileResult.data) throw toDataError({ message: 'worker_profile_not_found' })
    if (categoriesResult.error) throw toDataError(categoriesResult.error, 'No se pudieron cargar tus categorías.')

    const row = profileResult.data
    return {
      id: row.id,
      profession: row.profession,
      description: row.description,
      experienceYears: row.experience_years,
      serviceRadiusKm: row.service_radius_km,
      availability: row.availability_status,
      verificationStatus: row.verification_status,
      verificationNote: row.verification_note,
      serviceZoneId: row.service_zone_id,
      pricingMode: row.pricing_mode,
      baseRateBob: row.base_rate_bob === null ? null : Number(row.base_rate_bob),
      categoryIds: (categoriesResult.data ?? []).map((item) => item.category_id as string).sort(),
    }
  },

  async updateWorkerProfile(userId: string, input: WorkerProfileInput): Promise<void> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_profiles')
      .update({
        profession: input.profession.trim(),
        description: input.description.trim(),
        experience_years: input.experienceYears,
        service_radius_km: input.serviceRadiusKm,
        availability_status: input.availability,
        service_zone_id: input.serviceZoneId,
        pricing_mode: input.pricingMode,
        // The database rejects a rate together with 'quote' (CHECK constraint).
        base_rate_bob: input.pricingMode === 'quote' ? null : input.baseRateBob,
      })
      .eq('id', userId)
      .select('id')
    if (error) throw toDataError(error, 'No se pudo guardar tu perfil profesional. Inténtalo de nuevo.')
    if (!data || data.length !== 1) throw toDataError({ message: 'worker_profile_not_found' })
  },

  /** Atomically replaces the caller's categories (RPC `set_worker_categories`, SECURITY INVOKER). */
  async setWorkerCategories(categoryIds: string[]): Promise<string[]> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('set_worker_categories', { p_category_ids: categoryIds })
    if (error) throw toDataError(error, 'No se pudieron guardar tus categorías. Inténtalo de nuevo.')
    return ((data as string[] | null) ?? []).slice().sort()
  },

  async listActiveCategories(): Promise<CatalogCategory[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('categories')
      .select('id, name, description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) throw toDataError(error, 'No se pudieron cargar las categorías.')
    return (data ?? []) as CatalogCategory[]
  },

  async listServiceZones(): Promise<ServiceZone[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('service_zones')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) throw toDataError(error, 'No se pudieron cargar las zonas de trabajo.')
    return (data ?? []) as ServiceZone[]
  },

  /**
   * Uploads a new profile photo to the PUBLIC `avatars` bucket and links it to
   * the profile. The image is re-encoded first (metadata such as GPS removed).
   * Returns the new public URL.
   */
  async uploadAvatar(userId: string, file: File, previousUrl?: string): Promise<string> {
    const invalid = validateUploadFile(file, IMAGE_MIME_TYPES)
    if (invalid) throw new Error(invalid)

    const client = requireSupabase()
    const image = await prepareImage(file, { maxDimension: 512, type: 'image/webp', quality: 0.85 })
    const path = buildStoragePath(userId, 'avatar', image.type)

    const upload = await client.storage
      .from(AVATAR_BUCKET)
      .upload(path, image, { contentType: image.type, cacheControl: '31536000', upsert: false })
    if (upload.error) throw toDataError(upload.error, 'No se pudo subir la foto. Inténtalo de nuevo.')

    const { data: urlData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    const { data, error } = await client
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId)
      .select('id')
    if (error || !data || data.length !== 1) {
      // Do not leave orphan files when the profile could not be updated.
      await client.storage.from(AVATAR_BUCKET).remove([path])
      throw toDataError(error ?? { message: 'profile_not_found' }, 'No se pudo guardar la foto de perfil.')
    }

    const previousPath = ownAvatarPath(previousUrl, userId)
    if (previousPath && previousPath !== path) {
      // Best effort: a leftover old file is harmless and can be cleaned later.
      await client.storage.from(AVATAR_BUCKET).remove([previousPath])
    }
    return urlData.publicUrl
  },

  async removeAvatar(userId: string, currentUrl?: string): Promise<void> {
    const client = requireSupabase()
    const { data, error } = await client.from('profiles').update({ avatar_url: null }).eq('id', userId).select('id')
    if (error) throw toDataError(error, 'No se pudo quitar la foto de perfil.')
    if (!data || data.length !== 1) throw toDataError({ message: 'profile_not_found' })

    const path = ownAvatarPath(currentUrl, userId)
    if (path) await client.storage.from(AVATAR_BUCKET).remove([path])
  },
}
