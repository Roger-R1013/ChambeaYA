import { memo } from 'react'
import { Marker } from 'react-leaflet'
import type { NearbyWorker } from '@/types/worker'
import { getFullName } from '@/utils/format'
import { workerMarkerIcon } from '../workerMarkerIcon'

export interface WorkerMarkersProps {
  workers: NearbyWorker[]
  selectedId: string | null
  onSelect: (worker: NearbyWorker) => void
}

const WorkerMarker = memo(function WorkerMarker({ worker, selected, onSelect }: {
  worker: NearbyWorker
  selected: boolean
  onSelect: WorkerMarkersProps['onSelect']
}) {
  if (!worker.location) return null
  const label = `${getFullName(worker)}, ${worker.profession}`

  return (
    <Marker
      position={[worker.location.lat, worker.location.lng]}
      icon={workerMarkerIcon(worker, selected)}
      title={label}
      alt={label}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(worker) }}
    />
  )
})

/** One marker per worker that shares an approximate location. */
export function WorkerMarkers({ workers, selectedId, onSelect }: WorkerMarkersProps) {
  return (
    <>
      {workers.map((worker) => (
        <WorkerMarker key={worker.id} worker={worker} selected={worker.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  )
}

