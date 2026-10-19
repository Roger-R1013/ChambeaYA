import { createClient, type SupportedStorage } from '@supabase/supabase-js'

/* --------------------------------------------------------------------------
   Single Supabase client for the whole app (do NOT create others).

   - Only PUBLIC keys are accepted (anon JWT or sb_publishable_...). Access to
     data is protected by Row Level Security in the database.
   - If the environment is not configured, `supabase` is null and
     `supabaseConfigError` explains what is missing. The UI must show that
     message instead of crashing or pretending to be connected.
   -------------------------------------------------------------------------- */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

function detectConfigError(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'La conexión con el servidor no está configurada. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env (ver .env.example) y reinicia el servidor de desarrollo.'
  }
  try {
    const url = new URL(SUPABASE_URL)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return 'VITE_SUPABASE_URL debe usar https (salvo en localhost).'
    }
  } catch {
    return 'VITE_SUPABASE_URL no es una URL válida.'
  }
  // Defence in depth: refuse secret keys that would grant full database access.
  if (SUPABASE_ANON_KEY.startsWith('sb_secret_') || isServiceRoleJwt(SUPABASE_ANON_KEY)) {
    return 'La clave configurada es secreta (service_role). Usa únicamente la clave pública anon/publishable en el frontend.'
  }
  return null
}

function isServiceRoleJwt(key: string): boolean {
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

/* --------------------------------------------------------------------------
   "Recordar sesión": Supabase stores its session under one key. This adapter
   writes it to localStorage (persistent) or sessionStorage (until the tab is
   closed) depending on the user's choice. No passwords are ever stored.
   -------------------------------------------------------------------------- */

const PERSISTENCE_KEY = 'chambeaya.auth.persistence'

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function prefersPersistentSession(): boolean {
  return safeStorage('local')?.getItem(PERSISTENCE_KEY) !== 'session'
}

/** Call before signing in. `true` keeps the session after closing the browser. */
export function setSessionPersistence(remember: boolean): void {
  safeStorage('local')?.setItem(PERSISTENCE_KEY, remember ? 'local' : 'session')
}

const rememberAwareStorage: SupportedStorage = {
  getItem: (key) => safeStorage('local')?.getItem(key) ?? safeStorage('session')?.getItem(key) ?? null,
  setItem: (key, value) => {
    const target = prefersPersistentSession() ? 'local' : 'session'
    const other = target === 'local' ? 'session' : 'local'
    safeStorage(other)?.removeItem(key)
    safeStorage(target)?.setItem(key, value)
  },
  removeItem: (key) => {
    safeStorage('local')?.removeItem(key)
    safeStorage('session')?.removeItem(key)
  },
}

export const supabaseConfigError: string | null = detectConfigError()

/**
 * Error code returned by Supabase in the email-confirmation redirect
 * (e.g. `otp_expired`). Read synchronously at startup, before auth-js
 * processes the URL. Contains no secrets.
 */
export const authRedirectErrorCode: string | null = (() => {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    if (!hash.has('error') && !query.has('error')) return null
    return hash.get('error_code') ?? query.get('error_code') ?? hash.get('error') ?? query.get('error')
  } catch {
    return null
  }
})()

export const supabase =
  supabaseConfigError === null
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Processes the tokens in the email-confirmation redirect URL.
          detectSessionInUrl: true,
          storage: rememberAwareStorage,
          storageKey: 'chambeaya.auth',
        },
      })
    : null

export const isSupabaseConfigured = supabase !== null

/** Returns the client or throws a user-facing (Spanish) configuration error. */
export function requireSupabase() {
  if (!supabase) throw new Error(supabaseConfigError ?? 'La conexión con el servidor no está configurada.')
  return supabase
}
