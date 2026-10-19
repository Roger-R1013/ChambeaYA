import { NavLink } from 'react-router'
import { MAIN_NAV_ITEMS } from '@/config/navigation'
import { cn } from '@/lib/cn'

/** Mobile-only bottom tab bar. */
export function BottomNavigation() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {MAIN_NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-16 flex-col items-center justify-center gap-1 text-micro transition-colors duration-200',
                  'focus-visible:outline-offset-[-4px]',
                  isActive ? 'text-primary-700' : 'text-ink-subtle hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute top-0 h-0.5 w-8 rounded-full bg-primary-600 transition-[opacity,transform] duration-300',
                      isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200',
                      isActive && 'bg-primary-50',
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
