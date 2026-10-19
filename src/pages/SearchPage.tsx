import { useSearchParams } from 'react-router'
import { SearchCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { CategoryGrid } from '@/features/categories/components/CategoryGrid'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { SearchBar } from '@/features/search/components/SearchBar'
import type { Category } from '@/types/category'

/** Provisional: advanced search arrives in a later stage. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categories = useCategories()
  const query = searchParams.get('q') ?? ''
  const categoryId = searchParams.get('category')
  const selectedCategory = categories.data?.find((item) => item.id === categoryId)
  const term = selectedCategory?.name ?? query

  const handleCategorySelect = (category: Category) => setSearchParams({ category: category.id })

  return (
    <div className="container-app flex flex-col gap-7 pt-6 md:pt-8">
      <PageHeader title="Buscar" description="Encuentra servicios y profesionales en tu zona." />

      {/* key resets the input when the URL query changes */}
      <SearchBar key={query} id="search-page-input" defaultValue={query} className="md:max-w-xl" />

      {term && (
        <Card padding="none">
          <EmptyState
            icon={SearchCheck}
            title={`Resultados para "${term}"`}
            description="La búsqueda de profesionales se habilitará en la próxima etapa, cuando conectemos los datos reales."
          />
        </Card>
      )}

      <Section id="search-categories" title="Explorar por categoría">
        <CategoryGrid
          categories={categories.data}
          isLoading={categories.status === 'loading'}
          onSelect={handleCategorySelect}
        />
      </Section>
    </div>
  )
}
