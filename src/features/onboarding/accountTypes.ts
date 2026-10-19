import { BriefcaseBusiness, UserRoundSearch, type LucideIcon } from 'lucide-react'
import type { AccountType } from '@/types/user'

export interface AccountTypeOption {
  value: AccountType
  title: string
  description: string
  highlights: readonly string[]
  icon: LucideIcon
}

export const ACCOUNT_TYPE_OPTIONS: readonly AccountTypeOption[] = [
  {
    value: 'client',
    title: 'Cliente',
    description: 'Quiero encontrar y contratar servicios.',
    highlights: ['Profesionales cerca de ti', 'Compara perfiles y reseñas'],
    icon: UserRoundSearch,
  },
  {
    value: 'worker',
    title: 'Trabajador',
    description: 'Quiero ofrecer mis servicios y encontrar oportunidades.',
    highlights: ['Recibe solicitudes en tu zona', 'Construye tu reputación'],
    icon: BriefcaseBusiness,
  },
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  client: 'Cliente',
  worker: 'Trabajador',
}
