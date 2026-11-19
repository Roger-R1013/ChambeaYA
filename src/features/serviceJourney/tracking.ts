import type { GeoPosition } from '@/types/geo'
import { haversineDistanceKm } from '@/utils/geo'

// GPS age and accuracy also have server-side limits. Keep those limits aligned
// with publish_service_position when tuning the client.
export const TRACKING = {
  tickMs: 4_000,
  freshMs: 45_000,
  heartbeatMs: 20_000,
  gpsRefreshMs: 28_000,
  gpsTimeoutMs: 10_000,
  maxAccuracyMeters: 100,
  lowAccuracyMeters: 50,
  maxGroundSpeedMps: 45,
  movingPublishMs: 8_000,
  stationaryPublishMs: 28_000,
  minMovementMeters: 15,
  serverClockToleranceMs: 5_000,
  fallbackPollMs: 15_000,
  realtimeSilenceMs: 30_000,
  readTimeoutMs: 10_000,
  channelRetryMinMs: 8_000,
  retryMaxMs: 48_000,
}

export type JourneyFix = GeoPosition & { accuracy: number }

export function classifyFix(point: JourneyFix, previous: JourneyFix | undefined, now: number) {
  if (!Number.isFinite(point.timestamp) || now - point.timestamp >= TRACKING.freshMs
    || point.timestamp > now + TRACKING.serverClockToleranceMs
    || (previous && point.timestamp <= previous.timestamp)) return 'old'
  if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90
    || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180
    || !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > TRACKING.maxAccuracyMeters) return 'imprecise'

  if (previous) {
    const seconds = (point.timestamp - previous.timestamp) / 1000
    const displacement = haversineDistanceKm(previous, point) * 1000
    if (displacement > TRACKING.maxGroundSpeedMps * seconds + previous.accuracy + point.accuracy) return 'jump'
  }
  return 'valid'
}

export function shouldPublishFix(point: JourneyFix, previous: { point: JourneyFix; at: number } | undefined, now: number) {
  if (now - point.timestamp >= TRACKING.freshMs) return false
  if (!previous) return true
  const elapsed = now - previous.at
  if (elapsed >= TRACKING.stationaryPublishMs) return true
  const movement = haversineDistanceKm(point, previous.point) * 1000
  const noise = Math.max(TRACKING.minMovementMeters, Math.min(35, point.accuracy, previous.point.accuracy))
  return elapsed >= TRACKING.movingPublishMs && movement >= noise
}

export function trackingBackoff(attempt: number, firstMs: number, maxMs = TRACKING.retryMaxMs) {
  return Math.min(firstMs * 2 ** Math.min(attempt, 6), maxMs)
}
