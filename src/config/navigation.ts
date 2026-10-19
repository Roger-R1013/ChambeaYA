import { ClipboardList, House, Search, UserRound, type LucideIcon } from 'lucide-react'
import { ROUTES } from './routes'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Match only the exact path (needed for the index route). */
  end?: boolean
}

export const MAIN_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', to: ROUTES.home, icon: House, end: true },
  { label: 'Buscar', to: ROUTES.search, icon: Search },
  { label: 'Actividad', to: ROUTES.activity, icon: ClipboardList },
  { label: 'Perfil', to: ROUTES.profile, icon: UserRound },
]
