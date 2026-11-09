import { Briefcase, Check } from 'lucide-react'
import { CATEGORY_ICONS } from '@/features/categories/categoryIcons'
import { cn } from '@/lib/cn'
import type { CategoryId } from '@/types/category'
import type { CatalogCategory } from '@/types/profile'

export interface CategorySelectorProps {
  id: string
  categories: CatalogCategory[]
  selected: string[]
  max: number
  onChange: (ids: string[]) => void
  error?: string
  disabled?: boolean
}

export function CategorySelector({ id, categories, selected, max, onChange, error, disabled }: CategorySelectorProps) {
  const atLimit = selected.length >= max
  const errorId = `${id}-error`
  const counterId = `${id}-counter`

  function toggle(categoryId: string) {
    if (selected.includes(categoryId)) {
      onChange(selected.filter((item) => item !== categoryId))
    } else if (!atLimit) {
      onChange([...selected, categoryId])
    }
  }

  return (
    <fieldset className="flex flex-col gap-2.5" aria-describedby={[counterId, error ? errorId : null].filter(Boolean).join(' ')}>
      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-label text-ink">Categorías de servicio</legend>
        <span id={counterId} className={cn('text-caption', atLimit ? 'font-semibold text-primary-700' : 'text-ink-subtle')}>
          {selected.length} de {max}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((category) => {
          const checked = selected.includes(category.id)
          const blocked = !checked && atLimit
          const Icon = CATEGORY_ICONS[category.id as CategoryId] ?? Briefcase
          const inputId = `${id}-${category.id}`

          return (
            <li key={category.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  'flex items-center gap-3 rounded-md border bg-white px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200',
                  'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-500/15',
                  checked ? 'border-primary-500 bg-primary-50/60' : 'border-border',
                  blocked || disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-primary-300',
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={blocked || disabled}
                  onChange={() => toggle(category.id)}
                />
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
                    checked ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600',
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label text-ink">{category.name}</span>
                  {category.description && (
                    <span className="truncate text-caption text-ink-subtle">{category.description}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150',
                    checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-border-strong bg-white',
                  )}
                  aria-hidden
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {error ? (
        <p id={errorId} className="text-caption text-danger-700 animate-fade-in">
          {error}
        </p>
      ) : (
        <p className="text-caption text-ink-subtle">Elige entre 1 y {max} categorías en las que ofreces servicios.</p>
      )}
    </fieldset>
  )
}
