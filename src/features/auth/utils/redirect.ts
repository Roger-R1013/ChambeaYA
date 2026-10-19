import { ROUTES } from '@/config/routes'
import type { User } from '@/types/user'

/** Decides where a user lands after authenticating. */
export function resolvePostAuthPath(user: User, requestedPath?: string | null): string {
  if (!user.accountType) return ROUTES.accountType
  if (requestedPath && requestedPath.startsWith(ROUTES.home)) return requestedPath
  return ROUTES.home
}
