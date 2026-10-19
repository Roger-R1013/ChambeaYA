import type { InputHTMLAttributes, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  invalid?: boolean
}

export function Checkbox({ id, label, invalid = false, className, ...rest }: CheckboxProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          aria-invalid={invalid || undefined}
          className={cn(
            'peer size-5 cursor-pointer appearance-none rounded-[6px] border bg-white transition-colors duration-150',
            'checked:border-primary-600 checked:bg-primary-600',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
            invalid ? 'border-danger-500' : 'border-border-strong hover:border-primary-400',
          )}
          {...rest}
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden
        />
      </span>
      <label htmlFor={id} className="cursor-pointer text-label font-normal text-ink-muted select-none">
        {label}
      </label>
    </div>
  )
}
