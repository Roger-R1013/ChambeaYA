import type { Ref, SelectHTMLAttributes } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  leftIcon?: LucideIcon
  invalid?: boolean
  ref?: Ref<HTMLSelectElement>
}

/** Native <select> with the same look as <Input> (accessible and mobile friendly). */
export function Select({ leftIcon: LeftIcon, invalid = false, className, ref, children, ...rest }: SelectProps) {
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
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-12 w-full cursor-pointer appearance-none rounded-md border bg-white pr-11 pl-4 text-body text-ink shadow-xs',
          'transition-[border-color,box-shadow] duration-200',
          'focus:outline-none focus-visible:outline-none focus:ring-4',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
          invalid
            ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15'
            : 'border-border hover:border-border-strong focus:border-primary-500 focus:ring-primary-500/15',
          LeftIcon && 'pl-11',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-subtle"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  )
}
