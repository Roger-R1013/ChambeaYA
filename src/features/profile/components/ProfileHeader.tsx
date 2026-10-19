import { BriefcaseBusiness, UserRoundSearch } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ACCOUNT_TYPE_LABELS } from '@/features/onboarding/accountTypes'
import type { User } from '@/types/user'
import { getFullName } from '@/utils/format'

export function ProfileHeader({ user }: { user: User }) {
  const fullName = getFullName(user)

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
      <div className="h-24 bg-brand-gradient sm:h-28" aria-hidden>
        <div className="size-full bg-[radial-gradient(circle_at_85%_20%,rgb(255_255_255/0.22),transparent_45%)]" />
      </div>
      <div className="flex flex-col items-center px-5 pb-6 text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
        <Avatar name={fullName} src={user.avatarUrl} size="xl" className="-mt-12 ring-4 ring-white sm:-mt-10" />
        <div className="mt-3 flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:items-start">
          <h1 className="text-title text-ink">{fullName}</h1>
          {user.accountType && (
            <Badge tone="primary" icon={user.accountType === 'worker' ? BriefcaseBusiness : UserRoundSearch}>
              {ACCOUNT_TYPE_LABELS[user.accountType]}
            </Badge>
          )}
        </div>
      </div>
    </section>
  )
}
