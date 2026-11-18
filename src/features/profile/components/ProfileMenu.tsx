import { BriefcaseBusiness, ChevronRight, LogOut, PenLine, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface MenuItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
  onClick: () => void
  tone?: 'default' | 'danger'
}

function ProfileMenuRow({ label, description, icon: Icon, onClick, tone = 'default' }: MenuItem) {
  const isDanger = tone === 'danger'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-200',
        'focus-visible:outline-offset-[-2px]',
        isDanger ? 'hover:bg-danger-50' : 'enabled:hover:bg-surface',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md',
          isDanger ? 'bg-danger-50 text-danger-600' : 'bg-surface-muted text-ink-muted',
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-body font-medium', isDanger ? 'text-danger-700' : 'text-ink')}>{label}</span>
        <span className="truncate text-caption text-ink-subtle">{description}</span>
      </span>
      {!isDanger && <ChevronRight className="size-5 text-ink-subtle" strokeWidth={2} aria-hidden />}
    </button>
  )
}

export interface ProfileMenuProps {
  onLogout: () => void
  onEditProfile: () => void
  onSettings: () => void
  /** Only provided for workers. */
  onEditProfessional?: () => void
  /** Only provided for workers. */
  onVerification?: () => void
  onAdministration?: () => void
}

export function ProfileMenu({ onLogout, onEditProfile, onSettings, onEditProfessional, onVerification, onAdministration }: ProfileMenuProps) {
  const items: MenuItem[] = [
    { id: 'edit', label: 'Editar perfil', description: 'Foto, nombre y datos de contacto', icon: PenLine, onClick: onEditProfile },
    ...(onEditProfessional
      ? [{ id: 'professional', label: 'Perfil profesional', description: 'Oficio, zona y precios', icon: BriefcaseBusiness, onClick: onEditProfessional }]
      : []),
    ...(onVerification
      ? [{ id: 'verification', label: 'Identidad y documentos', description: 'Verificación de identidad y respaldos laborales', icon: ShieldCheck, onClick: onVerification }]
      : []),
    ...(onAdministration
      ? [{ id: 'administration', label: 'Administración', description: 'Bandejas de revisión y trabajadores', icon: ShieldCheck, onClick: onAdministration }]
      : []),
    { id: 'settings', label: 'Configuración', description: 'Cuenta, seguridad, privacidad y notificaciones', icon: Settings, onClick: onSettings },
    { id: 'logout', label: 'Cerrar sesión', description: 'Salir de tu cuenta en este dispositivo', icon: LogOut, tone: 'danger', onClick: onLogout },
  ]

  return (
    <Card as="section" padding="none" aria-label="Opciones de la cuenta" className="overflow-hidden">
      <ul className="divide-y divide-border/70">
        {items.map(({ id, ...item }) => (
          <li key={id}>
            <ProfileMenuRow id={id} {...item} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
