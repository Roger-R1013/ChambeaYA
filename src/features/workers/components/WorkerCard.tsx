import { ChevronRight, MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { NearbyWorker } from '@/types/worker'
import { formatDistance, formatMoney, getFullName } from '@/utils/format'
import { AVAILABILITY_META } from '../availability'
import { Rating } from './Rating'

export interface WorkerCardProps {
  worker: NearbyWorker
  onViewProfile: (worker: NearbyWorker) => void
}

export function WorkerCard({ worker, onViewProfile }: WorkerCardProps) {
  const fullName = getFullName(worker)
  const availability = AVAILABILITY_META[worker.availability]
  const titleId = `worker-${worker.id}-name`

  return (
    <Card as="article" interactive padding="none" aria-labelledby={titleId} className="flex flex-col">
      <div className="flex gap-3.5 p-4">
        <Avatar name={fullName} src={worker.avatarUrl} size="lg" status={availability.avatarStatus} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 id={titleId} className="truncate text-body font-semibold text-ink">
              {fullName}
            </h3>
            <Badge tone={availability.tone} dot className="shrink-0">
              {availability.label}
            </Badge>
          </div>
          <p className="truncate text-label font-normal text-ink-muted">{worker.profession}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating value={worker.rating} reviewsCount={worker.reviewsCount} />
            <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
              <MapPin className="size-3.5 text-primary-600" strokeWidth={2} aria-hidden />
              <span>
                <span className="sr-only">A </span>
                {formatDistance(worker.distanceKm)}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
        <p className="flex flex-col">
          <span className="text-micro font-medium tracking-wide text-ink-subtle uppercase">Desde</span>
          <span className="text-heading leading-tight text-ink">{formatMoney(worker.startingPrice)}</span>
        </p>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={ChevronRight}
          onClick={() => onViewProfile(worker)}
          aria-label={`Ver perfil de ${fullName}`}
        >
          Ver perfil
        </Button>
      </div>
    </Card>
  )
}
