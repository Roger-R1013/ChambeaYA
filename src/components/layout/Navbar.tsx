import { Link, NavLink } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Logo } from '@/components/ui/Logo'
import { MAIN_NAV_ITEMS } from '@/config/navigation'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import type { User } from '@/types/user'
import { getFullName } from '@/utils/format'

/** Tablet/desktop top navigation bar. */
export function Navbar({ user }: { user: User | null }) {
  const nameForAvatar = user ? getFullName(user) : 'Usuario'

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/80 bg-white/90 backdrop-blur-md md:block">
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <Link to={ROUTES.home} aria-label="ChambeaYA! - Inicio" className="rounded-md">
          <Logo size="sm" />
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="flex items-center gap-1">
            {MAIN_NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-2 rounded-md px-3.5 text-label transition-colors duration-200',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          to={ROUTES.profile}
          className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 transition-colors hover:bg-surface"
          aria-label="Ir a mi perfil"
        >
          <span className="hidden text-label text-ink lg:inline">{user?.firstName}</span>
          <Avatar name={nameForAvatar} src={user?.avatarUrl} size="sm" />
        </Link>
      </div>
    </header>
  )
}
