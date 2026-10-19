import { Link, useNavigate } from 'react-router'
import { ArrowRight, Mail, Phone, UserRound } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ROUTES } from '@/config/routes'
import { useForm } from '@/hooks/useForm'
import { useAuth } from '../hooks/useAuth'
import { REGISTER_INITIAL_VALUES, validateRegister, type RegisterFormValues } from '../validation'
import { PasswordRequirements } from './PasswordRequirements'

export function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const form = useForm<RegisterFormValues>({
    initialValues: REGISTER_INITIAL_VALUES,
    validate: validateRegister,
    onSubmit: async ({ firstName, lastName, email, phone, password }) => {
      await register({ firstName, lastName, email, phone, password })
      navigate(ROUTES.accountType, { replace: true })
    },
  })

  const termsError = form.getError('acceptTerms')

  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-5">
      {form.submitError && <Alert>{form.submitError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="register-first-name" label="Nombre" error={form.getError('firstName')}>
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('firstName')}
              invalid={invalid}
              autoComplete="given-name"
              placeholder="Ej. María"
              leftIcon={UserRound}
            />
          )}
        </FormField>
        <FormField id="register-last-name" label="Apellido" error={form.getError('lastName')}>
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('lastName')}
              invalid={invalid}
              autoComplete="family-name"
              placeholder="Ej. Fernández"
            />
          )}
        </FormField>
      </div>

      <FormField id="register-email" label="Correo electrónico" error={form.getError('email')}>
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

      <FormField
        id="register-phone"
        label="Teléfono"
        error={form.getError('phone')}
        hint="Celular de 8 dígitos. Lo usaremos para coordinar tus servicios."
      >
        {({ invalid, ...control }) => (
          <Input
            {...control}
            {...form.getInputProps('phone')}
            invalid={invalid}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="71234567"
            leftIcon={Phone}
          />
        )}
      </FormField>

      <FormField id="register-password" label="Contraseña" error={form.getError('password')}>
        {({ invalid, ...control }) => (
          <div className="flex flex-col gap-2.5">
            <PasswordInput
              {...control}
              aria-describedby={[control['aria-describedby'], 'register-password-rules'].filter(Boolean).join(' ')}
              {...form.getInputProps('password')}
              invalid={invalid}
              autoComplete="new-password"
              placeholder="Crea una contraseña segura"
            />
            <PasswordRequirements id="register-password-rules" password={form.values.password} />
          </div>
        )}
      </FormField>

      <FormField id="register-confirm-password" label="Confirmar contraseña" error={form.getError('confirmPassword')}>
        {({ invalid, ...control }) => (
          <PasswordInput
            {...control}
            {...form.getInputProps('confirmPassword')}
            invalid={invalid}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
          />
        )}
      </FormField>

      <div className="flex flex-col gap-1.5">
        <Checkbox
          id="register-terms"
          name="acceptTerms"
          checked={form.values.acceptTerms}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          invalid={Boolean(termsError)}
          aria-describedby={termsError ? 'register-terms-error' : undefined}
          label={
            <>
              Acepto los <span className="font-semibold text-ink">Términos y condiciones</span> y la{' '}
              <span className="font-semibold text-ink">Política de privacidad</span> de ChambeaYA!
            </>
          }
        />
        {termsError && (
          <p id="register-terms-error" className="pl-8 text-caption text-danger-700 animate-fade-in">
            {termsError}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={form.isSubmitting}
        loadingText="Creando cuenta..."
        rightIcon={ArrowRight}
        className="mt-1"
      >
        Continuar
      </Button>

      <p className="text-center text-label font-normal text-ink-muted">
        ¿Ya tienes una cuenta?{' '}
        <Link to={ROUTES.login} className="font-semibold text-primary-700 hover:text-primary-800 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
