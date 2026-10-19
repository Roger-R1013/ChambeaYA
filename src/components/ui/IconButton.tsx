import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type IconButtonVariant = 'ghost' | 'soft' | 'inverse'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Required: icon-only controls must have an accessible name. */
  label: string
  variant?: IconButtonVariant
  size?: 'sm' | 'md'
}

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  soft: 'bg-white text-ink shadow-xs ring-1 ring-border hover:bg-surface',
  inverse: 'bg-white/15 text-white hover:bg-white/25',
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'size-9' : 'size-11',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </button>
  )
}
