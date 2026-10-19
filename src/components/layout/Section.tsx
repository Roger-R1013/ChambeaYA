import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionProps {
  id: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Section({ id, title, description, action, className, children }: SectionProps) {
  const titleId = `${id}-title`
  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-heading text-ink md:text-[1.25rem]">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-label font-normal text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
