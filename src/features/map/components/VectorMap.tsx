import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AttributionControl, Map as LibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { LoaderCircle } from 'lucide-react'
import { DEFAULT_LOCATION } from '@/config/app'
import { cn } from '@/lib/cn'
import type { GeoPoint, LngLatTuple } from '@/types/geo'
import { toLngLat } from '@/utils/geo'
import { VECTOR_STYLES, type VectorStyle } from '../vectorStyles'

setWorkerUrl(workerUrl)

export interface VectorMarker {
  id: string
  point: GeoPoint
  label: string
  kind: 'worker' | 'viewer' | 'destination'
  text?: string
  avatar?: string
  selected?: boolean
  available?: boolean
}

interface VectorMapProps {
  label: string
  className?: string
  center?: GeoPoint
  zoom?: number
  style: VectorStyle
  markers?: VectorMarker[]
  route?: LngLatTuple[]
  focus?: { point: GeoPoint; zoom?: number }
  fitPair?: readonly [GeoPoint, GeoPoint]
  reveal?: GeoPoint
  onSelect?: (id: string) => void
  onCenterChange?: (point: GeoPoint) => void
  onMovingChange?: (moving: boolean) => void
  onReady?: () => void
  children?: ReactNode
}

const ROUTE_LAYER = 'chambeaya-route'
const NO_MARKERS: VectorMarker[] = []
const LOAD_TIMEOUT_MS = 15_000
const MAP_NOTICES = {
  slow: 'El mapa está tardando en cargar. Comprueba tu conexión o elige otro estilo.',
  style: 'No se pudo cargar el estilo del mapa. Comprueba tu conexión o elige otro estilo.',
  resources: 'Faltan recursos cartográficos. Comprueba tu conexión o elige otro estilo.',
  graphics: 'No se pudo iniciar o mantener la visualización gráfica del mapa. Recarga la página para reintentar.',
}
type MapStatus = 'loading' | 'ready' | keyof typeof MAP_NOTICES

function renderMarker(element: HTMLElement, item: VectorMarker) {
  element.title = item.label
  element.setAttribute('aria-label', item.label)
  if (item.kind === 'worker') element.setAttribute('aria-pressed', String(Boolean(item.selected)))
  element.style.zIndex = item.selected ? '10' : ''
  const visual = document.createElement('span')
  if (item.kind !== 'worker') {
    visual.className = cn(
      'block rounded-full border-[3px] border-white shadow-md',
      item.kind === 'viewer' ? 'size-5 bg-primary-600' : 'size-6 bg-accent-500',
    )
    element.replaceChildren(visual)
    return
  }

  visual.className = cn(
    'relative flex size-11 items-center justify-center rounded-full bg-brand-gradient text-label font-semibold text-white shadow-md',
    item.selected ? 'ring-4 ring-primary-300' : 'ring-2 ring-white',
  )
  visual.textContent = item.text ?? ''
  if (item.avatar) {
    const image = document.createElement('img')
    image.src = item.avatar
    image.alt = ''
    image.draggable = false
    image.className = 'absolute inset-0 size-full rounded-full object-cover'
    image.addEventListener('error', () => image.remove(), { once: true })
    visual.append(image)
  }
  if (item.available !== undefined) {
    const status = document.createElement('span')
    status.className = cn(
      'absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-white',
      item.available ? 'bg-success-500' : 'bg-accent-500',
    )
    visual.append(status)
  }
  element.replaceChildren(visual)
}

