import { useCallback, useEffect, useRef, useState } from 'react'
import { JourneyError, serviceJourney } from '@/services/serviceJourney.service'
import type { JourneyEnd } from '@/types/serviceJourney'
import { classifyFix, shouldPublishFix, TRACKING, trackingBackoff, type JourneyFix } from './tracking'

type GpsPhase = 'idle' | 'locating' | 'sharing'

const GPS_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: TRACKING.gpsTimeoutMs }

interface ActiveWatch {
  session: string
  watchId?: number
  stopTimer?: () => void
  startRequest?: Promise<unknown>
  started: boolean
  busy: boolean
  reading: boolean
  failures: number
  retryAfter: number
  lastActivity: number
  lastReadAttempt: number
  latest?: JourneyFix
  sent?: { point: JourneyFix; at: number }
}

export function useJourneyGps(id: string, refresh: () => void, terminated: boolean) {
  const active = useRef<ActiveWatch | null>(null)
  const [phase, setPhase] = useState<GpsPhase>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const clearWatch = useCallback(() => {
    const current = active.current
    active.current = null
    if (current?.watchId !== undefined) navigator.geolocation.clearWatch(current.watchId)
    current?.stopTimer?.()
    return current
  }, [])

  const pauseInBackground = useCallback((watch: ActiveWatch | null) => {
    if (!watch?.startRequest) return
    const pause = () => serviceJourney.finish(id, 'pause', watch.session)
    // If start is still in flight, pause that same session after the request settles.
    const request = watch.started ? pause() : watch.startRequest.then(pause, pause)
    void request.catch(() => undefined)
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
    if (!terminated || !active.current) return
    clearWatch()
    queueMicrotask(() => setPhase('idle'))
  }, [terminated, clearWatch])

  function start() {
    if (active.current || terminated) return
    if (!navigator.geolocation) {
      setMessage('El navegador no permite obtener tu ubicación. Abre la aplicación en HTTPS o localhost.')
      return
    }
    setMessage(null)
    const watch: ActiveWatch = {
      session: crypto.randomUUID(), started: false, busy: false, reading: false,
      failures: 0, retryAfter: 0, lastActivity: 0, lastReadAttempt: Date.now(),
    }
    active.current = watch
    setPhase('locating')

    function canUpdate() {
      return active.current === watch && document.visibilityState === 'visible' && navigator.onLine
    }

    async function flush() {
      const now = Date.now()
      if (!canUpdate() || watch.busy || now < watch.retryAfter) return
      const point = watch.latest
      const publish = point && shouldPublishFix(point, watch.sent, now)
      if (!publish && (!watch.started || now - watch.lastActivity < TRACKING.heartbeatMs)) return

      watch.busy = true
      try {
        if (!watch.started) {
          watch.startRequest = serviceJourney.start(id, watch.session)
          await watch.startRequest
          watch.started = true
          watch.lastActivity = now
          if (active.current !== watch) return
          setPhase('sharing')
          refresh()
        }
        if (!canUpdate()) return
        if (publish && point && shouldPublishFix(point, watch.sent, Date.now())) {
          const sentAt = Date.now()
          const saved = await serviceJourney.publish(id, watch.session, point)
          if (active.current !== watch) return
          if (watch.latest === point) watch.latest = undefined
          if (saved) {
            if (!watch.sent || watch.failures > 0) refresh()
            watch.lastActivity = sentAt
            watch.sent = { point, at: sentAt }
            setMessage(null)
          }
        }
        const heartbeatAt = Date.now()
        if (canUpdate() && heartbeatAt - watch.lastActivity >= TRACKING.heartbeatMs) {
          await serviceJourney.heartbeat(id, watch.session)
          if (active.current !== watch) return
          watch.lastActivity = heartbeatAt
          if (watch.failures > 0) {
            setMessage(null)
            refresh()
          }
        }
        watch.failures = 0
      } catch (cause) {
        if (active.current !== watch) return
        if (cause instanceof JourneyError) {
          clearWatch()
          setPhase('idle')
          setMessage(cause.message)
          refresh()
        } else {
          watch.retryAfter = Date.now() + trackingBackoff(watch.failures++, 3_000, 16_000)
          setMessage('No se pudo actualizar el seguimiento. Se reintentará automáticamente.')
        }
      } finally {
        watch.busy = false
      }
    }

    let lastValid: JourneyFix | undefined
    function receive(position: GeolocationPosition) {
      if (active.current !== watch) return
      const { latitude: lat, longitude: lng, accuracy } = position.coords
      const point = { lat, lng, accuracy, timestamp: position.timestamp }
      const quality = classifyFix(point, lastValid, Date.now())
      if (quality === 'old') return
      if (quality !== 'valid') {
        setMessage(quality === 'jump' ? 'Esperando una lectura GPS que confirme el desplazamiento.' : 'Esperando una ubicación con mejor precisión GPS.')
        return
      }
      lastValid = point
      watch.latest = point
      void flush()
    }

    function handleGpsError(error: GeolocationPositionError) {
      if (active.current !== watch) return
      if (error.code === error.PERMISSION_DENIED) {
        pauseInBackground(clearWatch())
        setPhase('idle')
        setMessage('Permiso de ubicación denegado. Puedes cambiarlo en los permisos de este sitio.')
        refresh()
      } else {
        setMessage('El GPS dejó de responder. Esperando una nueva lectura.')
      }
    }

    function tick() {
      if (!canUpdate()) return
      void flush()
      const now = Date.now()
      if (watch.reading || now - Math.max(lastValid?.timestamp ?? 0, watch.lastReadAttempt) < TRACKING.gpsRefreshMs) return
      watch.reading = true
      watch.lastReadAttempt = now
      // watchPosition can go quiet while stationary. Ask for a new reading rather than replaying the old one.
      navigator.geolocation.getCurrentPosition(
        (position) => { watch.reading = false; receive(position) },
        (error) => { watch.reading = false; handleGpsError(error) },
        GPS_OPTIONS,
      )
    }

    try {
      watch.watchId = navigator.geolocation.watchPosition(receive, handleGpsError, GPS_OPTIONS)
      const timer = window.setInterval(tick, TRACKING.tickMs)
      const reconnect = () => {
        watch.retryAfter = 0
        tick()
      }
      window.addEventListener('online', reconnect)
      document.addEventListener('visibilitychange', tick)
      watch.stopTimer = () => {
        window.clearInterval(timer)
        window.removeEventListener('online', reconnect)
        document.removeEventListener('visibilitychange', tick)
      }
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
    if (action === 'pause' && current && !current.startRequest) return
    if (current && !current.started) await current.startRequest?.catch(() => undefined)
    await serviceJourney.finish(id, action, action === 'pause' ? current?.session : undefined)
    refresh()
  }

  return { start, finish, phase, message }
}
