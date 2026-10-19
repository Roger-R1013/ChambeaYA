import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'accent'

export interface BadgeProps {
  tone?: BadgeTone
  icon?: LucideIcon
  dot?: boolean
  className?: string
  children: ReactNode
}

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-surface-muted text-ink-muted', dot: 'bg-ink-subtle' },
  primary: { badge: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
  success: { badge: 'bg-success-50 text-success-700', dot: 'bg-success-500' },
  warning: { badge: 'bg-warning-50 text-warning-700', dot: 'bg-accent-500' },
  accent: { badge: 'bg-accent-50 text-accent-700', dot: 'bg-accent-500' },
}

export function Badge({ tone = 'neutral', icon: Icon, dot = false, className, children }: BadgeProps) {
  const styles = TONES[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro whitespace-nowrap',
        styles.badge,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden />}
      {Icon && <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  )
}
