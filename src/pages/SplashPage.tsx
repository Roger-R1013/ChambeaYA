import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { LogoMark } from '@/components/ui/Logo'
import { APP_CONFIG } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { resolvePostAuthPath } from '@/features/auth/utils/redirect'

export function SplashPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(user ? resolvePostAuthPath(user) : ROUTES.welcome, { replace: true })
    }, APP_CONFIG.splashDurationMs)
    return () => window.clearTimeout(timer)
  }, [navigate, user])

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-brand-gradient px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgb(255_255_255/0.22),transparent_55%)]"
        aria-hidden
      />

      <div className="relative flex flex-col items-center animate-scale-in">
        <span className="relative flex items-center justify-center">
          <span className="absolute size-36 rounded-full bg-white/25 animate-pulse-ring" aria-hidden />
          <span className="relative flex size-24 items-center justify-center rounded-[1.75rem] bg-white shadow-lg">
            <LogoMark className="h-14 w-auto" />
          </span>
        </span>
        <h1 className="mt-7 text-[2.25rem] leading-none font-extrabold tracking-tight">
          Chambea<span className="text-secondary-100">YA!</span>
        </h1>
        <p className="mt-3 text-body font-medium text-white/85 animate-fade-in [animation-delay:300ms]">
          {APP_CONFIG.tagline}
        </p>
      </div>

      <div className="absolute bottom-[calc(3rem+env(safe-area-inset-bottom))] w-32" role="status" aria-label="Cargando ChambeaYA!">
        <div className="h-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full origin-left rounded-full bg-white animate-progress" />
        </div>
      </div>
    </main>
  )
}
