import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { CategoryGrid } from '@/features/categories/components/CategoryGrid'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { HomeHero } from '@/features/home/components/HomeHero'
import { FeaturedWorkers } from '@/features/workers/components/FeaturedWorkers'
import { buildWorkerDetailPath, ROUTES } from '@/config/routes'
import type { Category } from '@/types/category'
import type { NearbyWorker } from '@/types/worker'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const categories = useCategories()

  if (!user) return null

  const handleCategorySelect = (category: Category) =>
    navigate(`${ROUTES.search}?category=${encodeURIComponent(category.id)}`)

  const handleViewProfile = (worker: NearbyWorker) => navigate(buildWorkerDetailPath(worker.id))

  return (
    <div className="md:container-app">
      <HomeHero user={user} />

      <div className="container-app mt-7 flex flex-col gap-9 md:mt-9 md:px-0 md:gap-11">
        <Section
          id="nearby-services"
          title="Servicios cerca de ti"
          description="Elige una categoría para encontrar al profesional adecuado."
          action={
            <button
              type="button"
              onClick={() => navigate(ROUTES.search)}
              className="hidden shrink-0 items-center gap-1 rounded-sm text-label text-primary-700 hover:text-primary-800 sm:inline-flex"
            >
              Ver todo
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </button>
          }
        >
          <CategoryGrid
            categories={categories.data}
            isLoading={categories.status === 'loading'}
            onSelect={handleCategorySelect}
          />
        </Section>

        <Section
          id="featured-workers"
          title="Profesionales destacados"
          description="Mejor calificados y disponibles en tu zona."
        >
          <FeaturedWorkers onViewProfile={handleViewProfile} />
        </Section>
      </div>
    </div>
  )
}
