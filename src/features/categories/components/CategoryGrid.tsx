import { Skeleton } from '@/components/ui/LoadingState'
import type { Category } from '@/types/category'
import { CategoryCard } from './CategoryCard'

export interface CategoryGridProps {
  categories: Category[] | null
  isLoading?: boolean
  onSelect?: (category: Category) => void
}

const GRID = 'grid grid-cols-4 gap-x-2 gap-y-3 md:grid-cols-4 md:gap-3 lg:grid-cols-4 xl:gap-4'
const SKELETON_COUNT = 8

export function CategoryGrid({ categories, isLoading = false, onSelect }: CategoryGridProps) {
  if (isLoading || !categories) {
    return (
      <div className={GRID} aria-busy="true" aria-label="Cargando categorías">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-2.5 p-2 md:flex-row md:p-3.5">
            <Skeleton className="size-14 rounded-lg md:size-11" />
            <Skeleton className="h-3 w-14 md:w-24" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ul className={GRID}>
      {categories.map((category) => (
        <li key={category.id}>
          <CategoryCard category={category} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
