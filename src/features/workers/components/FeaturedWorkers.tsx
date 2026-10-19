import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import type { NearbyWorker } from '@/types/worker'
import { useFeaturedWorkers } from '../hooks/useFeaturedWorkers'
import { WorkerCard } from './WorkerCard'
import { WorkerCardSkeleton } from './WorkerCardSkeleton'

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
const SKELETON_COUNT = 3

export function FeaturedWorkers({ onViewProfile }: { onViewProfile: (worker: NearbyWorker) => void }) {
  const state = useFeaturedWorkers()

  if (state.status === 'loading') {
    return (
      <div className={GRID} aria-busy="true" aria-label="Cargando profesionales">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <WorkerCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (state.status === 'error' || state.data.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos profesionales"
        description={state.error?.message ?? 'Aún no hay profesionales destacados en tu zona.'}
      />
    )
  }

  return (
    <ul className={GRID}>
      {state.data.map((worker, index) => (
        <li key={worker.id} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
          <WorkerCard worker={worker} onViewProfile={onViewProfile} />
        </li>
      ))}
    </ul>
  )
}
