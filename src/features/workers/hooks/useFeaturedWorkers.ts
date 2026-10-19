import { useCallback } from 'react'
import { DEFAULT_LOCATION } from '@/config/app'
import { useAsyncData } from '@/hooks/useAsyncData'
import { workersService } from '@/services/workers.service'

/**
 * Featured workers relative to the viewer. The origin is static for now;
 * it will come from the Geolocation API in the maps stage.
 */
export function useFeaturedWorkers() {
  const origin = DEFAULT_LOCATION.point
  const loader = useCallback(() => workersService.getFeatured(origin), [origin])
  return useAsyncData(loader)
}
