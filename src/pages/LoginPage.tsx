import { ROUTES } from '@/config/routes'
import { AuthPageHeader } from '@/features/auth/components/AuthPageHeader'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <div className="animate-fade-up">
      <AuthPageHeader
        title="Bienvenido de nuevo"
        description="Ingresa a tu cuenta para encontrar servicios cerca de ti."
        backTo={ROUTES.welcome}
      />
      <LoginForm />
    </div>
  )
}
