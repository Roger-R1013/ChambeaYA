import { useCallback } from 'react'
import { useParams } from 'react-router'
import { MapPin, UserRoundX, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { DEFAULT_LOCATION } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { AVAILABILITY_META } from '@/features/workers/availability'
import { Rating } from '@/features/workers/components/Rating'
import { useAsyncData } from '@/hooks/useAsyncData'
import { workersService } from '@/services/workers.service'
import { formatDistance, formatMoney, getFullName } from '@/utils/format'

/** Provisional worker profile; the full profile is part of a later stage. */
export function WorkerDetailPage() {
  const { workerId = '' } = useParams()
  const loader = useCallback(() => workersService.getById(workerId, DEFAULT_LOCATION.point), [workerId])
  const state = useAsyncData(loader)

  return (
    <div className="container-app flex flex-col gap-6 pt-6 md:pt-8">
      <PageHeader title="Perfil del profesional" backTo={ROUTES.home} />

      {state.status === 'loading' && <LoadingState label="Cargando perfil..." />}

      {(state.status === 'error' || (state.status === 'success' && !state.data)) && (
        <Card padding="none">
          <EmptyState icon={UserRoundX} title="Profesional no encontrado" description="Es posible que el perfil ya no esté disponible." />
        </Card>
      )}

      {state.status === 'success' && state.data && (
        <>
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Avatar
              name={getFullName(state.data)}
              src={state.data.avatarUrl}
              size="xl"
              status={AVAILABILITY_META[state.data.availability].avatarStatus}
            />
            <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
              <h2 className="text-title text-ink">{getFullName(state.data)}</h2>
              <p className="text-body text-ink-muted">{state.data.profession}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Badge tone={AVAILABILITY_META[state.data.availability].tone} dot>
                  {AVAILABILITY_META[state.data.availability].label}
                </Badge>
                <Rating value={state.data.rating} reviewsCount={state.data.reviewsCount} />
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <MapPin className="size-3.5 text-primary-600" strokeWidth={2} aria-hidden />
                  {formatDistance(state.data.distanceKm)}
                </span>
              </div>
            </div>
            <p className="flex flex-col sm:items-end">
              <span className="text-micro font-medium tracking-wide text-ink-subtle uppercase">Desde</span>
              <span className="text-title text-ink">{formatMoney(state.data.startingPrice)}</span>
            </p>
          </Card>
          <Card padding="none">
            <EmptyState
              icon={Wrench}
              title="Perfil completo en la próxima etapa"
              description="Aquí verás experiencia, servicios, reseñas y la opción de solicitar un servicio."
            />
          </Card>
        </>
      )}
    </div>
  )
}
