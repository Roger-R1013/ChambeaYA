import { Link } from 'react-router'
import { Briefcase, ChevronRight, Coins, MapPin, MapPinned, Timer } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/button.styles'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/LoadingState'
import { ROUTES } from '@/config/routes'
import { AVAILABILITY_META } from '@/features/workers/availability'
import { useCatalogCategories, useServiceZones, useWorkerProfile } from '../hooks/useProfileData'
import { formatReferencePrice } from '../pricing'
import { getMissingProfessionalFields, getRecommendedProfessionalFields } from '../validation'
import { VERIFICATION_META } from '../verification'

/** Read-only overview of the worker's professional profile on the Profile screen. */
export function WorkerProfessionalSummary({ userId }: { userId: string }) {
  const profileState = useWorkerProfile(userId)
  const categoriesState = useCatalogCategories()
  const zonesState = useServiceZones()

  if (profileState.status === 'loading') {
    return (
      <Card as="section" aria-busy="true" aria-label="Cargando perfil profesional" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    )
  }

  if (profileState.status === 'error') {
    return (
      <Card as="section" aria-labelledby="worker-summary-title" className="flex flex-col gap-3">
        <h2 id="worker-summary-title" className="text-heading text-ink">
          Perfil profesional
        </h2>
        <Alert>{profileState.error.message}</Alert>
      </Card>
    )
  }

  const profile = profileState.data
  const missing = getMissingProfessionalFields(profile)
  const recommended = getRecommendedProfessionalFields(profile)
  const verification = VERIFICATION_META[profile.verificationStatus]
  const availability = AVAILABILITY_META[profile.availability]
  const categoryNames = new Map((categoriesState.data ?? []).map((category) => [category.id, category.name]))
  const zoneName = (zonesState.data ?? []).find((zone) => zone.id === profile.serviceZoneId)?.name
  const price = formatReferencePrice(profile.pricingMode, profile.baseRateBob)

  return (
    <Card as="section" aria-labelledby="worker-summary-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="worker-summary-title" className="text-heading text-ink">
            Perfil profesional
          </h2>
          <p className="truncate text-body text-ink-muted">{profile.profession ?? 'Profesión sin definir'}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={availability.tone} dot>
            {availability.label}
          </Badge>
          <Badge tone={verification.tone} icon={verification.icon}>
            {verification.label}
          </Badge>
        </div>
      </div>

      {missing.length > 0 ? (
        <Alert tone="info">
          Completa tu perfil para aparecer en las búsquedas. Falta: {missing.join(', ')}.
        </Alert>
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-label sm:grid-cols-2">
          <div className="flex items-center gap-2.5 text-ink-muted">
            <Timer className="size-4 text-primary-600" strokeWidth={2} aria-hidden />
            <dt className="sr-only">Experiencia</dt>
            <dd>
              {profile.experienceYears} {profile.experienceYears === 1 ? 'año' : 'años'} de experiencia
            </dd>
          </div>
          <div className="flex items-center gap-2.5 text-ink-muted">
            <MapPinned className="size-4 text-primary-600" strokeWidth={2} aria-hidden />
            <dt className="sr-only">Radio de trabajo</dt>
            <dd>Hasta {profile.serviceRadiusKm} km</dd>
          </div>
          {zoneName && (
            <div className="flex items-center gap-2.5 text-ink-muted">
              <MapPin className="size-4 text-primary-600" strokeWidth={2} aria-hidden />
              <dt className="sr-only">Zona de trabajo</dt>
              <dd className="truncate">{zoneName}</dd>
            </div>
          )}
          {price && (
            <div className="flex items-center gap-2.5 text-ink-muted">
              <Coins className="size-4 text-primary-600" strokeWidth={2} aria-hidden />
              <dt className="sr-only">Precio orientativo</dt>
              <dd className="truncate">{price}</dd>
            </div>
          )}
        </dl>
      )}

      {missing.length === 0 && recommended.length > 0 && (
        <p className="text-caption text-ink-muted">
          Recomendado: agrega {recommended.join(' y ')} para que los clientes decidan más rápido.
        </p>
      )}

      {profile.categoryIds.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Categorías">
          {profile.categoryIds.map((id) => (
            <li key={id}>
              <Badge tone="primary" icon={Briefcase}>
                {categoryNames.get(id) ?? id}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-ink-subtle">{verification.description}</p>

      <Link
        to={ROUTES.workerProfessional}
        className={buttonStyles({ variant: missing.length > 0 ? 'primary' : 'secondary', fullWidth: true })}
      >
        {missing.length > 0 ? 'Completar perfil profesional' : 'Editar perfil profesional'}
        <ChevronRight className="size-[18px]" strokeWidth={2} aria-hidden />
      </Link>
    </Card>
  )
}
