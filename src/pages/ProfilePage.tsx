import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ProfileHeader } from '@/features/profile/components/ProfileHeader'
import { ProfileInfoList } from '@/features/profile/components/ProfileInfoList'
import { ProfileMenu } from '@/features/profile/components/ProfileMenu'
import { WorkerProfessionalSummary } from '@/features/profile/components/WorkerProfessionalSummary'

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const isWorker = user.accountType === 'worker'

  async function handleLogout() {
    await logout()
    navigate(ROUTES.welcome, { replace: true })
  }

  return (
    <div className="container-app flex flex-col gap-5 pt-4 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-5">
        <ProfileHeader user={user} />
        {isWorker && <WorkerProfessionalSummary userId={user.id} />}
      </div>
      <div className="flex flex-col gap-5">
        <ProfileInfoList user={user} />
        <ProfileMenu
          onLogout={handleLogout}
          onEditProfile={() => navigate(ROUTES.profileEdit)}
          onEditProfessional={isWorker ? () => navigate(ROUTES.workerProfessional) : undefined}
          onVerification={isWorker ? () => navigate(ROUTES.workerVerification) : undefined}
        />
      </div>
    </div>
  )
}
