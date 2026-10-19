import { MapPin } from 'lucide-react'
import { DEFAULT_LOCATION } from '@/config/app'
import { SearchBar } from '@/features/search/components/SearchBar'
import type { User } from '@/types/user'
import { getTimeGreeting } from '@/utils/date'

const SUBTITLE_BY_TYPE = {
  client: '¿Qué servicio necesitas hoy?',
  worker: 'Conoce a los profesionales que trabajan en tu zona.',
} as const

export function HomeHero({ user }: { user: User }) {
  const subtitle = SUBTITLE_BY_TYPE[user.accountType ?? 'client']

  return (
    <section
      aria-labelledby="home-greeting"
      className="relative overflow-hidden rounded-b-[1.75rem] bg-brand-gradient px-4 pt-6 pb-7 text-white sm:px-6 md:mt-6 md:rounded-2xl md:px-8 md:py-10 lg:px-10"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgb(255_255_255/0.22),transparent_45%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-16 -bottom-24 hidden size-80 rounded-full border border-white/15 md:block" aria-hidden />
      <div className="pointer-events-none absolute -right-4 -bottom-12 hidden size-52 rounded-full border border-white/15 md:block" aria-hidden />

      <div className="relative max-w-xl">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-medium">
          <MapPin className="size-3.5" strokeWidth={2} aria-hidden />
          {DEFAULT_LOCATION.label}
        </p>
        <h1 id="home-greeting" className="mt-4 text-title md:text-display">
          {getTimeGreeting()}, {user.firstName}
        </h1>
        <p className="mt-1 text-body text-white/85">{subtitle}</p>
        <SearchBar id="home-search" className="mt-5" />
      </div>
    </section>
  )
}
