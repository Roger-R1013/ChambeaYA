import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LocateFixed, LogOut, PenLine } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buttonStyles } from '@/components/ui/button.styles'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { NotificationSettings } from '@/features/settings/NotificationSettings'
import { PasswordSettings } from '@/features/settings/PasswordSettings'
import type { User } from '@/types/user'
import { formatPhone, getFullName } from '@/utils/format'

function AccountSettings({ user }: { user: User }) {
  return (
    <>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-ink-subtle">Nombre</dt>
          <dd className="wrap-break-word text-body text-ink">{getFullName(user)}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-subtle">Correo electrónico</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 wrap-break-word text-body text-ink">{user.email || 'Sin registrar'}</span>
            {user.email && (
              <Badge tone={user.emailConfirmedAt ? 'success' : 'warning'}>
                {user.emailConfirmedAt ? 'Confirmado' : 'Pendiente de confirmación'}
              </Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-subtle">Teléfono</dt>
          <dd className="text-body text-ink">{user.phone ? formatPhone(user.phone) : 'Sin registrar'}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-subtle">Tipo de cuenta</dt>
          <dd className="text-body text-ink">{user.accountType === 'worker' ? 'Trabajador' : 'Cliente'}</dd>
        </div>
      </dl>
      <Link to={ROUTES.profileEdit} className={buttonStyles({ variant: 'outline', className: 'self-start' })}>
        <PenLine className="size-[18px]" strokeWidth={2} aria-hidden />
        Editar datos personales
      </Link>
    </>
  )
}

function PrivacySettings({ isWorker }: { isWorker: boolean }) {
  return (
    <>
      {isWorker ? (
        <p className="text-label text-ink-muted">
          Cuando compartes tu ubicación aproximada, tu marcador puede aparecer en las búsquedas según tu disponibilidad.
          En tu perfil profesional puedes cambiar o retirar la ubicación y ajustar tu disponibilidad.
        </p>
      ) : (
        <p className="text-label text-ink-muted">
          En Buscar puedes solicitar al navegador tu ubicación para ordenar resultados por cercanía. ChambeaYA! no guarda
          esa ubicación en tu cuenta. Para cambiar o retirar el permiso, abre los permisos de este sitio en tu navegador.
        </p>
      )}
      <Link
        to={isWorker ? `${ROUTES.workerProfessional}#worker-availability-title` : `${ROUTES.search}#search-map-title`}
        className={buttonStyles({ variant: 'outline', className: 'self-start' })}
      >
        <LocateFixed className="size-[18px]" strokeWidth={2} aria-hidden />
        {isWorker ? 'Disponibilidad y ubicación' : 'Ir a Buscar'}
      </Link>
    </>
  )
}

function SessionSettings() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(false)

  async function confirmLogout() {
    if (inFlight.current) return
    inFlight.current = true
    setSigningOut(true)
    setError(false)
    try {
      await logout()
      navigate(ROUTES.welcome, { replace: true })
    } catch {
      setError(true)
    } finally {
      inFlight.current = false
      setSigningOut(false)
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" leftIcon={LogOut} className="self-start" onClick={() => setConfirming(true)}>
        Cerrar sesión
      </Button>
    )
  }

  return (
    <>
      <p className="text-label text-ink-muted">¿Quieres cerrar sesión en este dispositivo?</p>
      {error && <Alert>No se pudo cerrar la sesión. Inténtalo nuevamente.</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" isLoading={signingOut} loadingText="Cerrando..." onClick={confirmLogout}>
          Confirmar cierre
        </Button>
        <Button variant="ghost" disabled={signingOut} onClick={() => { setConfirming(false); setError(false) }}>
          Cancelar
        </Button>
      </div>
    </>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Configuración" backTo={ROUTES.profile} />
        <Card padding="lg">
          <Section id="settings-account" title="Cuenta">
            <AccountSettings user={user} />
          </Section>
        </Card>
        <Card padding="lg">
          <Section id="settings-password" title="Contraseña y seguridad">
            <PasswordSettings key={user.id} />
          </Section>
        </Card>
        <Card padding="lg">
          <Section id="settings-privacy" title="Privacidad">
            <PrivacySettings isWorker={user.accountType === 'worker'} />
          </Section>
        </Card>
        <Card padding="lg">
          <Section
            id="settings-notifications"
            title="Notificaciones"
            description="Estas preferencias quedan guardadas en tu cuenta. La entrega de avisos de la plataforma aún no está habilitada."
          >
            <NotificationSettings userId={user.id} accountType={user.accountType} />
            <p className="text-caption text-ink-muted">La verificación y los mensajes esenciales de tu cuenta funcionan por separado.</p>
          </Section>
        </Card>
        <Card padding="lg">
          <Section id="settings-session" title="Sesión">
            <SessionSettings key={user.id} />
          </Section>
        </Card>
      </div>
    </div>
  )
}
