import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabase'
import { serviceJourney } from '@/services/serviceJourney.service'
import type { JourneySnapshot } from '@/types/serviceJourney'
import { TRACKING, trackingBackoff } from './tracking'

export function useJourneyFeed(id: string) {
  const [data, setData] = useState<JourneySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [connected, setConnected] = useState(false)
  const [validated, setValidated] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const refreshAction = useRef<() => void>(undefined)
  const removing = useRef<Promise<unknown>>(undefined)
  const refresh = useCallback(() => refreshAction.current?.(), [])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    let inFlight = false
    let realtime = false
    let lastSuccess = 0
    let readFailures = 0
    let readAfter = 0
    let channel: RealtimeChannel | undefined
    let channelFailures = 0
    let channelAfter = 0
    let rejoinSince: number | undefined
    let connectionVersion = 0
    const client = requireSupabase()
    const filter = { schema: 'public', table: 'service_journeys', filter: `request_id=eq.${id}` }
    const canRead = () => !controller.signal.aborted && navigator.onLine && document.visibilityState === 'visible'

    function removeChannel() {
      const current = channel
      if (!current) return
      channel = undefined
      realtime = false
      rejoinSince = undefined
      removing.current = client.removeChannel(current).catch(() => undefined)
    }

    async function ensureChannel(version: number) {
      await removing.current
      if (!canRead() || version !== connectionVersion || channel || Date.now() < channelAfter) return
      const current = client.channel(`service-journey:${id}`, { config: { private: true } })
      channel = current
      const onChange = () => { if (channel === current) void fetchLatest() }
      current.on('postgres_changes', { event: 'INSERT', ...filter }, onChange)
      current.on('postgres_changes', { event: 'UPDATE', ...filter }, onChange)
      current.subscribe((status) => {
        if (controller.signal.aborted || channel !== current) return
        realtime = status === 'SUBSCRIBED'
        setConnected(realtime)
        if (realtime) {
          channelFailures = 0
          rejoinSince = undefined
          void fetchLatest()
        } else if (status === 'CLOSED') {
          scheduleRejoin()
        } else {
          // Let the SDK try its own socket/channel backoff before replacing this subscription.
          rejoinSince ??= Date.now()
        }
      })
    }

    function scheduleRejoin() {
      channelAfter = Date.now() + trackingBackoff(channelFailures++, TRACKING.channelRetryMinMs)
      removeChannel()
      setConnected(false)
    }

    async function fetchLatest(force = false) {
      if (!canRead() || (!force && Date.now() < readAfter)) return
      if (inFlight) { pending = true; return }
      inFlight = true
      const version = connectionVersion
      const sentAt = Date.now()
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TRACKING.readTimeoutMs)])
        const snapshot = await serviceJourney.get(id, signal)
        if (!canRead() || version !== connectionVersion) return
        lastSuccess = Date.now()
        readFailures = 0
        readAfter = 0
        setData(snapshot)
        setError(null)
        setValidated(Boolean(snapshot))
        if (snapshot) {
          // Use the start of the request as a conservative server clock bound for lease expiry.
          setClockOffset(Date.parse(snapshot.server_time) - sentAt)
          if (rejoinSince !== undefined && lastSuccess - rejoinSince >= TRACKING.realtimeSilenceMs) scheduleRejoin()
          try {
            await ensureChannel(version)
          } catch {
            if (canRead()) scheduleRejoin()
          }
        } else {
          removeChannel()
          setConnected(false)
        }
      } catch (cause) {
        if (canRead() && version === connectionVersion) {
          readAfter = Date.now() + trackingBackoff(readFailures++, TRACKING.fallbackPollMs)
          setValidated(false)
          setError(cause instanceof Error ? cause.message : 'No se pudo consultar el recorrido.')
        }
      } finally {
        inFlight = false
        if (!controller.signal.aborted) setLoading(false)
        if (pending) { pending = false; void fetchLatest() }
      }
    }

    function revalidate() {
      connectionVersion++
      setValidated(false)
      if (canRead()) {
        readAfter = 0
        void fetchLatest()
      }
    }

    function handleConnection() {
      setOnline(navigator.onLine)
      revalidate()
    }
    refreshAction.current = () => { void fetchLatest(true) }
    const timer = window.setInterval(() => {
      if (!realtime || Date.now() - lastSuccess >= TRACKING.realtimeSilenceMs) void fetchLatest()
    }, TRACKING.fallbackPollMs)
    window.addEventListener('online', handleConnection)
    window.addEventListener('offline', handleConnection)
    document.addEventListener('visibilitychange', revalidate)
    void fetchLatest()
    return () => {
      controller.abort()
      refreshAction.current = undefined
      window.clearInterval(timer)
      window.removeEventListener('online', handleConnection)
      window.removeEventListener('offline', handleConnection)
      document.removeEventListener('visibilitychange', revalidate)
      removeChannel()
    }
  }, [id])

  return { data, loading, error, connected, online, validated, clockOffset, refresh }
}
