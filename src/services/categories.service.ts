import { APP_CONFIG } from '@/config/app'
import { MOCK_CATEGORIES } from '@/mocks/categories'
import type { Category } from '@/types/category'
import { delay } from '@/utils/async'

export interface CategoriesService {
  getAll(): Promise<Category[]>
}

const mockCategoriesService: CategoriesService = {
  async getAll() {
    await delay(APP_CONFIG.mockLatencyMs)
    return [...MOCK_CATEGORIES]
  },
}

export const categoriesService: CategoriesService = mockCategoriesService
