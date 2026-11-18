import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { LocateFixed, MapPinOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { DEFAULT_LOCATION } from '@/config/app'
import { MAP_CONFIG } from '@/config/map'
import { buildWorkerDetailPath } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { CategoryGrid } from '@/features/categories/components/CategoryGrid'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { MapFlyTo, MapPanTo, ServiceMap, UserLocationMarker } from '@/features/map/components/ServiceMap'
import { WorkerMarkers } from '@/features/map/components/WorkerMarkers'
import { SearchBar } from '@/features/search/components/SearchBar'
import { WorkerCard } from '@/features/workers/components/WorkerCard'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useGeolocation } from '@/hooks/useGeolocation'
import {
  SEARCH_DEFAULT_RADIUS_KM,
  SEARCH_MAX_RADIUS_KM,
  SEARCH_MIN_RADIUS_KM,
  WORKER_SEARCH_QUERY_MAX_LENGTH,
  workersService,
} from '@/services/workers.service'
import type { Category } from '@/types/category'
import type { NearbyWorker } from '@/types/worker'

const RADIUS_OPTIONS = Array.from(
  { length: SEARCH_MAX_RADIUS_KM - SEARCH_MIN_RADIUS_KM + 1 },
  (_, index) => SEARCH_MIN_RADIUS_KM + index,
)

