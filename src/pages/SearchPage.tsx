import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LocateFixed, MapPinOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { DEFAULT_LOCATION } from '@/config/app'
import { MAP_CONFIG } from '@/config/map'
import { buildWorkerDetailPath, ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { CategoryGrid } from '@/features/categories/components/CategoryGrid'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { MapFlyTo, ServiceMap, UserLocationMarker } from '@/features/map/components/ServiceMap'
import { WorkerMarkers } from '@/features/map/components/WorkerMarkers'
import { SearchBar } from '@/features/search/components/SearchBar'
import { WorkerCard } from '@/features/workers/components/WorkerCard'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useGeolocation } from '@/hooks/useGeolocation'
import { workersService } from '@/services/workers.service'
import type { Category } from '@/types/category'
import type { NearbyWorker } from '@/types/worker'

export function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isClient = user?.accountType === 'client'
  const [searchParams, setSearchParams] = useSearchParams()
  const categories = useCategories()
  const { state: geolocation, request: requestLocation } = useGeolocation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = searchParams.get('q') ?? ''
  const categoryId = searchParams.get('category')
  const category = categories.data?.find((item) => item.id === categoryId)
  const origin = geolocation.status === 'granted' ? geolocation.point : null
  const geolocationMessage = 'message' in geolocation ? geolocation.message : null

  const loadWorkers = useCallback(
    async () => {
      if (!isClient) return []
      const workers = await workersService.search({ query, categoryId, origin, includeBusy: true })
      return workers.filter((worker) => worker.location !== null)
    },
    [isClient, query, categoryId, origin],
  )
  const results = useAsyncData(loadWorkers)
  const workers = results.data ?? []
  const selectedWorker = workers.find((worker) => worker.id === selectedId)
  const handleCategorySelect = (category: Category) => setSearchParams({ category: category.id })
  const handleViewProfile = (worker: NearbyWorker) => navigate(buildWorkerDetailPath(worker.id))

  return (
    <div className="container-app flex flex-col gap-7 pt-6 md:pt-8">
      <PageHeader title="Buscar" description="Encuentra servicios y profesionales en tu zona." />

      {/* key resets the input when the URL query changes */}
      <SearchBar key={query} id="search-page-input" defaultValue={query} className="md:max-w-xl" />

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
        description={origin ? 'Mostrando profesionales cerca de tu ubicación.' : DEFAULT_LOCATION.label}
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
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ServiceMap label="Mapa de servicios" className="h-80 md:h-[28rem]" restrictToServiceArea={false}>
            <MapFlyTo point={origin ?? MAP_CONFIG.center} zoom={origin ? 14 : MAP_CONFIG.zoom} />
            {origin && <UserLocationMarker point={origin} />}
            <WorkerMarkers
              workers={workers}
              selectedId={selectedWorker?.id ?? null}
              onSelect={(worker) => setSelectedId(worker.id)}
            />
          </ServiceMap>

          <div className="flex min-w-0 flex-col gap-3 lg:max-h-[28rem] lg:overflow-y-auto" aria-busy={isClient && results.status === 'loading'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-heading text-ink" aria-live="polite">
                {selectedWorker ? 'Profesional seleccionado' : category?.name ?? (query || 'Profesionales')}
              </h3>
              {(categoryId || query) && (
                <Link to={ROUTES.search} className="text-label text-primary-700 hover:text-primary-800">
                  Quitar filtro
                </Link>
              )}
            </div>
            {!isClient && <Alert tone="info">La búsqueda de profesionales está disponible para cuentas de cliente.</Alert>}
            {isClient && results.status === 'loading' && <LoadingState label="Buscando profesionales..." />}
            {isClient && results.status === 'error' && <Alert>{results.error.message}</Alert>}
            {isClient && results.status === 'success' && workers.length === 0 && (
              <Card padding="none">
                <EmptyState
                  icon={MapPinOff}
                  title="No encontramos profesionales"
                  description={
                    categoryId || query
                      ? 'No hay profesionales con ubicación compartida que coincidan con tu búsqueda.'
                      : 'Por ahora no hay profesionales con ubicación compartida para esta zona.'
                  }
                />
              </Card>
            )}
            {selectedWorker ? (
              <>
                <WorkerCard worker={selectedWorker} onViewProfile={handleViewProfile} />
                <Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>
                  Ver todos los resultados
                </Button>
              </>
            ) : (
              workers.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {workers.map((worker) => (
                    <li key={worker.id}>
                      <WorkerCard worker={worker} onViewProfile={handleViewProfile} />
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
