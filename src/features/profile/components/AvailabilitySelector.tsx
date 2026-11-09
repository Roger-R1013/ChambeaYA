import { cn } from '@/lib/cn'
import { AVAILABILITY_META } from '@/features/workers/availability'
import type { WorkerAvailability } from '@/types/worker'

const OPTIONS: WorkerAvailability[] = ['available', 'busy', 'offline']

const DOT: Record<WorkerAvailability, string> = {
  available: 'bg-success-500',
  busy: 'bg-accent-500',
  offline: 'bg-border-strong',
}

export interface AvailabilitySelectorProps {
  name: string
  value: WorkerAvailability
  onChange: (value: WorkerAvailability) => void
  disabled?: boolean
}

export function AvailabilitySelector({ name, value, onChange, disabled }: AvailabilitySelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-label text-ink">Disponibilidad</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const checked = value === option
          return (
            <label
              key={option}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-md border px-2 text-label transition-colors duration-200',
                'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-500/15',
                checked ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border bg-white text-ink-muted',
                disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-primary-300',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span className={cn('size-2 rounded-full', DOT[option])} aria-hidden />
              <span className="truncate">{AVAILABILITY_META[option].label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
