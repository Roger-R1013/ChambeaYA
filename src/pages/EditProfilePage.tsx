import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AvatarUploader } from '@/features/profile/components/AvatarUploader'
import { PersonalInfoForm } from '@/features/profile/components/PersonalInfoForm'

export function EditProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          title="Editar perfil"
          description="Actualiza tu foto y tus datos personales. Tu teléfono y tu correo solo los ves tú."
          backTo={ROUTES.profile}
        />
        <Card as="section" padding="lg">
          <AvatarUploader user={user} />
        </Card>
        <Card as="section" padding="lg">
          <PersonalInfoForm user={user} />
        </Card>
      </div>
    </div>
  )
}
