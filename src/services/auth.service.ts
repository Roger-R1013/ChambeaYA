import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js'
import { STORAGE_KEYS } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { toAuthError, toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase, setSessionPersistence, supabase } from '@/lib/supabase'
import type { AccountType, LoginCredentials, RegisterPayload, User } from '@/types/user'

/* --------------------------------------------------------------------------
   Supabase Auth implementation (Stage 2).
   - Passwords are only sent to Supabase Auth; nothing is stored manually.
   - The authoritative account type is `profiles.account_type` (database),
     never the user-editable auth metadata.
   -------------------------------------------------------------------------- */

export interface SignUpOutcome {
  /** null when email confirmation is required before the first session. */
  session: Session | null
  authUser: SupabaseUser | null
}

export interface AuthService {
  getSession(): Promise<Session | null>
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void
  fetchProfile(authUser: SupabaseUser): Promise<User>
  login(credentials: LoginCredentials): Promise<SupabaseUser>
  register(payload: RegisterPayload): Promise<SignUpOutcome>
  resendConfirmation(email: string): Promise<void>
  setAccountType(accountType: AccountType): Promise<void>
  logout(): Promise<void>
}

interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  account_type: AccountType | null
  created_at: string
}

const PROFILE_COLUMNS = 'id, first_name, last_name, phone, avatar_url, account_type, created_at'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '')
}

/** Where the confirmation email link sends the user back (must be allow-listed in Supabase). */
function emailRedirectUrl(): string {
  return `${window.location.origin}${ROUTES.splash}`
}

function mapProfile(row: ProfileRow, authUser: SupabaseUser): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: authUser.email ?? '',
    phone: row.phone ?? '',
    accountType: row.account_type,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  }
}

/** Removes data left by the Stage 1 mock (it never contained passwords). */
function clearLegacyMockData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.users)
    localStorage.removeItem(STORAGE_KEYS.session)
    sessionStorage.removeItem(STORAGE_KEYS.session)
  } catch {
    // Storage unavailable (private mode): nothing to clean.
  }
}

clearLegacyMockData()

const supabaseAuthService: AuthService = {
  async getSession() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getSession()
    if (error) throw toAuthError(error)
    return data.session
  },

  onAuthStateChange(callback) {
    if (!supabase) return () => {}
    const { data } = supabase.auth.onAuthStateChange(callback)
    return () => data.subscription.unsubscribe()
  },

  async fetchProfile(authUser) {
    const client = requireSupabase()
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', authUser.id)
      .maybeSingle<ProfileRow>()
    if (error) throw toDataError(error, 'No se pudo cargar tu perfil. Inténtalo de nuevo.')
    if (!data) throw toDataError({ message: 'profile_not_found' })
    return mapProfile(data, authUser)
  },

  async login({ email, password, rememberMe }) {
    const client = requireSupabase()
    setSessionPersistence(rememberMe)
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password })
      if (error) throw error
      return data.user
    } catch (error) {
      throw toAuthError(error)
    }
  },

  async register({ firstName, lastName, email, phone, password, accountType }) {
    const client = requireSupabase()
    setSessionPersistence(true)
    try {
      const { data, error } = await client.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          emailRedirectTo: emailRedirectUrl(),
          // Sanitised and validated by public.handle_new_user(); only 'client' | 'worker' accepted.
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: normalizePhone(phone),
            account_type: accountType,
          },
        },
      })
      if (error) throw error
      // With email confirmation enabled, an existing address returns a user without identities
      // (Supabase hides account existence). Report it instead of a false "check your inbox".
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('Ya existe una cuenta registrada con este correo. Inicia sesión o recupera tu contraseña.')
      }
      return { session: data.session, authUser: data.user }
    } catch (error) {
      throw toAuthError(error)
    }
  },

  async resendConfirmation(email) {
    const client = requireSupabase()
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email: normalizeEmail(email),
        options: { emailRedirectTo: emailRedirectUrl() },
      })
      if (error) throw error
    } catch (error) {
      throw toAuthError(error)
    }
  },

  async setAccountType(accountType) {
    const client = requireSupabase()
    const { error } = await client.rpc('set_account_type', { p_account_type: accountType })
    if (error) throw toDataError(error, 'No se pudo guardar tu elección. Inténtalo de nuevo.')
  },

  async logout() {
    if (!supabase) return
    // scope 'local': closes this device only. auth-js removes the local session
    // even if the network call fails, so the user is never left signed in.
    await supabase.auth.signOut({ scope: 'local' })
  },
}

export const authService: AuthService = supabaseAuthService
