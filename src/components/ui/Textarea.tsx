import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

/** Multi-line counterpart of <Input>; same borders, focus ring and states. */
export function Textarea({ invalid = false, className, ref, rows = 5, ...rest }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'block w-full resize-y rounded-md border bg-white px-4 py-3 text-body text-ink shadow-xs',
        'placeholder:text-ink-subtle',
        'transition-[border-color,box-shadow] duration-200',
        'focus:outline-none focus-visible:outline-none focus:ring-4',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
        invalid
          ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15'
          : 'border-border hover:border-border-strong focus:border-primary-500 focus:ring-primary-500/15',
        className,
      )}
      {...rest}
    />
  )
}