export function VectorMap({
  label, className, center = DEFAULT_LOCATION.point, zoom = 13, style, markers = NO_MARKERS,
  route, focus, fitPair, reveal, onSelect, onCenterChange, onMovingChange, onReady, children,
}: VectorMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LibreMap | null>(null)
  const beginStyleLoad = useRef<(() => void) | null>(null)
  const registry = useRef(new Map<string, { marker: Marker; appearance: string }>())
  const selection = useRef(onSelect)
  const [initial] = useState(() => ({ center, zoom, style }))
  const [map, setMap] = useState<LibreMap | null>(null)
  const [status, setStatus] = useState<MapStatus>('loading')
  const currentStyle = useRef(initial.style)
  const fitted = useRef(false)

  useEffect(() => { selection.current = onSelect }, [onSelect])
  useEffect(() => {
    const element = container.current
    if (!element) return
    let active = true
    let instance: LibreMap
    try {
      instance = new LibreMap({
        container: element, style: VECTOR_STYLES[initial.style].url,
        center: toLngLat(initial.center), zoom: initial.zoom,
        maxPitch: 0, dragRotate: false, pitchWithRotate: false, renderWorldCopies: false,
        scrollZoom: false, attributionControl: false,
      })
    } catch {
      queueMicrotask(() => { if (active) setStatus('graphics') })
      return () => { active = false }
    }
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instance.addControl(new AttributionControl({ compact: false }), 'bottom-right')
    instance.touchZoomRotate.disableRotation()
    const markerRegistry = registry.current
    mapInstance.current = instance
    currentStyle.current = initial.style
    let styleLoaded = false
    let loadTimer: number | undefined
    const startLoading = () => {
      styleLoaded = false
      window.clearTimeout(loadTimer)
      queueMicrotask(() => { if (active) setStatus('loading') })
      loadTimer = window.setTimeout(() => {
        if (active) setStatus((current) => current === 'loading' ? 'slow' : current)
      }, LOAD_TIMEOUT_MS)
    }
    beginStyleLoad.current = startLoading
    startLoading()
    instance.on('load', () => { if (active) setMap(instance) })
    instance.on('style.load', () => { styleLoaded = true })
    instance.on('idle', () => {
      if (!active || !styleLoaded || !element.clientWidth || !element.clientHeight) return
      window.clearTimeout(loadTimer)
      setStatus((current) => current === 'loading' || current === 'slow' ? 'ready' : current)
    })
    instance.on('error', () => {
      if (active) setStatus((current) => current === 'graphics' ? current : styleLoaded ? 'resources' : 'style')
    })
    instance.on('webglcontextlost', () => { if (active) setStatus('graphics') })
    instance.on('webglcontextrestored', startLoading)
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      active = false
      window.clearTimeout(loadTimer)
      beginStyleLoad.current = null
      observer.disconnect()
      markerRegistry.forEach(({ marker }) => marker.remove())
      markerRegistry.clear()
      mapInstance.current = null
      instance.remove()
    }
  }, [initial])

  useEffect(() => {
    const instance = mapInstance.current
    if (!instance || currentStyle.current === style) return
    currentStyle.current = style
    beginStyleLoad.current?.()
    instance.setStyle(VECTOR_STYLES[style].url, { diff: false })
  }, [style])

  useEffect(() => {
    if (!map) return
    onReady?.()
    if (!onCenterChange && !onMovingChange) return
    const moving = () => onMovingChange?.(true)
    const updateCenter = () => {
      const { lat, lng } = map.getCenter().wrap()
      onCenterChange?.({ lat, lng })
      onMovingChange?.(false)
    }
    map.on('movestart', moving)
    map.on('moveend', updateCenter)
    return () => { map.off('movestart', moving); map.off('moveend', updateCenter) }
  }, [map, onCenterChange, onMovingChange, onReady])

  useEffect(() => {
    if (map && focus) map.easeTo({ center: toLngLat(focus.point), zoom: focus.zoom ?? map.getZoom(), duration: 350 })
  }, [map, focus])

  useEffect(() => {
    if (!fitPair) { fitted.current = false; return }
    if (!map || fitted.current) return
    fitted.current = true
    map.fitBounds([toLngLat(fitPair[0]), toLngLat(fitPair[1])], { padding: 60, maxZoom: 15, duration: 450 })
  }, [map, fitPair])

  useEffect(() => {
    if (map && reveal && !map.getBounds().contains(toLngLat(reveal))) {
      map.easeTo({ center: toLngLat(reveal), duration: 350 })
    }
  }, [map, reveal])

  useEffect(() => {
    if (!map) return
    const items = registry.current
    const visible = new Set(markers.map(({ id }) => id))
    for (const [id, entry] of items) {
      if (!visible.has(id)) {
        entry.marker.remove()
        items.delete(id)
      }
    }
    for (const item of markers) {
      let entry = items.get(item.id)
      if (!entry) {
        const element = document.createElement(item.kind === 'worker' && onSelect ? 'button' : 'div')
        if (element instanceof HTMLButtonElement) {
          element.type = 'button'
          element.className = 'cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
          element.addEventListener('click', (event) => {
            event.stopPropagation()
            selection.current?.(item.id)
          })
        } else {
          element.className = 'pointer-events-none'
        }
        const marker = new Marker({ element }).setLngLat(toLngLat(item.point)).addTo(map)
        entry = { marker, appearance: '' }
        items.set(item.id, entry)
      }
      const { lat, lng } = entry.marker.getLngLat()
      if (lat !== item.point.lat || lng !== item.point.lng) entry.marker.setLngLat(toLngLat(item.point))
      const appearance = JSON.stringify([item.kind, item.label, item.avatar, item.text, item.selected, item.available])
      if (appearance !== entry.appearance) {
        renderMarker(entry.marker.getElement(), item)
        entry.appearance = appearance
      }
    }
  }, [map, markers, onSelect])

  useEffect(() => {
    if (!map) return
    const draw = () => {
      const source = map.getSource<GeoJSONSource>(ROUTE_LAYER)
      if (!route || route.length < 2) {
        if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER)
        if (source) map.removeSource(ROUTE_LAYER)
        return
      }
      const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route } }
      if (source) {
        source.setData(data)
        return
      }
      map.addSource(ROUTE_LAYER, { type: 'geojson', data })
      map.addLayer({
        id: ROUTE_LAYER, type: 'line', source: ROUTE_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#039f9c', 'line-width': 5 },
      })
    }
    if (map.isStyleLoaded()) draw()
    else map.once('idle', draw)
    map.on('style.load', draw)
    return () => { map.off('style.load', draw); map.off('idle', draw) }
  }, [map, route])

  return (
    <div role="region" aria-label={label}
      className={cn('relative isolate overflow-hidden rounded-lg border border-border/70 bg-surface-muted', className)}>
      {/* MapLibre supplies position: relative on its own container. */}
      <div className="absolute inset-0">
        <div ref={container} className="size-full" />
      </div>
      {status === 'loading' && (
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-caption text-ink-muted shadow-sm">
            <LoaderCircle className="size-4 animate-spin text-primary-600" aria-hidden /> Cargando mapa...
          </span>
        </div>
      )}
      {status !== 'loading' && status !== 'ready' && (
        <p role="status" className="pointer-events-none absolute top-3 right-14 left-3 rounded-md bg-white p-3 text-caption text-ink-muted shadow-sm">
          {MAP_NOTICES[status]}
        </p>
      )}
      {children}
    </div>
  )
}
