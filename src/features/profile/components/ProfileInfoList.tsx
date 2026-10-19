import { Mail, Phone, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { User } from '@/types/user'
import { formatPhone } from '@/utils/format'

interface InfoRow {
  label: string
  value: string
  icon: LucideIcon
}

export function ProfileInfoList({ user }: { user: User }) {
  const rows: InfoRow[] = [
    { label: 'Correo electrónico', value: user.email, icon: Mail },
    { label: 'Teléfono', value: user.phone ? formatPhone(user.phone) : 'Sin registrar', icon: Phone },
  ]

  return (
    <Card as="section" padding="none" aria-labelledby="profile-info-title">
      <h2 id="profile-info-title" className="px-5 pt-5 pb-2 text-label text-ink-subtle">
        Información de contacto
      </h2>
      <dl className="divide-y divide-border/70">
        {rows.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3.5 px-5 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-caption text-ink-subtle">{label}</dt>
              <dd className="truncate text-body font-medium text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  )
}
