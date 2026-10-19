import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center animate-fade-up', className)}>
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-8 ring-primary-50/50">
        <Icon className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="text-heading text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
