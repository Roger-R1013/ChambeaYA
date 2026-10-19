import { Navigate, Outlet, useLocation } from 'react-router'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { resolvePostAuthPath } from '@/features/auth/utils/redirect'

/** Only for authenticated users; preserves the requested path for after login. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Forces account type selection before entering the app. */
export function RequireAccountType() {
  const { user } = useAuth()
  if (user && !user.accountType) return <Navigate to={ROUTES.accountType} replace />
  return <Outlet />
}

/** Public-only screens (welcome/login/register) redirect signed-in users. */
export function GuestOnly() {
  const { user } = useAuth()
  if (user) return <Navigate to={resolvePostAuthPath(user)} replace />
  return <Outlet />
}
