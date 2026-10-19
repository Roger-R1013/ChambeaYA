import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface LoadingStateProps {
  label?: string
  className?: string
}

export function LoadingState({ label = 'Cargando...', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-ink-muted', className)}
    >
      <LoaderCircle className="size-7 animate-spin text-primary-500" strokeWidth={2} aria-hidden />
      <span className="text-label">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-muted', className)} aria-hidden />
}
