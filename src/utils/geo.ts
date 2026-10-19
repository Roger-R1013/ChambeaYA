import type { GeoPoint, LngLatTuple } from '@/types/geo'

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in kilometers (Haversine formula). */
export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/** MapLibre expects coordinates as [lng, lat]. */
export function toLngLat(point: GeoPoint): LngLatTuple {
  return [point.lng, point.lat]
}
