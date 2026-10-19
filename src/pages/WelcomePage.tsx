import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { ProximityIllustration } from '@/components/brand/ProximityIllustration'
import { buttonStyles } from '@/components/ui/button.styles'
import { Logo } from '@/components/ui/Logo'
import { VALUE_PROPOSITIONS } from '@/config/marketing'
import { ROUTES } from '@/config/routes'

export function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row-reverse">
      <section
        className="relative overflow-hidden rounded-b-[2rem] bg-brand-gradient px-6 pt-6 pb-8 lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:rounded-none lg:p-12"
        aria-hidden
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgb(255_255_255/0.2),transparent_45%)]" />
        <Logo tone="white" size="sm" className="relative lg:hidden" />
        <ProximityIllustration className="relative mx-auto mt-2 max-w-[300px] sm:max-w-[360px] lg:mt-0 lg:max-w-[480px]" />
      </section>

      <main className="flex flex-1 flex-col px-6 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-10 lg:justify-center lg:px-16 xl:px-24">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:flex-none">
          <Logo size="md" className="mb-10 hidden lg:inline-flex" />

          <div className="animate-fade-up">
            <h1 className="text-display text-ink lg:text-[2.5rem] lg:leading-[3rem]">
              El profesional que necesitas, <span className="text-primary-600">cerca de ti.</span>
            </h1>
            <p className="mt-3 text-body text-ink-muted">
              Conecta con técnicos, oficios y profesionales disponibles en tu zona. Compara perfiles, acuerda el
              precio y recíbelos en tu domicilio.
            </p>
          </div>

          <ul className="mt-7 hidden flex-col gap-4 sm:flex">
            {VALUE_PROPOSITIONS.map(({ icon: Icon, title, description }, index) => (
              <li
                key={title}
                className="flex items-start gap-3 animate-fade-up"
                style={{ animationDelay: `${150 + index * 100}ms` }}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span>
                  <span className="block text-label font-semibold text-ink">{title}</span>
                  <span className="block text-caption text-ink-muted">{description}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-3 pt-8 lg:mt-10">
            <Link to={ROUTES.register} className={buttonStyles({ size: 'lg', fullWidth: true })}>
              Crear cuenta
              <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
            </Link>
            <Link to={ROUTES.login} className={buttonStyles({ variant: 'outline', size: 'lg', fullWidth: true })}>
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
