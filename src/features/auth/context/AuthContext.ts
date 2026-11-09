import { createContext } from 'react'
import type { AccountType, LoginCredentials, RegisterPayload, User } from '@/types/user'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  selectAccountType: (accountType: AccountType) => Promise<User>
  /** Reloads `profiles` for the current session (e.g. after editing personal data). */
  refreshProfile: () => Promise<User | null>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
