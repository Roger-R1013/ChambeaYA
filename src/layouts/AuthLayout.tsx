import { Outlet } from 'react-router'
import { ProximityIllustration } from '@/components/brand/ProximityIllustration'
import { Logo } from '@/components/ui/Logo'
import { VALUE_PROPOSITIONS } from '@/config/marketing'

/** Split layout for auth/onboarding: brand panel on desktop, focused form on mobile. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col overflow-hidden bg-brand-gradient p-10 text-white lg:flex xl:p-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(255_255_255/0.18),transparent_40%)]"
          aria-hidden
        />
        <Logo tone="white" size="md" className="relative" />

        <div className="relative my-auto flex flex-col gap-10 py-10">
          <ProximityIllustration className="mx-auto max-w-[400px]" />
          <div>
            <p className="text-title text-white">Todo lo que necesitas, a un paso de tu casa.</p>
            <ul className="mt-6 flex flex-col gap-4">
              {VALUE_PROPOSITIONS.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15">
                    <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-label font-semibold">{title}</span>
                    <span className="block text-caption text-white/80">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4 pb-10 sm:px-6 sm:pt-8 lg:justify-center lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
