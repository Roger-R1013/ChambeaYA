import { useCallback, useEffect, useState } from 'react'
import type { GeoPoint } from '@/types/geo'

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'granted'; point: GeoPoint; accuracy: number }
  | { status: 'denied' | 'unavailable' | 'error'; message: string }

const MESSAGES = {
  denied:
    'No diste permiso para usar tu ubicación. Puedes activarlo desde la configuración del navegador o continuar sin ubicación.',
  unavailable: 'Tu dispositivo no puede obtener la ubicación en este momento.',
  timeout: 'No se pudo obtener tu ubicación a tiempo. Inténtalo de nuevo.',
  unsupported: 'Tu navegador no permite obtener la ubicación.',
} as const

/**
 * One-shot browser geolocation (no continuous tracking: that is Phase 6).
 * The permission prompt only appears when `request()` is called by the user.
 * With `autoIfGranted`, a position is read silently only if the user already
 * granted the permission earlier.
 */
export function useGeolocation({ autoIfGranted = false }: { autoIfGranted?: boolean } = {}) {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' })

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', message: MESSAGES.unsupported })
      return
    }
    setState({ status: 'requesting' })
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: 'granted',
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setState({ status: 'denied', message: MESSAGES.denied })
        else if (error.code === error.TIMEOUT) setState({ status: 'error', message: MESSAGES.timeout })
        else setState({ status: 'unavailable', message: MESSAGES.unavailable })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  useEffect(() => {
    if (!autoIfGranted || !navigator.permissions?.query) return
    let active = true
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permission) => {
        if (active && permission.state === 'granted') request()
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [autoIfGranted, request])

  return { state, request }
}

