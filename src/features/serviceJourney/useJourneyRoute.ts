import { useEffect, useRef, useState } from 'react'
import { journeyRouting, type RoadRoute, type TravelMode } from '@/services/journeyRouting.service'
import type { GeoPoint } from '@/types/geo'
import { haversineDistanceKm } from '@/utils/geo'

export function useJourneyRoute(origin: GeoPoint | null, destination: GeoPoint | null, mode: TravelMode | null, requestId: string) {
  const key = origin && destination && mode ? `${destination.lat}:${destination.lng}:${mode}` : null
  const last = useRef<{ key: string; point: GeoPoint; at: number; controller: AbortController } | null>(null)
  const [result, setResult] = useState<{ key: string; route: RoadRoute } | null>(null)

  useEffect(() => () => { last.current?.controller.abort(); last.current = null }, [])
  useEffect(() => {
    if (!key || !journeyRouting || !origin || !destination || !mode) {
      last.current?.controller.abort()
      last.current = null
      return
    }
    const previous = last.current
    const now = Date.now()
    if (previous?.key === key && (now - previous.at < 45_000 || haversineDistanceKm(previous.point, origin) < 0.15)) return
    previous?.controller.abort()
    const controller = new AbortController()
    last.current = { key, point: origin, at: now, controller }
    void journeyRouting.getRoute({ requestId, origin, destination, mode, signal: controller.signal })
      .then((route) => { if (!controller.signal.aborted) setResult({ key, route }) })
  }, [key, origin, destination, mode, requestId])

  return key && result?.key === key ? result.route : null
}
