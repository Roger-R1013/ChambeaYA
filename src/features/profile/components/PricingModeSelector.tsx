import { cn } from '@/lib/cn'
import type { PricingMode } from '@/types/profile'
import { PRICING_META, PRICING_OPTIONS } from '../pricing'

export interface PricingModeSelectorProps {
  name: string
  value: PricingMode | ''
  onChange: (value: PricingMode) => void
  error?: string
  disabled?: boolean
}

export function PricingModeSelector({ name, value, onChange, error, disabled }: PricingModeSelectorProps) {
  const errorId = `${name}-error`

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-label text-ink">
        Forma de cobro
        <span className="ml-0.5 text-danger-600" aria-hidden>
          *
        </span>
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PRICING_OPTIONS.map((option) => {
          const checked = value === option
          const meta = PRICING_META[option]
          return (
            <label
              key={option}
              className={cn(
                'flex flex-col gap-0.5 rounded-md border px-3.5 py-3 transition-colors duration-200',
                'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-500/15',
                checked ? 'border-primary-500 bg-primary-50/60' : error ? 'border-danger-500' : 'border-border bg-white',
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
              <span className={cn('text-label', checked ? 'text-primary-800' : 'text-ink')}>{meta.label}</span>
              <span className="text-caption text-ink-subtle">{meta.description}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className="text-caption text-danger-700 animate-fade-in">
          {error}
        </p>
      )}
    </fieldset>
  )
}
