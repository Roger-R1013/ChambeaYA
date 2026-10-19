import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { authService } from '@/services/auth.service'
import type { AccountType, LoginCredentials, RegisterPayload, User } from '@/types/user'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = useCallback(async (authUser: SupabaseUser | null) => {
    if (!authUser) {
      setUser(null)
      return null
    }
    const profile = await authService.fetchProfile(authUser)
    setUser(profile)
    return profile
  }, [])

  // Restaura la sesión al abrir la app y escucha cambios de sesión.
  useEffect(() => {
    let active = true

    authService
      .getSession()
      .then((session) => (active ? loadProfile(session?.user ?? null) : null))
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    const unsubscribe = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      // Se difiere para no llamar a Supabase dentro del propio callback.
      setTimeout(() => {
        if (active) loadProfile(session?.user ?? null).catch(() => setUser(null))
      }, 0)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [loadProfile])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const authUser = await authService.login(credentials)
      return loadProfile(authUser)
    },
    [loadProfile],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const outcome = await authService.register(payload)
      // Si hay que confirmar el correo, todavía no hay sesión.
      if (!outcome.session || !outcome.authUser) return null
      return loadProfile(outcome.authUser)
    },
    [loadProfile],
  )

  const selectAccountType = useCallback(
    async (accountType: AccountType) => {
      await authService.setAccountType(accountType)
      const session = await authService.getSession()
      if (!session) throw new Error('No hay una sesión activa.')
      return loadProfile(session.user)
    },
    [loadProfile],
  )

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, register, selectAccountType, logout }),
    [user, isLoading, login, register, selectAccountType, logout],
  ) as AuthContextValue

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}