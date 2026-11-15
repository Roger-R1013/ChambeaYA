import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type { Category } from '@/types/category'

/* --------------------------------------------------------------------------
   Category catalogue from `public.categories` (readable by everyone, only
   active rows - see migration 0002). Single source for the whole app.
   -------------------------------------------------------------------------- */

export interface CategoriesService {
  getAll(): Promise<Category[]>
}

export const categoriesService: CategoriesService = {
  async getAll() {
    const client = requireSupabase()
    const { data, error } = await client
      .from('categories')
      .select('id, name, description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) throw toDataError(error, 'No se pudieron cargar las categorías.')
    return (data ?? []) as Category[]
  },
}
