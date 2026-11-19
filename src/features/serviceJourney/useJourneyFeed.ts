import { useCallback, useEffect, useRef, useState } from 'react'
import { requireSupabase } from '@/lib/supabase'
import { serviceJourney } from '@/services/serviceJourney.service'
import type { JourneySnapshot } from '@/types/serviceJourney'

export function useJourneyFeed(id: string) {
  const [data, setData] = useState<JourneySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const refreshAction = useRef<() => void>(undefined)
  const refresh = useCallback(() => refreshAction.current?.(), [])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    let inFlight = false
    let realtime = false
    let lastSuccess = 0
    let subscribed = false
    const client = requireSupabase()
    const filter = { schema: 'public', table: 'service_journeys', filter: `request_id=eq.${id}` }

    async function fetchLatest() {
      if (controller.signal.aborted) return
      if (inFlight) { pending = true; return }
      inFlight = true
      try {
        const snapshot = await serviceJourney.get(id, controller.signal)
        if (controller.signal.aborted) return
        lastSuccess = Date.now()
        setData(snapshot)
        setError(null)
        if (snapshot) {
          setClockOffset(Date.parse(snapshot.server_time) - lastSuccess)
          if (!subscribed) {
            subscribed = true
            channel.subscribe((status) => {
              if (controller.signal.aborted) return
              realtime = status === 'SUBSCRIBED'
              setConnected(realtime)
              if (realtime) void fetchLatest()
            })
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No se pudo consultar el recorrido.')
        }
      } finally {
        inFlight = false
        if (!controller.signal.aborted) setLoading(false)
        if (pending) { pending = false; void fetchLatest() }
      }
    }

    const channel = client.channel(`service-journey:${id}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', ...filter }, () => void fetchLatest())
      .on('postgres_changes', { event: 'UPDATE', ...filter }, () => void fetchLatest())
    function refreshIfVisible() {
      if (document.visibilityState === 'visible' && navigator.onLine) void fetchLatest()
    }
    function handleConnection() {
      setOnline(navigator.onLine)
      refreshIfVisible()
    }
    refreshAction.current = () => { void fetchLatest() }
    const timer = window.setInterval(() => {
      if (!realtime || Date.now() - lastSuccess >= 25_000) refreshIfVisible()
    }, 15_000)
    window.addEventListener('online', handleConnection)
    window.addEventListener('offline', handleConnection)
    document.addEventListener('visibilitychange', refreshIfVisible)
    void fetchLatest()
    return () => {
      controller.abort()
      refreshAction.current = undefined
      window.clearInterval(timer)
      window.removeEventListener('online', handleConnection)
      window.removeEventListener('offline', handleConnection)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      void client.removeChannel(channel)
    }
  }, [id])

  return { data, loading, error, connected, online, clockOffset, refresh }
}
