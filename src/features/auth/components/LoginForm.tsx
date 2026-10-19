import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { LogIn, Mail } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ROUTES } from '@/config/routes'
import { useForm } from '@/hooks/useForm'
import { useAuth } from '../hooks/useAuth'
import { resolvePostAuthPath } from '../utils/redirect'
import { LOGIN_INITIAL_VALUES, validateLogin, type LoginFormValues } from '../validation'

interface LocationState {
  from?: string
}

export function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false)

  const form = useForm<LoginFormValues>({
    initialValues: LOGIN_INITIAL_VALUES,
    validate: validateLogin,
    onSubmit: async (values) => {
      const user = await login(values)
      const from = (location.state as LocationState | null)?.from
      navigate(resolvePostAuthPath(user, from), { replace: true })
    },
  })

  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-5">
      {form.submitError && <Alert>{form.submitError}</Alert>}

      <FormField id="login-email" label="Correo electrónico" error={form.getError('email')}>
        {({ invalid, ...control }) => (
          <Input
            {...control}
            {...form.getInputProps('email')}
            invalid={invalid}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tucorreo@ejemplo.com"
            leftIcon={Mail}
          />
        )}
      </FormField>

      <FormField id="login-password" label="Contraseña" error={form.getError('password')}>
        {({ invalid, ...control }) => (
          <PasswordInput
            {...control}
            {...form.getInputProps('password')}
            invalid={invalid}
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
          />
        )}
      </FormField>

      <div className="flex items-center justify-between gap-3">
        <Checkbox
          id="login-remember"
          name="rememberMe"
          checked={form.values.rememberMe}
          onChange={form.handleChange}
          label="Recordar sesión"
        />
        <button
          type="button"
          onClick={() => setShowRecoveryNotice(true)}
          className="rounded-sm text-label text-primary-700 transition-colors hover:text-primary-800 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {showRecoveryNotice && (
        <Alert tone="info">La recuperación de contraseña estará disponible al conectar el servidor.</Alert>
      )}

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={form.isSubmitting}
        loadingText="Ingresando..."
        rightIcon={LogIn}
        className="mt-1"
      >
        Iniciar sesión
      </Button>

      <p className="text-center text-label font-normal text-ink-muted">
        ¿No tienes una cuenta?{' '}
        <Link to={ROUTES.register} className="font-semibold text-primary-700 hover:text-primary-800 hover:underline">
          Crear una cuenta
        </Link>
      </p>
    </form>
  )
}
