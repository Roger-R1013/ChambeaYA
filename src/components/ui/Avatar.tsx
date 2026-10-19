import { useState } from 'react'
import { cn } from '@/lib/cn'
import { getInitials } from '@/utils/format'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'
export type AvatarStatus = 'online' | 'busy' | 'offline'

export interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
  status?: AvatarStatus
  className?: string
}

const SIZES: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  sm: { box: 'size-9', text: 'text-caption', dot: 'size-2.5' },
  md: { box: 'size-12', text: 'text-label', dot: 'size-3' },
  lg: { box: 'size-16', text: 'text-heading', dot: 'size-3.5' },
  xl: { box: 'size-24', text: 'text-title', dot: 'size-4' },
}

const STATUS_COLOR: Record<AvatarStatus, string> = {
  online: 'bg-success-500',
  busy: 'bg-accent-500',
  offline: 'bg-border-strong',
}

export function Avatar({ name, src, size = 'md', status, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src
  const styles = SIZES[size]

  return (
    <span className={cn('relative inline-flex shrink-0', styles.box, className)}>
      {showImage ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
          className="size-full rounded-full object-cover ring-2 ring-white"
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className={cn(
            'flex size-full items-center justify-center rounded-full bg-brand-gradient font-semibold text-white ring-2 ring-white',
            styles.text,
          )}
        >
          {getInitials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-white',
            styles.dot,
            STATUS_COLOR[status],
          )}
          aria-hidden
        />
      )}
    </span>
  )
}
