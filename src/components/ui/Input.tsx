import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leftIcon?: LucideIcon
  /** Interactive element rendered inside the right edge (e.g. visibility toggle). */
  rightSlot?: ReactNode
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({
  leftIcon: LeftIcon,
  rightSlot,
  invalid = false,
  className,
  ref,
  ...rest
}: InputProps) {
  return (
    <div className="relative">
      {LeftIcon && (
        <LeftIcon
          className={cn(
            'pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 transition-colors',
            invalid ? 'text-danger-600' : 'text-ink-subtle',
          )}
          strokeWidth={2}
          aria-hidden
        />
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-12 w-full rounded-md border bg-white px-4 text-body text-ink shadow-xs',
          'placeholder:text-ink-subtle',
          'transition-[border-color,box-shadow] duration-200',
          'focus:outline-none focus-visible:outline-none focus:ring-4',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
          invalid
            ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15'
            : 'border-border hover:border-border-strong focus:border-primary-500 focus:ring-primary-500/15',
          LeftIcon && 'pl-11',
          rightSlot !== undefined && 'pr-12',
          className,
        )}
        {...rest}
      />
      {rightSlot !== undefined && (
        <div className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</div>
      )}
    </div>
  )
}
