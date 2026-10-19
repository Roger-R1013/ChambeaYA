import { Link } from 'react-router'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonStyles } from '@/components/ui/button.styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/config/routes'

export function ActivityPage() {
  return (
    <div className="container-app flex flex-col gap-6 pt-6 md:pt-8">
      <PageHeader title="Actividad" description="Tus solicitudes y servicios aparecerán aquí." />
      <Card padding="none">
        <EmptyState
          icon={ClipboardList}
          title="Aún no tienes actividad"
          description="Cuando solicites o realices un servicio, podrás seguir su estado desde esta sección."
          action={
            <Link to={ROUTES.home} className={buttonStyles({ variant: 'secondary' })}>
              Explorar servicios
            </Link>
          }
        />
      </Card>
    </div>
  )
}
