import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Briefcase, MapPin, MapPinned, Timer, UserRoundX } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button.styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { buildRequestWorkerPath, ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { PRICING_META } from '@/features/profile/pricing'
import { AVAILABILITY_META } from '@/features/workers/availability'
import { useAsyncData } from '@/hooks/useAsyncData'
import { workersService } from '@/services/workers.service'
import type { WorkerDetail } from '@/types/worker'
import { formatMoney, getFullName } from '@/utils/format'

function WorkerSpecialties({ categoryIds }: { categoryIds: string[] }) {
  const categories = useCategories()
  const specialties = (categories.data ?? []).filter((category) => categoryIds.includes(category.id))

  if (categories.status === 'success' && specialties.length === 0) return null

  return (
    <Section id="public-worker-specialties" title="Especialidades">
      {categories.status === 'loading' && <LoadingState label="Cargando especialidades..." className="py-3" />}
      {categories.status === 'error' && <Alert>{categories.error.message}</Alert>}
      {specialties.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {specialties.map((category) => (
            <li key={category.id}>
              <Badge tone="primary" icon={Briefcase}>{category.name}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function ProfessionalInformation({ worker }: { worker: WorkerDetail }) {
  const description = worker.description.trim()
  const experience = worker.experienceYears

  return (
    <Card padding="lg" className="flex flex-col gap-6">
      {description && (
        <Section id="public-worker-description" title="Descripción profesional">
          <p className="wrap-break-word text-body whitespace-pre-wrap text-ink-muted">{description}</p>
        </Section>
      )}
      <Section id="public-worker-experience" title="Experiencia y cobertura">
        <dl className="grid gap-3 text-label sm:grid-cols-2">
          {experience !== null && (
            <div>
              <dt className="flex items-center gap-2.5 text-ink-subtle">
                <Timer className="size-4 shrink-0 text-primary-600" strokeWidth={2} aria-hidden />
                Experiencia en el oficio
              </dt>
              <dd className="pl-6.5 text-ink">{experience} {experience === 1 ? 'año' : 'años'}</dd>
            </div>
          )}
          <div>
            <dt className="flex items-center gap-2.5 text-ink-subtle">
              <MapPinned className="size-4 shrink-0 text-primary-600" strokeWidth={2} aria-hidden />
              Radio de servicio
            </dt>
            <dd className="pl-6.5 text-ink">Hasta {worker.serviceRadiusKm} km</dd>
          </div>
        </dl>
      </Section>
      {worker.categoryIds.length > 0 && <WorkerSpecialties categoryIds={worker.categoryIds} />}
    </Card>
  )
}

export function WorkerDetailPage() {
  const { workerId = '' } = useParams()
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const loader = useCallback(() => workersService.getById(workerId, null), [workerId])
  const state = useAsyncData(loader, { refreshKey })
  const worker = state.data
  const pricing = worker?.pricingMode ? PRICING_META[worker.pricingMode] : null
  const price = worker?.pricingMode === 'quote' ? null : worker?.startingPrice

  return (
    <div className="container-app flex flex-col gap-6 pt-6 md:pt-8">
      <PageHeader title="Perfil del profesional" backTo={ROUTES.home} />

      {state.status === 'loading' && <LoadingState label="Cargando perfil..." />}

      {state.status === 'error' && (
        <Card padding="lg" className="flex flex-col gap-3">
          <Alert>{state.error.message}</Alert>
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setRefreshKey((key) => key + 1)}>
            Reintentar
          </Button>
        </Card>
      )}

      {state.status === 'success' && !worker && (
        <Card padding="none">
          <EmptyState icon={UserRoundX} title="Profesional no encontrado" description="Es posible que el perfil ya no esté disponible." />
        </Card>
      )}

      {worker && (
        <>
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Avatar
              name={getFullName(worker)}
              src={worker.avatarUrl}
              size="xl"
              status={AVAILABILITY_META[worker.availability].avatarStatus}
            />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
              <h2 className="wrap-break-word text-title text-ink">{getFullName(worker)}</h2>
              <p className="wrap-break-word text-body text-ink-muted">{worker.profession}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Badge tone={AVAILABILITY_META[worker.availability].tone} dot>
                  {AVAILABILITY_META[worker.availability].label}
                </Badge>
                {worker.zoneName && (
                  <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                    <MapPin className="size-3.5 text-primary-600" strokeWidth={2} aria-hidden />
                    <span className="sr-only">Zona de cobertura: </span>
                    {worker.zoneName}
                  </span>
                )}
              </div>
            </div>
            {(price || pricing) && (
              <p className="flex flex-col sm:items-end">
                <span className="text-micro font-medium tracking-wide text-ink-subtle uppercase">
                  {price ? 'Desde' : 'Modalidad de cobro'}
                </span>
                <span className="text-title text-ink">
                  {price ? formatMoney(price) : pricing?.label}
                  {price && pricing?.unit && <span className="ml-1 text-label text-ink-muted">{pricing.unit}</span>}
                </span>
              </p>
            )}
          </Card>
          {user?.accountType === 'client' && worker.categoryIds.length > 0 && (
            worker.availability === 'available'
              ? <Link to={buildRequestWorkerPath(worker.id)} className={buttonStyles({ className: 'self-start' })}>
                  Solicitar servicio
                </Link>
              : <Alert tone="info">Este profesional no recibe solicitudes nuevas en este momento.</Alert>
          )}
          <ProfessionalInformation worker={worker} />
        </>
      )}
    </div>
  )
}
