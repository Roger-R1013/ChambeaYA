import { useState } from 'react'
import { Mail, Phone, Save, UserRound } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { profileService } from '@/services/profile.service'
import type { User } from '@/types/user'
import { toPersonalInfoValues, validatePersonalInfo, type PersonalInfoValues } from '../validation'

export function PersonalInfoForm({ user }: { user: User }) {
  const { refreshProfile } = useAuth()
  const [saved, setSaved] = useState(false)

  const form = useForm<PersonalInfoValues>({
    initialValues: toPersonalInfoValues(user),
    validate: validatePersonalInfo,
    onSubmit: async (values) => {
      setSaved(false)
      await profileService.updatePersonalInfo(user.id, values)
      // Re-read from the database so the whole app shows the persisted values.
      await refreshProfile()
      setSaved(true)
    },
  })

  const isDirty =
    form.values.firstName.trim() !== user.firstName ||
    form.values.lastName.trim() !== user.lastName ||
    form.values.phone.replace(/[\s-]/g, '') !== user.phone

  return (
    <form
      onSubmit={form.handleSubmit}
      onChange={() => setSaved(false)}
      noValidate
      className="flex flex-col gap-5"
      aria-labelledby="personal-info-title"
    >
      <h2 id="personal-info-title" className="text-heading text-ink">
        Datos personales
      </h2>

      {form.submitError && <Alert>{form.submitError}</Alert>}
      {saved && !form.submitError && <Alert tone="success">Tus datos se guardaron correctamente.</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="profile-first-name" label="Nombre" required error={form.getError('firstName')}>
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('firstName')}
              invalid={invalid}
              autoComplete="given-name"
              maxLength={60}
              leftIcon={UserRound}
            />
          )}
        </FormField>
        <FormField id="profile-last-name" label="Apellido" required error={form.getError('lastName')}>
          {({ invalid, ...control }) => (
            <Input {...control} {...form.getInputProps('lastName')} invalid={invalid} autoComplete="family-name" maxLength={60} />
          )}
        </FormField>
      </div>

      <FormField
        id="profile-phone"
        label="Teléfono"
        required
        error={form.getError('phone')}
        hint="Celular de 8 dígitos. Es privado: no se muestra en tu perfil público."
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

      <FormField id="profile-email" label="Correo electrónico" hint="El correo está vinculado a tu inicio de sesión y no se puede cambiar aquí.">
        {({ invalid, ...control }) => (
          <Input {...control} invalid={invalid} value={user.email} readOnly disabled leftIcon={Mail} />
        )}
      </FormField>

      <div className="flex justify-end">
        <Button
          type="submit"
          leftIcon={Save}
          isLoading={form.isSubmitting}
          loadingText="Guardando..."
          disabled={!isDirty}
          className="w-full sm:w-auto"
        >
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
