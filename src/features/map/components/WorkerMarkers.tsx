import { Marker } from 'react-leaflet'
import type { NearbyWorker } from '@/types/worker'
import { getFullName } from '@/utils/format'
import { workerMarkerIcon } from '../workerMarkerIcon'

export interface WorkerMarkersProps {
  workers: NearbyWorker[]
  selectedId: string | null
  onSelect: (worker: NearbyWorker) => void
}

/** One marker per worker that shares an approximate location. */
export function WorkerMarkers({ workers, selectedId, onSelect }: WorkerMarkersProps) {
  return (
    <>
      {workers.map((worker) =>
        worker.location ? (
          <Marker
            key={worker.id}
            position={[worker.location.lat, worker.location.lng]}
            icon={workerMarkerIcon(worker, worker.id === selectedId)}
            title={`${getFullName(worker)}, ${worker.profession}`}
            alt={`${getFullName(worker)}, ${worker.profession}`}
            zIndexOffset={worker.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(worker) }}
          />
        ) : null,
      )}
    </>
  )
}

