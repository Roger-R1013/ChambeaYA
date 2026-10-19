import carlosPhoto from '@/assets/workers/carlos.jpg'
import luciaPhoto from '@/assets/workers/lucia.jpg'
import anaPhoto from '@/assets/workers/ana.jpg'
import jorgePhoto from '@/assets/workers/jorge.jpg'
import { cn } from '@/lib/cn'
import { LogoMark } from '@/components/ui/Logo'

type IllustrationTone = 'onBrand' | 'onLight'

interface Bubble {
  src: string
  label: string
  meta: string
  /** Position as percentage of the container. */
  top: string
  left: string
  delay: string
}

const BUBBLES: readonly Bubble[] = [
  { src: carlosPhoto, label: 'Electricista', meta: '1.4 km', top: '14%', left: '62%', delay: '150ms' },
  { src: luciaPhoto, label: 'Tecnología', meta: '0.7 km', top: '30%', left: '4%', delay: '300ms' },
  { src: anaPhoto, label: 'Limpieza', meta: '1.2 km', top: '68%', left: '58%', delay: '450ms' },
  { src: jorgePhoto, label: 'Plomería', meta: '2.1 km', top: '76%', left: '8%', delay: '600ms' },
]

const RINGS = ['size-[38%]', 'size-[64%]', 'size-[90%]'] as const

/**
 * Decorative proximity visual: the brand pin surrounded by nearby workers.
 * Purely presentational (aria-hidden); communicates the product concept.
 */
export function ProximityIllustration({ tone = 'onBrand', className }: { tone?: IllustrationTone; className?: string }) {
  const onBrand = tone === 'onBrand'

  return (
    <div className={cn('relative aspect-square w-full', className)} aria-hidden>
      {RINGS.map((size) => (
        <span
          key={size}
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border',
            size,
            onBrand ? 'border-white/20 bg-white/[0.04]' : 'border-primary-200/70 bg-primary-50/40',
          )}
        />
      ))}

      <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <span
          className={cn(
            'absolute size-28 rounded-full animate-pulse-ring',
            onBrand ? 'bg-white/30' : 'bg-primary-300/40',
          )}
        />
        <span
          className={cn(
            'relative flex size-20 items-center justify-center rounded-2xl shadow-lg',
            onBrand ? 'bg-white' : 'bg-white ring-1 ring-border/70',
          )}
        >
          <LogoMark className="h-12 w-auto" />
        </span>
      </span>

      {BUBBLES.map((bubble) => (
        <div
          key={bubble.label}
          className="absolute flex items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-1.5 shadow-lg animate-fade-up"
          style={{ top: bubble.top, left: bubble.left, animationDelay: bubble.delay }}
        >
          <img src={bubble.src} alt="" className="size-9 rounded-full object-cover" />
          <span className="flex flex-col leading-tight">
            <span className="text-caption font-semibold text-ink">{bubble.label}</span>
            <span className="flex items-center gap-1 text-micro font-medium text-ink-subtle">
              <span className="size-1.5 rounded-full bg-success-500" />
              {bubble.meta}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
