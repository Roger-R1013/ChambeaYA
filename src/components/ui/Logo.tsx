import { useId } from 'react'
import { cn } from '@/lib/cn'

type LogoTone = 'brand' | 'white'

export interface LogoMarkProps {
  className?: string
  tone?: LogoTone
  title?: string
}

/**
 * Brand mark: a worker silhouette integrated in a location pin, with an
 * availability dot. Recreated in SVG; replace paths if the official file is provided.
 */
export function LogoMark({ className, tone = 'brand', title }: LogoMarkProps) {
  const gradientId = `logo-gradient-${useId().replace(/[^\w-]/g, '')}`
  const isBrand = tone === 'brand'
  const pinFill = isBrand ? `url(#${gradientId})` : '#FFFFFF'
  const figureFill = isBrand ? '#FFFFFF' : '#039F9C'

  return (
    <svg
      viewBox="0 0 48 56"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {isBrand && (
        <defs>
          <linearGradient id={gradientId} x1="6" y1="2" x2="42" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#03CCAD" />
            <stop offset="0.5" stopColor="#039F9C" />
            <stop offset="1" stopColor="#03576A" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M24 2C12.4 2 3 11.2 3 22.6c0 14.3 17.2 29.6 19.5 31.6a2.3 2.3 0 0 0 3 0C27.8 52.2 45 36.9 45 22.6 45 11.2 35.6 2 24 2Z"
        fill={pinFill}
      />
      <circle cx="24" cy="16.5" r="5.6" fill={figureFill} />
      <path
        d="M13.6 33.2c1.5-5.7 5.6-9 10.4-9s8.9 3.3 10.4 9a1.7 1.7 0 0 1-1.6 2.1H15.2a1.7 1.7 0 0 1-1.6-2.1Z"
        fill={figureFill}
      />
      <circle cx="37.5" cy="9.5" r="5" fill="#FF8A00" stroke={isBrand ? '#FFFFFF' : '#039F9C'} strokeWidth="2.5" />
    </svg>
  )
}

export interface LogoProps extends LogoMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
}

const SIZES = {
  sm: { mark: 'h-7', text: 'text-heading' },
  md: { mark: 'h-9', text: 'text-[1.375rem] leading-none' },
  lg: { mark: 'h-12', text: 'text-[1.75rem] leading-none' },
  xl: { mark: 'h-20', text: 'text-[2.5rem] leading-none' },
} as const

export function Logo({ size = 'md', tone = 'brand', showWordmark = true, className }: LogoProps) {
  const styles = SIZES[size]
  const isBrand = tone === 'brand'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={tone} className={cn(styles.mark, 'w-auto')} title={showWordmark ? undefined : 'ChambeaYA!'} />
      {showWordmark && (
        <span className={cn('font-extrabold tracking-tight', styles.text, isBrand ? 'text-ink' : 'text-white')}>
          Chambea<span className={isBrand ? 'text-primary-600' : 'text-secondary-100'}>YA!</span>
        </span>
      )}
    </span>
  )
}
