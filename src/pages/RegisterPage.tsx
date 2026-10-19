import { ROUTES } from '@/config/routes'
import { AuthPageHeader } from '@/features/auth/components/AuthPageHeader'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export function RegisterPage() {
  return (
    <div className="animate-fade-up">
      <AuthPageHeader
        eyebrow="Paso 1 de 2"
        title="Crea tu cuenta"
        description="Completa tus datos para empezar a usar ChambeaYA!"
        backTo={ROUTES.welcome}
      />
      <RegisterForm />
    </div>
  )
}
