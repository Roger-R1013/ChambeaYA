import 'leaflet/dist/leaflet.css'
import { useEffect, useState, type ReactNode } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { LoaderCircle, MapPinOff } from 'lucide-react'
import { MAP_CONFIG, SERVICE_AREA_BOUNDS } from '@/config/map'
import { cn } from '@/lib/cn'
import type { GeoPoint } from '@/types/geo'

type TileStatus = 'loading' | 'ready' | 'error'

export interface ServiceMapProps {
  /** Accessible name of the map region. */
  label: string
  center?: GeoPoint
  zoom?: number
  className?: string
  children?: ReactNode
  onMapClick?: (point: GeoPoint) => void
}

function ClickHandler({ onClick }: { onClick: (point: GeoPoint) => void }) {
  useMapEvents({ click: (event) => onClick({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

/** Keeps Leaflet's size in sync when the container is resized or shown (mobile tabs). */
function ResizeSync() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
  return null
}

/**
 * Base map of Santa Cruz de la Sierra (Leaflet + OpenStreetMap tiles).
 * Shows loading / error overlays and always renders the OSM attribution.
 */
export function ServiceMap({ label, center = MAP_CONFIG.center, zoom = MAP_CONFIG.zoom, className, children, onMapClick }: ServiceMapProps) {
  const [tiles, setTiles] = useState<TileStatus>('loading')

  return (
    <div
      role="region"
      aria-label={label}
      className={cn('relative isolate overflow-hidden rounded-lg border border-border/70 bg-surface-muted', className)}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={MAP_CONFIG.minZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={SERVICE_AREA_BOUNDS}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        className="size-full"
      >
        <TileLayer
          url={MAP_CONFIG.tileUrl}
          attribution={MAP_CONFIG.attribution}
          maxZoom={MAP_CONFIG.maxZoom}
          eventHandlers={{
            tileload: () => setTiles('ready'),
            tileerror: () => setTiles((current) => (current === 'ready' ? current : 'error')),
          }}
        />
        <ResizeSync />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {children}
      </MapContainer>

      {tiles === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-surface-muted/70" role="status">
          <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-caption text-ink-muted shadow-sm">
            <LoaderCircle className="size-4 animate-spin text-primary-600" strokeWidth={2} aria-hidden />
            Cargando mapa...
          </span>
        </div>
      )}
      {tiles === 'error' && (
        <div className="absolute inset-x-3 top-3 z-[500] flex items-start gap-2 rounded-md bg-white p-3 text-caption text-ink-muted shadow-md" role="alert">
          <MapPinOff className="mt-0.5 size-4 shrink-0 text-danger-600" strokeWidth={2} aria-hidden />
          <p>No se pudo cargar el mapa. Revisa tu conexión a internet. Los resultados siguen disponibles en la lista.</p>
        </div>
      )}
    </div>
  )
}

/** Smoothly moves the view when `point` changes. */
export function MapFlyTo({ point, zoom }: { point: GeoPoint | null; zoom?: number }) {
  const map = useMap()
  const lat = point?.lat
  const lng = point?.lng
  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [map, lat, lng, zoom])
  return null
}

/** Fits the view to a set of points whenever the set changes. */
export function FitToPoints({ points }: { points: GeoPoint[] }) {
  const map = useMap()
  const key = points.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (!key) return
    const latLngs = key.split('|').map((pair) => pair.split(',').map(Number) as [number, number])
    if (latLngs.length === 1) map.flyTo(latLngs[0] ?? map.getCenter(), Math.max(map.getZoom(), 14), { duration: 0.6 })
    else map.flyToBounds(latLngs, { padding: [48, 48], maxZoom: 15, duration: 0.6 })
  }, [map, key])
  return null
}

/** The viewer's own position (only shown to the viewer). */
export function UserLocationMarker({ point }: { point: GeoPoint }) {
  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={8}
      pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#039F9C', fillOpacity: 1 }}
    />
  )
}

