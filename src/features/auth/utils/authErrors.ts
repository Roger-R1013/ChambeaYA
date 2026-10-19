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
  if (error.message && /failed to fetch|network/i.test(error.message)) return new Error(NETWORK_MESSAGE)
  // 42P01 / PGRST205 / PGRST202: table or function missing -> migrations not applied.
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' || error.code === '42883') {
    return new Error('La base de datos aún no tiene la estructura necesaria. Aplica las migraciones de supabase/migrations.')
  }
  if (error.code === '42501') return new Error('No tienes permiso para realizar esta acción.')
  return new Error(fallback)
}
