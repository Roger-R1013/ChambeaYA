import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getPasswordChecks, PASSWORD_MIN_LENGTH } from '@/utils/validators'

const RULES = [
  { key: 'minLength', label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` },
  { key: 'hasLetter', label: 'Al menos una letra' },
  { key: 'hasNumber', label: 'Al menos un número' },
] as const

export function PasswordRequirements({ id, password }: { id: string; password: string }) {
  const checks = getPasswordChecks(password)

  return (
    <ul id={id} className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Requisitos de la contraseña">
      {RULES.map(({ key, label }) => {
        const passed = checks[key]
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-1.5 text-caption transition-colors duration-200',
              passed ? 'text-success-700' : 'text-ink-subtle',
            )}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-full transition-colors duration-200',
                passed ? 'bg-success-500 text-white' : 'bg-surface-muted text-transparent',
              )}
              aria-hidden
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            {label}
            <span className="sr-only">{passed ? '(cumplido)' : '(pendiente)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
