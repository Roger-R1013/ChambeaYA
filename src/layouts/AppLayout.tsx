import { Outlet } from 'react-router'
import { BottomNavigation } from '@/components/layout/BottomNavigation'
import { Navbar } from '@/components/layout/Navbar'
import { useAuth } from '@/features/auth/hooks/useAuth'

/** Authenticated shell: top bar on md+, bottom tabs on mobile. */
export function AppLayout() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-label text-primary-700 shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <Navbar user={user} />
      <main id="main-content" className="flex-1 pb-safe-nav md:pb-12">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}
