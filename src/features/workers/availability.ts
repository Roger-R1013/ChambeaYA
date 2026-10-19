import type { BadgeTone } from '@/components/ui/Badge'
import type { AvatarStatus } from '@/components/ui/Avatar'
import type { WorkerAvailability } from '@/types/worker'

interface AvailabilityMeta {
  label: string
  tone: BadgeTone
  avatarStatus: AvatarStatus
}

export const AVAILABILITY_META: Record<WorkerAvailability, AvailabilityMeta> = {
  available: { label: 'Disponible', tone: 'success', avatarStatus: 'online' },
  busy: { label: 'Ocupado', tone: 'warning', avatarStatus: 'busy' },
  offline: { label: 'Desconectado', tone: 'neutral', avatarStatus: 'offline' },
}
