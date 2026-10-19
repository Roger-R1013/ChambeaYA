import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white shadow-brand hover:bg-primary-700',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  outline: 'border border-border-strong bg-white text-ink hover:border-primary-400 hover:bg-primary-50/50',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger-50 text-danger-700 hover:bg-danger-500 hover:text-white',
  inverse: 'bg-white text-primary-800 shadow-md hover:bg-primary-50',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-label',
  md: 'h-11 px-5 text-body',
  lg: 'h-13 px-6 text-body',
}

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}

/** Shared by <Button> and link-styled buttons (<Link className={buttonStyles()}>). */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)
}
