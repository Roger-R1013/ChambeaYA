import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  invalid: boolean
}

export interface FormFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  /** Render prop so the control receives correctly wired a11y attributes. */
  children: (control: FieldControlProps) => ReactNode
}

export function FormField({ id, label, error, hint, required, className, children }: FormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        )}
      </label>

      {children({ id, 'aria-describedby': describedBy || undefined, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-danger-700 animate-fade-in">
          <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-caption text-ink-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