export function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isClient = user?.accountType === 'client'
  const [searchParams, setSearchParams] = useSearchParams()
  const categories = useCategories()
  const { state: geolocation, request: requestLocation } = useGeolocation()
  const [refreshKey, setRefreshKey] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const query = (searchParams.get('q') ?? '').trim().slice(0, WORKER_SEARCH_QUERY_MAX_LENGTH)
  const categoryId = searchParams.get('category')?.trim() || null
  const requestedRadius = Number(searchParams.get('radius'))
  const radiusKm = RADIUS_OPTIONS.includes(requestedRadius) ? requestedRadius : SEARCH_DEFAULT_RADIUS_KM
  const category = categories.data?.find((item) => item.id === categoryId)
  const viewerPoint = 'point' in geolocation ? geolocation.point : null
  const { lat, lng } = viewerPoint ?? DEFAULT_LOCATION.point
  const geolocationMessage = 'message' in geolocation ? geolocation.message : null
  const filters = useMemo(
    () => ({ query, categoryId, radiusKm, origin: { lat, lng }, includeBusy: true }),
    [query, categoryId, radiusKm, lat, lng],
  )
  const [selection, setSelection] = useState<{ id: string; filters: typeof filters } | null>(null)

  const loadWorkers = useCallback(
    async (signal: AbortSignal) => {
      if (!isClient) return []
      const workers = await workersService.search(filters, signal)
      return workers.filter((worker) => worker.location !== null)
    },
    [isClient, filters],
  )
  const results = useAsyncData(loadWorkers, { delayMs: 250, refreshKey })
  const workers = results.data ?? []
  const selectedId = selection?.filters === filters ? selection.id : null
  const selectedWorker = workers.find((worker) => worker.id === selectedId)
  const hasSelectedWorker = selectedWorker !== undefined
  useEffect(() => {
    if (hasSelectedWorker) summaryRef.current?.scrollIntoView({ block: 'nearest' })
  }, [hasSelectedWorker, selectedId])

  const handleSelectWorker = useCallback((worker: NearbyWorker) => {
    setSelection({ id: worker.id, filters })
  }, [filters])
  const handleViewProfile = (worker: NearbyWorker) => navigate(buildWorkerDetailPath(worker.id))

  function updateFilters(changes: Partial<Record<'q' | 'category' | 'radius', string>>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { preventScrollReset: true })
  }

  const handleCategorySelect = (category: Category) => updateFilters({ category: category.id })

  return (
    <div className="container-app flex flex-col gap-7 pt-6 md:pt-8">
      <PageHeader title="Buscar" description="Encuentra servicios y profesionales en tu zona." />

      {/* key resets the input when the URL query changes */}
      <SearchBar
        key={query}
        id="search-page-input"
        defaultValue={query}
        maxLength={WORKER_SEARCH_QUERY_MAX_LENGTH}
        className="md:max-w-xl"
        onSearch={(value) => updateFilters({ q: value.slice(0, WORKER_SEARCH_QUERY_MAX_LENGTH) })}
      />

      <Section id="search-categories" title="Explorar por categoría">
        {categories.status === 'error' ? (
          <Alert>{categories.error.message}</Alert>
        ) : (
          <CategoryGrid
            categories={categories.data}
            isLoading={categories.status === 'loading'}
            onSelect={handleCategorySelect}
          />
        )}
      </Section>

      <Section
        id="search-map"
        title="Mapa de servicios"
        description={
          viewerPoint
            ? 'Distancias aproximadas desde tu ubicación.'
            : `Distancias aproximadas desde el centro de ${DEFAULT_LOCATION.label}.`
        }
        action={
          isClient && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={LocateFixed}
              className="shrink-0"
              isLoading={geolocation.status === 'requesting'}
              onClick={requestLocation}
            >
              Usar mi ubicación
            </Button>
          )
        }
      >
        {geolocationMessage && <Alert tone="info">{geolocationMessage}</Alert>}
        {isClient && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="search-radius" className="text-label text-ink">Radio de búsqueda</label>
            <Select
              id="search-radius"
              value={radiusKm}
              onChange={(event) => updateFilters({ radius: event.target.value })}
            >
              {RADIUS_OPTIONS.map((radius) => (
                <option key={radius} value={radius}>{radius} km</option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ServiceMap label="Mapa de servicios" className="h-80 md:h-[28rem]" restrictToServiceArea={false}>
            <MapFlyTo point={viewerPoint ?? MAP_CONFIG.center} zoom={viewerPoint ? 14 : MAP_CONFIG.zoom} />
            {viewerPoint && <UserLocationMarker point={viewerPoint} />}
            {selectedWorker?.location && <MapPanTo point={selectedWorker.location} />}
            <WorkerMarkers
              workers={workers}
              selectedId={selectedWorker?.id ?? null}
              onSelect={handleSelectWorker}
            />
          </ServiceMap>

          <div
            className="flex min-w-0 flex-col gap-3 lg:max-h-[28rem] lg:overflow-y-auto"
            aria-busy={isClient && results.status === 'loading'}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 break-words text-heading text-ink" aria-live="polite">
                {selectedWorker ? 'Profesional seleccionado' : [category?.name, query].filter(Boolean).join(' · ') || 'Profesionales'}
              </h3>
              {(categoryId || query) && (
                <button
                  type="button"
                  className="text-label text-primary-700 hover:text-primary-800"
                  onClick={() => updateFilters({ q: '', category: '' })}
                >
                  Quitar filtros
                </button>
              )}
            </div>
            {!isClient && <Alert tone="info">La búsqueda de profesionales está disponible para cuentas de cliente.</Alert>}
            {isClient && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={results.status === 'loading'}
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                Actualizar resultados
              </Button>
            )}
            {isClient && results.status === 'loading' && <LoadingState label="Buscando profesionales..." />}
            {isClient && results.status === 'error' && <Alert>{results.error.message}</Alert>}
            {isClient && results.status === 'success' && workers.length === 0 && (
              <Card padding="none">
                <EmptyState
                  icon={MapPinOff}
                  title="Sin profesionales en este radio"
                  description={
                    categoryId || query
                      ? 'No hay profesionales con ubicación compartida que coincidan con tu búsqueda.'
                      : 'No encontramos profesionales con ubicación compartida dentro de este radio. Puedes ampliarlo.'
                  }
                />
              </Card>
            )}
            {selectedWorker ? (
              <div ref={summaryRef} className="flex flex-col gap-3">
                <WorkerCard worker={selectedWorker} onViewProfile={handleViewProfile} />
                <Button variant="secondary" size="sm" onClick={() => setSelection(null)}>
                  Ver todos los resultados
                </Button>
              </div>
            ) : (
              workers.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {workers.map((worker) => (
                    <li key={worker.id}>
                      <WorkerCard worker={worker} onViewProfile={handleViewProfile} onShowOnMap={handleSelectWorker} />
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}
