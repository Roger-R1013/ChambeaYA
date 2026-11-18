import { useCallback, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { isInServiceArea } from '@/config/map'
import { ServiceMap, UserLocationMarker } from '@/features/map/components/ServiceMap'
import { AVAILABILITY_META } from '@/features/workers/availability'
import { useAsyncData } from '@/hooks/useAsyncData'
import { availabilityService, type SharedLocation } from '@/services/availability.service'
import type { GeoPoint } from '@/types/geo'
import type { WorkerAvailability } from '@/types/worker'

const STATUSES: WorkerAvailability[] = ['available', 'busy', 'offline']

export function WorkerAvailabilitySettings({ userId }: { userId: string }) {
  const loadSettings = useCallback(
    () => Promise.all([availabilityService.getAvailability(userId), availabilityService.getLocation(userId)]),
    [userId],
  )
  const settings = useAsyncData(loadSettings)

  if (settings.status === 'loading') return <LoadingState label="Cargando disponibilidad..." />
  if (settings.status === 'error') return <Alert>{settings.error.message}</Alert>

  return (
    <AvailabilityEditor
      key={userId}
      userId={userId}
      initialAvailability={settings.data[0]}
      initialLocation={settings.data[1]}
    />
  )
}

function AvailabilityEditor({ userId, initialAvailability, initialLocation }: {
  userId: string
  initialAvailability: WorkerAvailability
  initialLocation: SharedLocation | null
}) {
  const [availability, setAvailability] = useState(initialAvailability)
  const [sharedLocation, setSharedLocation] = useState(initialLocation)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GeoPoint | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateSettings(update: () => Promise<void>) {
    setSaving(true)
    setError(null)
    try {
      await update()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  function selectPoint(point: GeoPoint) {
    if (saving) return
    if (!isInServiceArea(point)) {
      setError('Selecciona un punto dentro del área metropolitana de Santa Cruz de la Sierra.')
      return
    }
    setError(null)
    setDraft(point)
  }

  const mapPoint = draft ?? sharedLocation?.point
  const locationMessage = !sharedLocation
    ? 'Aún no has compartido una ubicación.'
    : availability === 'offline'
      ? 'Tu ubicación aproximada está guardada. Tu marcador se oculta mientras estés desconectado.'
      : 'Tienes una ubicación aproximada compartida.'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2" role="group" aria-label="Estado de disponibilidad">
        {STATUSES.map((status) => (
          <Button
            key={status}
            variant={availability === status ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={availability === status}
            disabled={saving}
            onClick={() => {
              if (status === availability) return
              void updateSettings(async () => {
                await availabilityService.setAvailability(userId, status)
                setAvailability(status)
              })
            }}
          >
            {AVAILABILITY_META[status].label}
          </Button>
        ))}
      </div>

      <p className="text-label text-ink-muted" role="status">
        {locationMessage}
      </p>
      {error && <Alert>{error}</Alert>}

      {editing && (
        <>
          <p className="text-label text-ink-muted">Selecciona un punto en tu zona de trabajo. Se guardará una ubicación aproximada.</p>
          <ServiceMap
            label="Seleccionar zona de trabajo"
            className="h-72"
            center={sharedLocation?.point}
            onMapClick={selectPoint}
          >
            {mapPoint && <UserLocationMarker point={mapPoint} />}
          </ServiceMap>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={!draft || saving}
              onClick={() => {
                if (!draft) return
                void updateSettings(async () => {
                  setSharedLocation(await availabilityService.saveLocation(userId, draft, 'manual'))
                  setDraft(null)
                  setEditing(false)
                })
              }}
            >
              Compartir ubicación
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => {
                setDraft(null)
                setError(null)
                setEditing(false)
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => setEditing(true)}>
            {sharedLocation ? 'Cambiar ubicación' : 'Elegir ubicación en el mapa'}
          </Button>
        )}
        {sharedLocation && !editing && (
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => {
              void updateSettings(async () => {
                await availabilityService.clearLocation(userId)
                setSharedLocation(null)
              })
            }}
          >
            Dejar de compartir
          </Button>
        )}
      </div>
    </div>
  )
}
