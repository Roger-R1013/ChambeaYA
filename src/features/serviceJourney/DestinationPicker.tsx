import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { DEFAULT_LOCATION } from '@/config/app'
import { isInServiceArea } from '@/config/map'
import { VectorMap } from '@/features/map/components/VectorMap'
import { VectorStyleControl } from '@/features/map/components/VectorStyleControl'
import type { VectorStyle } from '@/features/map/vectorStyles'
import { useGeolocation } from '@/hooks/useGeolocation'
import { serviceJourney } from '@/services/serviceJourney.service'
import type { GeoPoint } from '@/types/geo'
import type { JourneySnapshot } from '@/types/serviceJourney'

export function DestinationPicker({ id, destination, onSave, onCancel }: {
  id: string
  destination: NonNullable<JourneySnapshot['destination']>
  onSave: () => void
  onCancel: () => void
}) {
  const [initial] = useState(() => destination.lat !== null && destination.lng !== null
    ? { lat: destination.lat, lng: destination.lng } : DEFAULT_LOCATION.point)
  const [center, setCenter] = useState<GeoPoint>(initial)
  const [reference, setReference] = useState(destination.reference ?? '')
  const [style, setStyle] = useState<VectorStyle>('liberty')
  const [ready, setReady] = useState(false)
  const [moving, setMoving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const { state: location, request } = useGeolocation({ maximumAge: 0 })
  const gps = location.status === 'granted' ? location.point : null
  const focus = useMemo(() => gps ? { point: gps, zoom: 16 } : undefined, [gps])
  const markReady = useCallback(() => setReady(true), [])
  const point = !ready && gps ? gps : center
  const valid = isInServiceArea(point)

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !valid || moving || (!ready && !gps)) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await serviceJourney.setDestination(id, point, reference.trim())
      onSave()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el destino.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" leftIcon={LocateFixed} onClick={request}
          isLoading={location.status === 'requesting'} disabled={saving}>Usar mi ubicación</Button>
        <VectorStyleControl value={style} onChange={setStyle} />
      </div>
      {'message' in location && <Alert tone="info">{location.message}</Alert>}
      <VectorMap label="Seleccionar ubicación del servicio" className="h-[min(62dvh,36rem)] min-h-72"
        style={style} center={initial} zoom={15} focus={focus}
        onCenterChange={setCenter} onMovingChange={setMoving} onReady={markReady}>
        <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-10 -translate-x-1/2 -translate-y-full fill-white text-primary-700 drop-shadow-md" />
      </VectorMap>
      <div className="flex flex-col gap-1 text-label text-ink-muted">
        <p>Mueve el mapa hasta colocar el marcador sobre el destino.</p>
        <p className="wrap-break-word">Dirección indicada en la solicitud: {destination.address}</p>
        {(ready || gps) && <p>Coordenadas seleccionadas: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>}
        {!valid && <p>Elige un punto dentro del área metropolitana de Santa Cruz.</p>}
      </div>
      <FormField id="journey-reference" label="Referencia para encontrar el lugar" hint="Opcional">
        {(props) => <Input {...props} value={reference} maxLength={300} disabled={saving} onChange={(event) => setReference(event.target.value)} />}
      </FormField>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={moving || !valid || (!ready && !gps)} isLoading={saving}>Listo</Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>Volver</Button>
      </div>
    </form>
  )
}
