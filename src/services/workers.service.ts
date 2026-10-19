import { APP_CONFIG } from '@/config/app'
import { MOCK_WORKERS } from '@/mocks/workers'
import type { GeoPoint } from '@/types/geo'
import type { NearbyWorker, Worker } from '@/types/worker'
import { delay } from '@/utils/async'
import { haversineDistanceKm } from '@/utils/geo'

export interface WorkersService {
  getFeatured(origin: GeoPoint): Promise<NearbyWorker[]>
  getById(id: string, origin: GeoPoint): Promise<NearbyWorker | null>
}

function withDistance(worker: Worker, origin: GeoPoint): NearbyWorker {
  return { ...worker, distanceKm: haversineDistanceKm(origin, worker.location) }
}

const AVAILABILITY_ORDER: Record<Worker['availability'], number> = {
  available: 0,
  busy: 1,
  offline: 2,
}

const mockWorkersService: WorkersService = {
  async getFeatured(origin) {
    await delay(APP_CONFIG.mockLatencyMs)
    return MOCK_WORKERS.map((worker) => withDistance(worker, origin)).sort(
      (a, b) =>
        AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability] ||
        a.distanceKm - b.distanceKm,
    )
  },
  async getById(id, origin) {
    await delay(APP_CONFIG.mockLatencyMs / 2)
    const worker = MOCK_WORKERS.find((item) => item.id === id)
    return worker ? withDistance(worker, origin) : null
  },
}

export const workersService: WorkersService = mockWorkersService
