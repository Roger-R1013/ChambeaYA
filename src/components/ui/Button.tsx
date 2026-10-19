import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { buttonStyles, type ButtonStyleOptions } from './button.styles'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<ButtonStyleOptions, 'className'> {
  isLoading?: boolean
  loadingText?: string
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
}

export function Button({
  variant,
  size,
  fullWidth,
  isLoading = false,
  loadingText,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, fullWidth, className })}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle className="size-[18px] animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        LeftIcon && <LeftIcon className="size-[18px]" strokeWidth={2} aria-hidden />
      )}
      <span>{isLoading && loadingText ? loadingText : children}</span>
      {!isLoading && RightIcon && <RightIcon className="size-[18px]" strokeWidth={2} aria-hidden />}
    </button>
  )
}
