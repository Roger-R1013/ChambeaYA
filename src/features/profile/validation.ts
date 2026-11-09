import type { FormErrors } from '@/hooks/useForm'
import { MAX_WORKER_CATEGORIES } from '@/services/profile.service'
import type { PricingMode, WorkerProfile } from '@/types/profile'
import type { User } from '@/types/user'
import type { WorkerAvailability } from '@/types/worker'
import { isPersonName, isPhone } from '@/utils/validators'

/* Rules mirror the CHECK constraints of migrations 0001 and 0004, so the user
   sees the problem before the request and the database remains the final authority. */

export const PROFESSION_MAX = 80
export const DESCRIPTION_MIN = 30
export const DESCRIPTION_MAX = 1000
export const EXPERIENCE_MAX = 60
export const RADIUS_MIN = 1
export const RADIUS_MAX = 50
export const RATE_MIN = 1
export const RATE_MAX = 100000

export type PersonalInfoValues = {
  firstName: string
  lastName: string
  phone: string
}

export type WorkerProfessionalValues = {
  profession: string
  description: string
  experienceYears: string
  serviceRadiusKm: string
  availability: WorkerAvailability
  serviceZoneId: string
  pricingMode: PricingMode | ''
  baseRateBob: string
}

function compact<T extends Record<string, string | boolean>>(
  errors: Partial<Record<keyof T, string | undefined>>,
): FormErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message))) as FormErrors<T>
}

function validateName(value: string, field: 'nombre' | 'apellido'): string | undefined {
  if (!value.trim()) return `Ingresa tu ${field}.`
  if (value.trim().length > 60) return `El ${field} no puede superar los 60 caracteres.`
  if (!isPersonName(value)) return `El ${field} solo puede contener letras (mínimo 2).`
  return undefined
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

/** Accepts "150", "150.5", "150,50" (max. 2 decimals). */
export function parseRate(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Number(normalized)
}

export function requiresRate(mode: PricingMode | ''): mode is 'per_hour' | 'per_job' {
  return mode === 'per_hour' || mode === 'per_job'
}

export function toPersonalInfoValues(user: User): PersonalInfoValues {
  return { firstName: user.firstName, lastName: user.lastName, phone: user.phone }
}

export function validatePersonalInfo(values: PersonalInfoValues): FormErrors<PersonalInfoValues> {
  return compact<PersonalInfoValues>({
    firstName: validateName(values.firstName, 'nombre'),
    lastName: validateName(values.lastName, 'apellido'),
    phone: !values.phone.trim()
      ? 'Ingresa tu número de teléfono.'
      : !isPhone(values.phone)
        ? 'Ingresa un celular válido de 8 dígitos (ej. 71234567).'
        : undefined,
  })
}

export function toWorkerProfessionalValues(profile: WorkerProfile): WorkerProfessionalValues {
  return {
    profession: profile.profession ?? '',
    description: profile.description ?? '',
    experienceYears: profile.experienceYears === null ? '' : String(profile.experienceYears),
    serviceRadiusKm: String(profile.serviceRadiusKm),
    availability: profile.availability,
    serviceZoneId: profile.serviceZoneId ?? '',
    pricingMode: profile.pricingMode ?? '',
    baseRateBob: profile.baseRateBob === null ? '' : String(profile.baseRateBob),
  }
}

export function validateWorkerProfessional(values: WorkerProfessionalValues): FormErrors<WorkerProfessionalValues> {
  const profession = values.profession.trim()
  const description = values.description.trim()
  const experience = parseInteger(values.experienceYears)
  const radius = parseInteger(values.serviceRadiusKm)
  const rate = parseRate(values.baseRateBob)

  return compact<WorkerProfessionalValues>({
    profession: !profession
      ? 'Indica tu oficio o profesión.'
      : profession.length < 2 || profession.length > PROFESSION_MAX
        ? `La profesión debe tener entre 2 y ${PROFESSION_MAX} caracteres.`
        : undefined,
    description: !description
      ? 'Describe los servicios que ofreces.'
      : description.length < DESCRIPTION_MIN
        ? `Escribe al menos ${DESCRIPTION_MIN} caracteres (llevas ${description.length}).`
        : description.length > DESCRIPTION_MAX
          ? `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres.`
          : undefined,
    experienceYears: !values.experienceYears.trim()
      ? 'Indica tus años de experiencia.'
      : experience === null || experience > EXPERIENCE_MAX
        ? `Ingresa un número entero entre 0 y ${EXPERIENCE_MAX}.`
        : undefined,
    serviceRadiusKm:
      radius === null || radius < RADIUS_MIN || radius > RADIUS_MAX
        ? `Ingresa un radio entre ${RADIUS_MIN} y ${RADIUS_MAX} km.`
        : undefined,
    serviceZoneId: !values.serviceZoneId ? 'Selecciona la zona donde trabajas.' : undefined,
    pricingMode: !values.pricingMode ? 'Indica cómo cobras tus servicios.' : undefined,
    baseRateBob: !requiresRate(values.pricingMode)
      ? undefined
      : !values.baseRateBob.trim()
        ? 'Indica un precio orientativo en bolivianos.'
        : rate === null || rate < RATE_MIN || rate > RATE_MAX
          ? `Ingresa un monto entre ${RATE_MIN} y ${RATE_MAX.toLocaleString('es-BO')} (máximo 2 decimales).`
          : undefined,
  })
}

export function validateCategorySelection(ids: string[]): string | undefined {
  if (ids.length === 0) return 'Selecciona al menos una categoría.'
  if (ids.length > MAX_WORKER_CATEGORIES) return `Puedes seleccionar como máximo ${MAX_WORKER_CATEGORIES} categorías.`
  return undefined
}

/**
 * Same completeness rule used by `public.get_public_workers()`: only these
 * profiles are listed in the directory.
 */
export function getMissingProfessionalFields(profile: WorkerProfile): string[] {
  const missing: string[] = []
  if (!profile.profession) missing.push('profesión')
  if (!profile.description) missing.push('descripción')
  if (profile.experienceYears === null) missing.push('años de experiencia')
  if (profile.categoryIds.length === 0) missing.push('categorías')
  return missing
}

/** Fields that are not required to be listed but help clients decide. */
export function getRecommendedProfessionalFields(profile: WorkerProfile): string[] {
  const missing: string[] = []
  if (!profile.serviceZoneId) missing.push('zona de trabajo')
  if (!profile.pricingMode) missing.push('precio orientativo')
  return missing
}
