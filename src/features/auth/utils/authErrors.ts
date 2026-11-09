import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/** Spanish, user-facing messages for Supabase Auth error codes. */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta registrada con este correo.',
  email_exists: 'Ya existe una cuenta registrada con este correo.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.',
  email_address_invalid: 'El correo electrónico no es válido.',
  email_address_not_authorized: 'Este correo no está autorizado para recibir mensajes. Contacta a soporte.',
  signup_disabled: 'El registro de nuevas cuentas está deshabilitado temporalmente.',
  email_provider_disabled: 'El registro con correo electrónico está deshabilitado.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  user_banned: 'Esta cuenta está suspendida. Contacta a soporte.',
  session_expired: 'Tu sesión expiró. Inicia sesión nuevamente.',
  session_not_found: 'Tu sesión expiró. Inicia sesión nuevamente.',
  refresh_token_not_found: 'Tu sesión expiró. Inicia sesión nuevamente.',
  refresh_token_already_used: 'Tu sesión expiró. Inicia sesión nuevamente.',
  otp_expired: 'El enlace de confirmación expiró o ya fue utilizado. Solicita uno nuevo.',
  validation_failed: 'Revisa los datos ingresados.',
}

/** Messages raised by our SQL functions (see supabase/migrations). */
const DATABASE_MESSAGES: Record<string, string> = {
  account_type_already_set: 'Tu tipo de cuenta ya fue definido. Si necesitas cambiarlo, contacta a soporte.',
  profile_not_found: 'No encontramos tu perfil. Cierra sesión e inténtalo de nuevo.',
  not_authenticated: 'Tu sesión expiró. Inicia sesión nuevamente.',
  worker_profile_not_found: 'No encontramos tu perfil profesional. Cierra sesión e inténtalo de nuevo.',
  category_limit_reached: 'Puedes seleccionar como máximo 5 categorías.',
  invalid_category_count: 'Selecciona entre 1 y 5 categorías.',
  'verification_status is managed by the review process': 'El estado de verificación solo puede cambiarlo el equipo de revisión.',
  invalid_avatar_url: 'La foto de perfil no es válida. Vuelve a subirla.',
  certificate_limit_reached: 'Puedes registrar como máximo 10 certificados.',
  identity_documents_incomplete: 'Sube el anverso y el reverso de tu documento y una selfie antes de enviar la solicitud.',
  verification_not_editable: 'Tu solicitud ya está en revisión o fue aprobada. No puedes modificar los documentos.',
  // Supabase Storage
  'Bucket not found': 'El almacenamiento de archivos aún no está configurado. Aplica las migraciones de supabase/migrations.',
  'new row violates row-level security policy': 'No tienes permiso para subir este archivo.',
  'The object exceeded the maximum allowed size': 'El archivo supera el tamaño máximo de 5 MB.',
}

/** CHECK constraints (migration 0001) -> field-level explanation. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  profiles_first_name_length: 'El nombre debe tener entre 1 y 60 caracteres.',
  profiles_last_name_length: 'El apellido no puede superar los 60 caracteres.',
  profiles_phone_format: 'Ingresa un celular válido de 8 dígitos (ej. 71234567).',
  worker_profiles_profession_length: 'La profesión debe tener entre 2 y 80 caracteres.',
  worker_profiles_description_length: 'La descripción debe tener entre 30 y 1000 caracteres.',
  worker_profiles_experience_range: 'Los años de experiencia deben estar entre 0 y 60.',
  worker_profiles_radius_range: 'El radio de trabajo debe estar entre 1 y 50 km.',
  worker_profiles_base_rate_range: 'El precio orientativo debe estar entre Bs 1 y Bs 100 000.',
  worker_profiles_rate_requires_priced_mode: 'El precio orientativo solo se indica con tarifa por hora o por trabajo.',
  worker_certificates_title_length: 'El nombre del certificado debe tener entre 3 y 120 caracteres.',
  worker_certificates_issuer_length: 'La institución no puede superar los 120 caracteres.',
  worker_certificates_issued_past: 'La fecha de emisión no puede ser futura.',
}

function constraintMessage(message: string | undefined): string | undefined {
  if (!message) return undefined
  const match = Object.keys(CONSTRAINT_MESSAGES).find((name) => message.includes(name))
  return match ? CONSTRAINT_MESSAGES[match] : undefined
}

const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.'
const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.'

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message)
}

/** Converts any Supabase/network error into an Error with a Spanish message. */
export function toAuthError(error: unknown): Error {
  if (isAuthRetryableFetchError(error) || isNetworkFailure(error)) return new Error(NETWORK_MESSAGE)
  if (isAuthApiError(error) || isAuthError(error)) {
    const byCode = error.code ? AUTH_MESSAGES[error.code] : undefined
    if (byCode) return new Error(byCode)
    if (error.status === 429) return new Error(AUTH_MESSAGES.over_request_rate_limit)
    return new Error(GENERIC_MESSAGE)
  }
  if (error instanceof Error) return error
  return new Error(GENERIC_MESSAGE)
}

/** PostgREST error shape returned by `supabase.from()` / `supabase.rpc()`. */
interface PostgrestLikeError {
  message?: string
  code?: string
}

export function toDataError(error: PostgrestLikeError | null | undefined, fallback = GENERIC_MESSAGE): Error {
  if (!error) return new Error(fallback)
  const known = error.message ? DATABASE_MESSAGES[error.message] : undefined
  if (known) return new Error(known)
  const byConstraint = constraintMessage(error.message)
  if (byConstraint) return new Error(byConstraint)
  if (error.code === '23503') return new Error('Una de las opciones seleccionadas ya no está disponible. Recarga la página.')
  if (error.message && /failed to fetch|network/i.test(error.message)) return new Error(NETWORK_MESSAGE)
  // 42P01 / 42703 / PGRST205 / PGRST202 / PGRST204: table, column or function missing -> migrations not applied.
  if (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST204' ||
    error.code === '42883'
  ) {
    return new Error('La base de datos aún no tiene la estructura necesaria. Aplica las migraciones de supabase/migrations.')
  }
  if (error.code === '42501') return new Error('No tienes permiso para realizar esta acción.')
  return new Error(fallback)
}
