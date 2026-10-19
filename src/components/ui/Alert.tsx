import type { ReactNode } from 'react'
import { CircleAlert, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type AlertTone = 'error' | 'info'

const TONES: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  error: { box: 'border-danger-500/25 bg-danger-50 text-danger-700', icon: CircleAlert },
  info: { box: 'border-primary-200 bg-primary-50 text-primary-800', icon: Info },
}

export interface AlertProps {
  tone?: AlertTone
  children: ReactNode
  className?: string
}

export function Alert({ tone = 'error', children, className }: AlertProps) {
  const { box, icon: Icon } = TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-label font-normal animate-fade-in', box, className)}
    >
      <Icon className="mt-px size-[18px] shrink-0" strokeWidth={2} aria-hidden />
      <div>{children}</div>
    </div>
  )
}
