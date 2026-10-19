import { useAsyncData } from '@/hooks/useAsyncData'
import { categoriesService } from '@/services/categories.service'

const loadCategories = () => categoriesService.getAll()

export function useCategories() {
  return useAsyncData(loadCategories)
}
