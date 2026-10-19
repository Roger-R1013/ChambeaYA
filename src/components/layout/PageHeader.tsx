import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Path to navigate back to; when omitted no back button is shown. */
  backTo?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, backTo, actions, className }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={cn('flex items-start gap-3', className)}>
      {backTo && (
        <IconButton
          icon={ChevronLeft}
          label="Volver"
          variant="soft"
          onClick={() => navigate(backTo)}
          className="-ml-1"
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-title text-ink">{title}</h1>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
