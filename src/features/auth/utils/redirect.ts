import { ROUTES } from '@/config/routes'
import type { User } from '@/types/user'

/** Decides where a user lands after authenticating. */
export function resolvePostAuthPath(user: User, requestedPath?: string | null): string {
  if (requestedPath === ROUTES.admin || requestedPath === `${ROUTES.admin}/`) return ROUTES.admin
  if (!user.accountType) return ROUTES.accountType
  if (typeof requestedPath === 'string' && requestedPath.startsWith(ROUTES.home)) return requestedPath
  return ROUTES.home
}
