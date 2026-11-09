import { BadgeCheck, CircleDashed, Clock3, FileWarning, type LucideIcon } from 'lucide-react'
import type { BadgeTone } from '@/components/ui/Badge'
import type { VerificationStatus } from '@/types/profile'

interface VerificationMeta {
  label: string
  description: string
  tone: BadgeTone
  icon: LucideIcon
}

/**
 * Display copy for `worker_profiles.verification_status`. The status is only
 * changed by the review process (database-protected); the app never claims an
 * identity was checked unless the status is 'verified'.
 */
export const VERIFICATION_META: Record<VerificationStatus, VerificationMeta> = {
  unverified: {
    label: 'Sin verificar',
    description: 'Sube tu documento y una selfie para solicitar la revisión manual de tu identidad.',
    tone: 'neutral',
    icon: CircleDashed,
  },
  pending: {
    label: 'En revisión',
    description: 'Tus documentos están siendo revisados por el equipo de ChambeaYA!.',
    tone: 'warning',
    icon: Clock3,
  },
  verified: {
    label: 'Verificado',
    description: 'Tu identidad fue revisada y aprobada por el equipo de ChambeaYA!.',
    tone: 'success',
    icon: BadgeCheck,
  },
  rejected: {
    label: 'Requiere corrección',
    description: 'La revisión no fue aprobada. Reemplaza las imágenes necesarias y vuelve a enviar la solicitud.',
    tone: 'accent',
    icon: FileWarning,
  },
}
