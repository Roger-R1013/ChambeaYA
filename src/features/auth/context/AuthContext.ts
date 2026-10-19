import { createContext } from 'react'
import type { AccountType, LoginCredentials, RegisterPayload, User } from '@/types/user'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  selectAccountType: (accountType: AccountType) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
