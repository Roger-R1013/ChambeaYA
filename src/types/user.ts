export type AccountType = 'client' | 'worker'

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  accountType: AccountType | null
  avatarUrl?: string
  createdAt: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe: boolean
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  /** Chosen before sign-up; validated again by the database trigger. */
  accountType: AccountType
}

/**
 * Sign-up outcome. When email confirmation is enabled in Supabase there is no
 * session yet: the user must open the link sent to their inbox.
 */
export type RegisterResult =
  | { status: 'signed_in'; user: User }
  | { status: 'confirmation_required'; email: string }
