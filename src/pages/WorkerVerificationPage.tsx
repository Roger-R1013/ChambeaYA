import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { CertificatesManager } from '@/features/profile/components/CertificatesManager'
import { IdentityVerificationPanel } from '@/features/profile/components/IdentityVerificationPanel'
import { useWorkerProfile } from '@/features/profile/hooks/useProfileData'

function VerificationContent({ userId }: { userId: string }) {
  const profileState = useWorkerProfile(userId)

  if (profileState.status === 'loading') return <LoadingState label="Cargando tu verificación..." />

  if (profileState.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert>{profileState.error.message}</Alert>
        <Button variant="secondary" onClick={profileState.reload}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <IdentityVerificationPanel
      userId={userId}
      status={profileState.data.verificationStatus}
      note={profileState.data.verificationNote}
      onSubmitted={profileState.reload}
    />
  )
}

export function WorkerVerificationPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          title="Verificación y certificados"
          description="Solicita la verificación de tu identidad y respalda tu experiencia con certificados. Nada de esto se muestra públicamente."
          backTo={ROUTES.profile}
        />
        <Card as="section" padding="lg">
          <VerificationContent userId={user.id} />
        </Card>
        <Card as="section" padding="lg">
          <CertificatesManager userId={user.id} />
        </Card>
      </div>
    </div>
  )
}
