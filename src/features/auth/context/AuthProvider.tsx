import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { authService } from '@/services/auth.service'
import type { AccountType, LoginCredentials, RegisterPayload, User } from '@/types/user'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser())

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextUser = await authService.login(credentials)
    setUser(nextUser)
    return nextUser
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const nextUser = await authService.register(payload)
    setUser(nextUser)
    return nextUser
  }, [])

  const selectAccountType = useCallback(async (accountType: AccountType) => {
    const nextUser = await authService.updateAccountType(accountType)
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, register, selectAccountType, logout }),
    [user, login, register, selectAccountType, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
