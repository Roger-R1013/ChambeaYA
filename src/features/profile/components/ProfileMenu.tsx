import { ChevronRight, LogOut, PenLine, Settings, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface MenuItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
  onClick?: () => void
  tone?: 'default' | 'danger'
  /** Feature not built yet; rendered disabled with a "Próximamente" badge. */
  comingSoon?: boolean
}

function ProfileMenuRow({ label, description, icon: Icon, onClick, tone = 'default', comingSoon }: MenuItem) {
  const isDanger = tone === 'danger'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon || undefined}
      className={cn(
        'flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-200',
        'focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed',
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
      {comingSoon ? (
        <Badge>Próximamente</Badge>
      ) : (
        !isDanger && <ChevronRight className="size-5 text-ink-subtle" strokeWidth={2} aria-hidden />
      )}
    </button>
  )
}

export function ProfileMenu({ onLogout }: { onLogout: () => void }) {
  const items: MenuItem[] = [
    { id: 'edit', label: 'Editar perfil', description: 'Nombre, foto y datos de contacto', icon: PenLine, comingSoon: true },
    { id: 'settings', label: 'Configuración', description: 'Notificaciones, privacidad y cuenta', icon: Settings, comingSoon: true },
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
