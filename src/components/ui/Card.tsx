import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type CardElement = 'div' | 'article' | 'section' | 'li'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export function Card({
  as: Component = 'div',
  padding = 'md',
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(
        'rounded-lg border border-border/70 bg-white shadow-sm',
        PADDING[padding],
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md',
        className,
      )}
      {...rest}
    />
  )
}
