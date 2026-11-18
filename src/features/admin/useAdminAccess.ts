import { useCallback } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { adminService } from '@/services/admin.service'

export function useAdminAccess(userId?: string) {
  const checkAccess = useCallback(
    (signal: AbortSignal) => userId ? adminService.isAdmin(signal) : Promise.resolve(false),
    [userId],
  )
  return useAsyncData(checkAccess)
}
