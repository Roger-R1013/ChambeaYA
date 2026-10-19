import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Logo } from '@/components/ui/Logo'

export interface AuthPageHeaderProps {
  title: string
  description: ReactNode
  backTo?: string
  /** Small label above the title, e.g. a step indicator. */
  eyebrow?: string
}

export function AuthPageHeader({ title, description, backTo, eyebrow }: AuthPageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="mb-8">
      <div className="mb-6 flex h-11 items-center justify-between lg:mb-8">
        {backTo ? (
          <IconButton icon={ChevronLeft} label="Volver" variant="soft" onClick={() => navigate(backTo)} />
        ) : (
          <span />
        )}
        <Logo size="sm" className="lg:hidden" />
        <span className="size-11 lg:hidden" aria-hidden />
      </div>
      {eyebrow && <p className="mb-2 text-label text-primary-700">{eyebrow}</p>}
      <h1 className="text-title text-ink sm:text-[1.75rem] sm:leading-[2.25rem]">{title}</h1>
      <p className="mt-2 text-body text-ink-muted">{description}</p>
    </header>
  )
}
