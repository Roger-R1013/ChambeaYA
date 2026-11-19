import { useCallback, useEffect, useRef, useState } from 'react'
import { JourneyError, serviceJourney } from '@/services/serviceJourney.service'
import type { GeoPosition } from '@/types/geo'
import type { JourneyEnd } from '@/types/serviceJourney'
import { haversineDistanceKm } from '@/utils/geo'

type GpsPhase = 'idle' | 'locating' | 'sharing'

interface ActiveWatch {
  session: string
  watchId?: number
  attempted: boolean
  started: boolean
  busy: boolean
  failures: number
  retryAfter: number
  sent?: { point: GeoPosition; at: number }
}

export function useJourneyGps(id: string, refresh: () => void, terminated: boolean, expired: boolean) {
  const active = useRef<ActiveWatch | null>(null)
  const [phase, setPhase] = useState<GpsPhase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const clearWatch = useCallback(() => {
    const current = active.current
    active.current = null
    if (current?.watchId !== undefined) navigator.geolocation.clearWatch(current.watchId)
    return current
  }, [])

  const pauseInBackground = useCallback((watch: ActiveWatch | null) => {
    if (watch?.attempted) void serviceJourney.finish(id, 'pause', watch.session).catch(() => undefined)
  }, [id])

  useEffect(() => {
    const leave = () => {
      pauseInBackground(clearWatch())
      setPhase('idle')
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      pauseInBackground(clearWatch())
    }
  }, [clearWatch, pauseInBackground])

  useEffect(() => {
    if (!terminated && !(expired && active.current?.started)) return
    clearWatch()
    queueMicrotask(() => {
      setPhase('idle')
      if (expired && !terminated) setMessage('El seguimiento se pausó al dejar de recibir lecturas de GPS.')
    })
  }, [terminated, expired, clearWatch])

  function start() {
    if (active.current || terminated) return
    if (!navigator.geolocation) {
      setMessage('El navegador no permite obtener tu ubicación. Abre la aplicación en HTTPS o localhost.')
      return
    }
    setMessage(null)
    const watch: ActiveWatch = {
      session: crypto.randomUUID(), attempted: false, started: false, busy: false, failures: 0, retryAfter: 0,
    }
    active.current = watch
    setPhase('locating')

    async function receive(position: GeolocationPosition) {
      const now = Date.now()
      if (active.current !== watch || watch.busy || now < watch.retryAfter || !navigator.onLine) return
      const { latitude: lat, longitude: lng, accuracy } = position.coords
      if (accuracy > 100 || !Number.isFinite(accuracy) || now - position.timestamp > 45_000) {
        setMessage('Esperando una ubicación reciente con mejor precisión GPS.')
        return
      }
      const point = { lat, lng, accuracy, timestamp: position.timestamp }
      if (watch.sent) {
        const elapsed = now - watch.sent.at
        if (elapsed < 8_000 || (elapsed < 22_000 && haversineDistanceKm(watch.sent.point, point) < 0.015)) return
      }

      watch.busy = true
      try {
        if (!watch.started) {
          watch.attempted = true
          await serviceJourney.start(id, watch.session)
          watch.started = true
          if (active.current !== watch) { pauseInBackground(watch); return }
          setPhase('sharing')
        }
        if (await serviceJourney.publish(id, watch.session, point)) {
          if (active.current !== watch) return
          if (!watch.sent || watch.failures > 0) refresh()
          watch.sent = { point, at: now }
          setMessage(null)
        }
        watch.failures = 0
      } catch (cause) {
        if (active.current !== watch) return
        watch.failures += 1
        if (watch.failures >= 3 || cause instanceof JourneyError) {
          const stopped = clearWatch()
          if (!(cause instanceof JourneyError)) pauseInBackground(stopped)
          setPhase('idle')
          setMessage(cause instanceof Error ? cause.message : 'Se detuvo el envío de la ubicación.')
          refresh()
        } else {
          watch.retryAfter = Date.now() + (3_000 * watch.failures)
          setMessage('No se pudo enviar la posición. Se reintentará con una nueva lectura del GPS.')
        }
      } finally {
        watch.busy = false
      }
    }

    try {
      watch.watchId = navigator.geolocation.watchPosition(
        (position) => { void receive(position) },
        (error) => {
          if (active.current !== watch) return
          if (error.code === error.PERMISSION_DENIED) {
            pauseInBackground(clearWatch())
            setPhase('idle')
            setMessage('Permiso de ubicación denegado. Puedes cambiarlo en los permisos de este sitio.')
            refresh()
          } else {
            setMessage('El GPS dejó de responder. Esperando una nueva lectura.')
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 16_000 },
      )
    } catch {
      clearWatch()
      setPhase('idle')
      setMessage('No se pudo iniciar el GPS en este navegador.')
    }
  }

  async function finish(action: JourneyEnd) {
    const current = clearWatch()
    setPhase('idle')
    setMessage(null)
    if (action === 'pause' && current && !current.attempted) return
    await serviceJourney.finish(id, action, action === 'pause' ? current?.session : undefined)
    refresh()
  }

  return { start, finish, phase, message }
}
