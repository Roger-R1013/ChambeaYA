import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { LocateFixed, MapPin, Navigation, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { DEFAULT_LOCATION } from '@/config/app'
import { buildServiceRequestPath } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { VectorMap, type VectorMarker } from '@/features/map/components/VectorMap'
import { VectorStyleControl } from '@/features/map/components/VectorStyleControl'
import type { VectorStyle } from '@/features/map/vectorStyles'
import { DestinationPicker } from '@/features/serviceJourney/DestinationPicker'
import { TRACKING } from '@/features/serviceJourney/tracking'
import { useJourneyFeed } from '@/features/serviceJourney/useJourneyFeed'
import { useJourneyGps } from '@/features/serviceJourney/useJourneyGps'
import { useJourneyRoute } from '@/features/serviceJourney/useJourneyRoute'
import { journeyRouting, type TravelMode } from '@/services/journeyRouting.service'
import type { GeoPoint } from '@/types/geo'
import type { JourneyEnd, JourneyStatus } from '@/types/serviceJourney'
import { formatDistance, getInitials } from '@/utils/format'
import { haversineDistanceKm } from '@/utils/geo'

const STATUS: Record<JourneyStatus, { label: string; tone: BadgeTone }> = {
  waiting: { label: 'Por iniciar', tone: 'neutral' },
  en_route: { label: 'En camino', tone: 'primary' },
  paused: { label: 'Seguimiento pausado', tone: 'warning' },
  arrived: { label: 'El profesional llegó', tone: 'success' },
  cancelled: { label: 'Servicio cancelado', tone: 'accent' },
}

const ACTION_LABEL: Record<JourneyEnd, string> = {
  pause: 'Detener seguimiento', arrive: 'He llegado', cancel: 'Cancelar servicio',
}

const ACTION_CONFIRM: Record<JourneyEnd, string> = {
  pause: 'Tu ubicación dejará de compartirse. Podrás iniciar el seguimiento de nuevo.',
  arrive: 'Se informará al cliente de tu llegada y dejarás de compartir tu ubicación.',
  cancel: 'Se informará al cliente de la cancelación y terminará el seguimiento.',
}

function elapsed(seconds: number) {
  const n = Math.floor(seconds < 60 ? seconds : seconds / 60)
  if (n === 0) return 'hace unos segundos'
  const unit = seconds < 60 ? 'segundo' : 'minuto'
  return `hace ${n} ${unit}${n === 1 ? '' : 's'}`
}

function WorkerControls({
  status, gps, hasDestination, started, online,
}: {
  status: JourneyStatus
  gps: ReturnType<typeof useJourneyGps>
  hasDestination: boolean
  started: boolean
  online: boolean
}) {
  const [decision, setDecision] = useState<JourneyEnd | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function confirm() {
    if (!decision || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await gps.finish(decision)
      setDecision(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el recorrido.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (status === 'arrived' || status === 'cancelled') return null

  return (
    <div className="flex flex-col gap-3">
      {!hasDestination && <p className="text-label text-ink-muted">El cliente debe confirmar el destino antes de iniciar el recorrido.</p>}
      {gps.message && <Alert tone="info">{gps.message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {decision ? (
        <>
          <Alert tone="info">{ACTION_CONFIRM[decision]}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant={decision === 'cancel' ? 'danger' : 'primary'} isLoading={saving} onClick={confirm}
              disabled={!online && decision !== 'pause'}>
              {ACTION_LABEL[decision]}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => { setDecision(null); setError(null) }}>Volver</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-label text-ink-muted">
            Al iniciar, compartirás tu ubicación con el cliente de este servicio. El navegador puede dejar de actualizarla en segundo plano o con la pantalla bloqueada.
          </p>
          <div className="flex flex-wrap gap-2">
            {gps.phase === 'idle' && status !== 'en_route' && hasDestination && (
              <Button leftIcon={Navigation} disabled={!online} onClick={gps.start}>Estoy en camino</Button>
            )}
            {gps.phase === 'locating' && <span role="status" className="self-center text-label text-ink-muted">Buscando señal GPS…</span>}
            {(gps.phase !== 'idle' || status === 'en_route') && (
              <Button variant="secondary" onClick={() => setDecision('pause')}>Detener seguimiento</Button>
            )}
            {started && <Button variant="outline" disabled={!online} onClick={() => setDecision('arrive')}>He llegado</Button>}
            <Button variant="ghost" disabled={!online} onClick={() => setDecision('cancel')}>Cancelar servicio</Button>
          </div>
        </>
      )}
    </div>
  )
}

function JourneyScreen({ id, userId }: { id: string; userId: string }) {
  const feed = useJourneyFeed(id)
  const data = feed.data
  const [now, setNow] = useState(Date.now)
  const [editing, setEditing] = useState(false)
  const [style, setStyle] = useState<VectorStyle>('liberty')
  const [focus, setFocus] = useState<{ point: GeoPoint; zoom: number; worker: boolean }>()
  const [mode, setMode] = useState<TravelMode | null>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const readClock = now + feed.clockOffset
  const status = data?.status === 'en_route' && data.lease_until && Date.parse(data.lease_until) <= readClock
    ? 'paused' : data?.status ?? 'waiting'
  const terminated = status === 'arrived' || status === 'cancelled' || (!feed.loading && !feed.error && !data)
  const isWorker = data?.worker_id === userId
  const gps = useJourneyGps(id, feed.refresh, terminated)
  const capturedAt = data?.last_fix_at ? Date.parse(data.last_fix_at) : null
  const age = capturedAt !== null ? Math.max(0, readClock - capturedAt) : null
  const destinationData = feed.online && feed.validated ? data?.destination : null
  const position = status === 'en_route' && feed.online && feed.validated ? data?.position ?? null : null
  const freshPosition = age !== null && age < TRACKING.freshMs ? position : null
  const lat = terminated ? undefined : destinationData?.lat
  const lng = terminated ? undefined : destinationData?.lng
  const destination = useMemo(() => typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null, [lat, lng])
  const route = useJourneyRoute(freshPosition, destination, mode, id)
  const lineDistance = freshPosition && destination ? haversineDistanceKm(freshPosition, destination) : null
  const workerName = data?.worker_name
  const markers = useMemo(() => {
    const points: VectorMarker[] = []
    if (destination) points.push({ id: 'destination', point: destination, kind: 'destination', label: 'Destino del servicio' })
    if (position && workerName) {
      points.push({
        id: 'worker', point: position, kind: 'worker', label: freshPosition ? workerName : `${workerName} · última ubicación conocida`,
        text: getInitials(workerName),
        motion: freshPosition && capturedAt !== null
          ? { capturedAt, lifetimeMs: TRACKING.freshMs, clockOffset: feed.clockOffset }
          : undefined,
      })
    }
    return points
  }, [destination, position, workerName, freshPosition, capturedAt, feed.clockOffset])
  const focusTarget = focus?.worker ? position : destination
  const mapFocus = focus && focusTarget?.lat === focus.point.lat && focusTarget.lng === focus.point.lng ? focus : undefined
  const back = buildServiceRequestPath(id)

  return (
    <div className="container-app flex flex-col gap-5 pt-6 md:pt-8">
      <PageHeader title={editing ? 'Seleccionar ubicación del servicio' : 'Seguimiento del servicio'} backTo={back} />
      {!feed.online && <Alert tone="info">Sin conexión. El seguimiento se consultará al recuperar internet.</Alert>}
      {feed.loading && feed.online && <LoadingState label="Cargando recorrido..." />}
      {feed.error && (
        <div className="flex flex-col gap-2">
          <Alert>{feed.error}</Alert>
          <Button variant="secondary" size="sm" className="self-start" leftIcon={RefreshCw} onClick={feed.refresh}>Reintentar</Button>
        </div>
      )}
      {!feed.loading && !feed.error && !data && <Alert tone="info">El seguimiento solo está disponible para las partes de una contratación confirmada.</Alert>}
      {data && (
        editing && !isWorker && destinationData && status === 'waiting' ? (
          <DestinationPicker id={id} destination={destinationData}
            onCancel={() => setEditing(false)} onSave={() => { setEditing(false); feed.refresh() }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="secondary" leftIcon={LocateFixed} disabled={!position && !destination}
                onClick={() => {
                  const point = position ?? destination
                  if (point) setFocus({ point, zoom: 15, worker: Boolean(position) })
                }}>Centrar mapa</Button>
              <VectorStyleControl value={style} onChange={setStyle} />
            </div>
            <VectorMap label="Mapa del recorrido" className="h-[min(55dvh,33rem)] min-h-72"
              style={style} center={destination ?? DEFAULT_LOCATION.point} zoom={destination ? 15 : 13}
              markers={markers} focus={mapFocus} fitPair={position && destination ? [position, destination] : undefined}
              route={route?.status === 'ready' ? route.geometry : undefined} />
            <Card padding="lg">
              <Section id="journey-progress" title={data.worker_name} description={data.category_name}
                action={<span role="status"><Badge dot tone={STATUS[status].tone}>{STATUS[status].label}</Badge></span>}>
                {feed.online && !feed.validated && !feed.error && (
                  <p role="status" className="text-caption text-ink-muted">Verificando el acceso al recorrido…</p>
                )}
                {feed.online && feed.validated && !feed.connected && !terminated && (
                  <p role="status" className="text-caption text-ink-muted">Reconectando en tiempo real. Las actualizaciones se consultan de forma periódica.</p>
                )}
                {age !== null && feed.validated && <p className="text-label text-ink-muted">Última lectura GPS {elapsed(age / 1000)}.</p>}
                {freshPosition && (
                  <p className="text-caption text-ink-muted">
                    Ubicación reciente · precisión de ±{Math.ceil(freshPosition.accuracy)} m
                    {freshPosition.accuracy > TRACKING.lowAccuracyMeters ? ' (señal de baja precisión)' : ''}
                  </p>
                )}
                {status === 'en_route' && feed.validated && !freshPosition && (
                  <p role="status" className="text-label font-semibold text-ink">
                    {age === null ? 'Esperando la primera ubicación del trabajador.' : 'Ubicación sin actualizar'}
                  </p>
                )}
                {status === 'paused' && <p className="text-label text-ink-muted">La ubicación ya no se comparte.</p>}
                {terminated && <p className="text-label text-ink-muted">Seguimiento finalizado.</p>}
                {destinationData && status !== 'cancelled' && (
                  <div className="flex items-start gap-2 text-label text-ink-muted">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
                    <div className="min-w-0 wrap-break-word">
                      <p>{destinationData.address}</p>
                      {destinationData.reference && <p>{destinationData.reference}</p>}
                    </div>
                  </div>
                )}
                {!isWorker && status === 'waiting' && destinationData && (
                  <Button variant="secondary" className="self-start" leftIcon={MapPin} disabled={!feed.online}
                    onClick={() => setEditing(true)}>
                    {destination ? 'Cambiar ubicación del servicio' : 'Seleccionar ubicación del servicio'}
                  </Button>
                )}
                {freshPosition && destination && (
                  <div className="flex flex-col items-start gap-2 text-label text-ink-muted">
                    {journeyRouting && (
                      <Select aria-label="Modo de desplazamiento de la ruta" value={mode ?? ''} onChange={(event) => {
                        const value = event.target.value
                        setMode(value === 'walk' || value === 'cycle' || value === 'drive' ? value : null)
                      }}>
                        <option value="">Modo para solicitar ruta</option>
                        <option value="walk">A pie</option><option value="cycle">En bicicleta</option><option value="drive">En vehículo</option>
                      </Select>
                    )}
                    {route?.status === 'ready' ? (
                      <p>Ruta por calles: {formatDistance(route.distanceMeters / 1000)} · Estimación según el modo elegido: {Math.ceil(route.durationSeconds / 60)} min.</p>
                    ) : (
                      <>
                        {lineDistance !== null && Number.isFinite(lineDistance) && <p>Distancia en línea recta: {formatDistance(lineDistance)}.</p>}
                        <p>{journeyRouting && mode && !route ? 'Consultando ruta por calles…' : 'Ruta por calles y tiempo de llegada no disponibles.'}</p>
                      </>
                    )}
                  </div>
                )}
                {isWorker && <WorkerControls status={status} gps={gps} hasDestination={Boolean(destination)}
                  started={Boolean(data.started_at)} online={feed.online} />}
              </Section>
            </Card>
          </>
        )
      )}
    </div>
  )
}

export function ServiceJourneyPage() {
  const { requestId = '' } = useParams()
  const { user } = useAuth()
  if (!user) return null
  return <JourneyScreen key={`${user.id}:${requestId}`} id={requestId} userId={user.id} />
}
