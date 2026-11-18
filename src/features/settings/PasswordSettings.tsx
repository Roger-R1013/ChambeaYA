import { useRef, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements'
import { useForm, type FormErrors } from '@/hooks/useForm'
import { authService } from '@/services/auth.service'
import { isStrongPassword } from '@/utils/validators'

const INITIAL_VALUES = { currentPassword: '', password: '', confirmation: '', nonce: '' }
type PasswordValues = typeof INITIAL_VALUES

function validatePassword(values: PasswordValues, needsCode: boolean): FormErrors<PasswordValues> {
  const errors: FormErrors<PasswordValues> = {}
  if (!values.currentPassword) errors.currentPassword = 'Ingresa tu contraseña actual.'
  if (!isStrongPassword(values.password)) errors.password = 'La nueva contraseña no cumple los requisitos.'
  else if (values.password === values.currentPassword) errors.password = 'Elige una contraseña distinta a la actual.'
  if (!values.confirmation) errors.confirmation = 'Confirma tu nueva contraseña.'
  else if (values.confirmation !== values.password) errors.confirmation = 'Las contraseñas no coinciden.'
  if (needsCode && !values.nonce.trim()) errors.nonce = 'Ingresa el código de verificación.'
  return errors
}

function PasswordForm({ onCancel, onChanged }: { onCancel: () => void; onChanged: () => void }) {
  const inFlight = useRef(false)
  const [codeStatus, setCodeStatus] = useState<'required' | 'sent' | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const form = useForm({
    initialValues: INITIAL_VALUES,
    validate: (values) => validatePassword(values, codeStatus !== null),
    onSubmit: async ({ currentPassword, password, nonce }) => {
      if (inFlight.current || codeStatus === 'required') return
      inFlight.current = true
      try {
        const result = await authService.changePassword({ currentPassword, password, nonce: nonce.trim() })
        if (result === 'code_required') {
          setCodeStatus('required')
          setCodeError(null)
          return
        }
        onChanged()
      } finally {
        inFlight.current = false
      }
    },
  })

  async function sendCode() {
    if (inFlight.current) return
    inFlight.current = true
    setSendingCode(true)
    setCodeError(null)
    try {
      await authService.requestPasswordChangeCode()
      form.setFieldValue('nonce', '')
      setCodeStatus('sent')
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'No se pudo solicitar el código.')
    } finally {
      inFlight.current = false
      setSendingCode(false)
    }
  }

  const busy = form.isSubmitting || sendingCode

  function submit(event: FormEvent<HTMLFormElement>) {
    if (inFlight.current) {
      event.preventDefault()
      return
    }
    void form.handleSubmit(event)
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      {form.submitError && <Alert>{form.submitError}</Alert>}
      <FormField id="settings-current-password" label="Contraseña actual" required error={form.getError('currentPassword')}>
        {({ invalid, ...control }) => (
          <PasswordInput {...control} {...form.getInputProps('currentPassword')} invalid={invalid}
            autoComplete="current-password" disabled={busy} />
        )}
      </FormField>
      <FormField id="settings-new-password" label="Nueva contraseña" required error={form.getError('password')}>
        {({ invalid, ...control }) => (
          <PasswordInput {...control} {...form.getInputProps('password')} invalid={invalid}
            aria-describedby={[control['aria-describedby'], 'settings-password-requirements'].filter(Boolean).join(' ')}
            autoComplete="new-password" disabled={busy} />
        )}
      </FormField>
      <PasswordRequirements id="settings-password-requirements" password={form.values.password} />
      <FormField id="settings-confirm-password" label="Confirmar nueva contraseña" required error={form.getError('confirmation')}>
        {({ invalid, ...control }) => (
          <PasswordInput {...control} {...form.getInputProps('confirmation')} invalid={invalid}
            autoComplete="new-password" disabled={busy} />
        )}
      </FormField>
      {codeStatus !== null && (
        <div className="flex flex-col gap-3">
          <Alert tone="info">
            {codeStatus === 'sent'
              ? 'Se solicitó el código. Revisa tu medio de contacto confirmado.'
              : 'Se requiere una verificación adicional para cambiar la contraseña.'}
          </Alert>
          {codeError && <Alert>{codeError}</Alert>}
          {codeStatus === 'sent' && (
            <FormField id="settings-password-code" label="Código de verificación" required error={form.getError('nonce')}>
              {({ invalid, ...control }) => (
                <Input {...control} {...form.getInputProps('nonce')} invalid={invalid}
                  autoComplete="one-time-code" inputMode="numeric" disabled={busy} />
              )}
            </FormField>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={sendCode}
            isLoading={sendingCode} disabled={form.isSubmitting}>
            {codeStatus === 'sent' ? 'Solicitar otro código' : 'Solicitar código'}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={form.isSubmitting} loadingText="Guardando..."
          disabled={sendingCode || codeStatus === 'required'}>
          Confirmar cambio
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
      </div>
    </form>
  )
}

export function PasswordSettings() {
  const [status, setStatus] = useState<'idle' | 'editing' | 'changed'>('idle')

  if (status === 'editing') {
    return <PasswordForm onCancel={() => setStatus('idle')} onChanged={() => setStatus('changed')} />
  }

  return (
    <>
      {status === 'changed' && <Alert tone="success">Tu contraseña se actualizó.</Alert>}
      <Button variant="outline" leftIcon={KeyRound} className="self-start" onClick={() => setStatus('editing')}>
        Cambiar contraseña
      </Button>
    </>
  )
}
