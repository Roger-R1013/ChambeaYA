import { createElement } from 'react'
import { cn } from '@/lib/cn'
import type { Category } from '@/types/category'
import { getCategoryIcon } from '../categoryIcons'

export interface CategoryCardProps {
  category: Category
  onSelect?: (category: Category) => void
  className?: string
}

export function CategoryCard({ category, onSelect, className }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(category)}
      className={cn(
        'group flex w-full flex-col items-center gap-2.5 rounded-lg p-2 text-center',
        'transition-colors duration-200 hover:bg-white',
        'md:flex-row md:items-center md:gap-3 md:border md:border-border/70 md:bg-white md:p-3.5 md:text-left md:shadow-xs md:hover:border-primary-200 md:hover:shadow-sm',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-xs ring-1 ring-border/70',
          'transition-[background-color,color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:bg-primary-600 group-hover:text-white',
          'md:size-11 md:bg-primary-50 md:shadow-none md:ring-0 md:group-hover:translate-y-0',
        )}
      >
        {createElement(getCategoryIcon(category.id), {
          className: 'size-6 md:size-5',
          strokeWidth: 1.75,
          'aria-hidden': true,
        })}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-caption font-semibold text-ink md:text-label">{category.name}</span>
        <span className="hidden truncate text-caption text-ink-subtle md:block">{category.description}</span>
      </span>
    </button>
  )
}
