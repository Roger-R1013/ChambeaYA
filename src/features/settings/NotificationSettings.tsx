import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAsyncData } from '@/hooks/useAsyncData'
import { settingsService, type NotificationPreferences } from '@/services/settings.service'
import type { AccountType } from '@/types/user'

const OPTIONS = [
  { key: 'service_requests', label: 'Solicitudes de servicio' },
  { key: 'job_updates', label: 'Cambios de estado de trabajos' },
  { key: 'identity_reviews', label: 'Verificación de identidad', workerOnly: true },
  { key: 'document_reviews', label: 'Revisión de documentos', workerOnly: true },
  { key: 'security_notices', label: 'Avisos de seguridad de la plataforma' },
] as const satisfies readonly { key: keyof NotificationPreferences; label: string; workerOnly?: boolean }[]

function PreferencesForm({ userId, accountType, initial }: {
  userId: string
  accountType: AccountType | null
  initial: NotificationPreferences
}) {
  const inFlight = useRef(false)
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const options = OPTIONS.filter((option) => !('workerOnly' in option) || accountType === 'worker')
  const changes: Partial<NotificationPreferences> = {}
  for (const { key } of options) {
    if (values[key] !== saved[key]) changes[key] = values[key]
  }
  const hasChanges = Object.keys(changes).length > 0

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || !hasChanges) return
    inFlight.current = true
    setSaving(true)
    setFeedback(null)
    try {
      const updated = await settingsService.saveNotifications(userId, changes)
      setSaved(updated)
      setValues(updated)
      setFeedback({ tone: 'success', message: 'Preferencias guardadas.' })
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'No se pudieron guardar tus preferencias.' })
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset disabled={saving} className="flex flex-col gap-3">
        <legend className="sr-only">Tipos de avisos</legend>
        {options.map(({ key, label }) => (
          <Checkbox
            key={key}
            id={`settings-notification-${key}`}
            label={label}
            checked={values[key]}
            onChange={(event) => {
              const checked = event.target.checked
              setValues((current) => ({ ...current, [key]: checked }))
              setFeedback(null)
            }}
          />
        ))}
      </fieldset>
      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}
      <Button type="submit" className="self-start" isLoading={saving} loadingText="Guardando..." disabled={!hasChanges}>
        Guardar preferencias
      </Button>
    </form>
  )
}

export function NotificationSettings({ userId, accountType }: { userId: string; accountType: AccountType | null }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const load = useCallback((signal: AbortSignal) => settingsService.getNotifications(userId, signal), [userId])
  const preferences = useAsyncData(load, { refreshKey })
  if (preferences.status === 'loading') return <LoadingState label="Cargando tus preferencias..." />
  if (preferences.status === 'error') {
    return (
      <>
        <Alert>{preferences.error.message}</Alert>
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setRefreshKey((current) => current + 1)}>
          Reintentar
        </Button>
      </>
    )
  }
  return <PreferencesForm key={userId} userId={userId} accountType={accountType} initial={preferences.data} />
}
