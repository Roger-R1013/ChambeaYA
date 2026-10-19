import { Link } from 'react-router'
import { MapPinOff } from 'lucide-react'
import { buttonStyles } from '@/components/ui/button.styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/ui/Logo'
import { ROUTES } from '@/config/routes'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6">
      <Logo size="sm" className="mb-6" />
      <EmptyState
        icon={MapPinOff}
        title="Página no encontrada"
        description="La dirección que buscas no existe o fue movida."
        action={
          <Link to={ROUTES.splash} className={buttonStyles()}>
            Volver al inicio
          </Link>
        }
      />
    </main>
  )
}
