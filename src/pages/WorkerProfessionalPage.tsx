import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { WorkerProfessionalForm } from '@/features/profile/components/WorkerProfessionalForm'
import { useCatalogCategories, useServiceZones, useWorkerProfile } from '@/features/profile/hooks/useProfileData'

function WorkerProfessionalContent({ userId }: { userId: string }) {
  const profileState = useWorkerProfile(userId)
  const categoriesState = useCatalogCategories()
  const zonesState = useServiceZones()

  if (profileState.status === 'loading' || categoriesState.status === 'loading' || zonesState.status === 'loading') {
    return <LoadingState label="Cargando tu perfil profesional..." />
  }

  if (profileState.status === 'error' || categoriesState.status === 'error' || zonesState.status === 'error') {
    const error = profileState.error ?? categoriesState.error ?? zonesState.error
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert>{error?.message ?? 'No se pudo cargar la información.'}</Alert>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <WorkerProfessionalForm
      userId={userId}
      profile={profileState.data}
      categories={categoriesState.data}
      zones={zonesState.data}
      onSaved={profileState.reload}
    />
  )
}

export function WorkerProfessionalPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          title="Perfil profesional"
          description="Esta información ayuda a los clientes a encontrarte. Tu teléfono y tu dirección no se muestran públicamente."
          backTo={ROUTES.profile}
        />
        <Card as="section" padding="lg">
          <WorkerProfessionalContent userId={user.id} />
        </Card>
      </div>
    </div>
  )
}
