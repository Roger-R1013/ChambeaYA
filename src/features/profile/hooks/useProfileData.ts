import { useCallback, useState } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { profileService } from '@/services/profile.service'

const loadCategories = () => profileService.listActiveCategories()
const loadZones = () => profileService.listServiceZones()

/** Active categories from `public.categories` (real catalogue, not mocks). */
export function useCatalogCategories() {
  return useAsyncData(loadCategories)
}

/** Active work zones from `public.service_zones`. */
export function useServiceZones() {
  return useAsyncData(loadZones)
}

/** The signed-in worker's professional profile. `reload()` fetches it again. */
export function useWorkerProfile(userId: string) {
  const [version, setVersion] = useState(0)
  // `version` is part of the loader identity so useAsyncData re-runs on reload().
  const loader = useCallback(() => {
    void version
    return profileService.getWorkerProfile(userId)
  }, [userId, version])
  const state = useAsyncData(loader)
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { ...state, reload }
}
