import { Check, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AccountType } from '@/types/user'
import type { AccountTypeOption } from '../accountTypes'

export interface AccountTypeCardProps {
  option: AccountTypeOption
  name: string
  checked: boolean
  onSelect: (value: AccountType) => void
}

/** Radio-backed selectable card: native keyboard support (arrows/space) for free. */
export function AccountTypeCard({ option, name, checked, onSelect }: AccountTypeCardProps) {
  const { value, title, description, highlights, icon: Icon } = option
  const inputId = `account-type-${value}`

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group relative flex cursor-pointer gap-4 rounded-xl border-2 bg-white p-4 sm:p-5',
        'transition-[border-color,box-shadow,background-color] duration-200 ease-out',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500',
        checked
          ? 'border-primary-500 bg-primary-50/60 shadow-md'
          : 'border-border hover:border-primary-200 hover:shadow-sm',
      )}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />

      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 sm:size-14',
          checked ? 'bg-brand-gradient text-white' : 'bg-primary-50 text-primary-600 group-hover:bg-primary-100',
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-heading text-ink">{title}</span>
        <span className="mt-0.5 text-label font-normal text-ink-muted">{description}</span>
        <span className="mt-3 flex flex-col gap-1.5">
          {highlights.map((item) => (
            <span key={item} className="flex items-center gap-2 text-caption text-ink-muted">
              <Check className="size-3.5 text-primary-600" strokeWidth={2.5} aria-hidden />
              {item}
            </span>
          ))}
        </span>
      </span>

      <span
        className={cn(
          'absolute top-4 right-4 transition-[opacity,transform] duration-200',
          checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
        )}
        aria-hidden
      >
        <CircleCheck className="size-6 fill-primary-600 text-white" strokeWidth={2} />
      </span>
    </label>
  )
}
