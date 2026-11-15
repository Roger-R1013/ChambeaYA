/** Ids of the seeded catalogue (migration 0003). Used only to pick icons. */
export type CategoryId =
  | 'electricity'
  | 'plumbing'
  | 'technology'
  | 'cleaning'
  | 'mechanics'
  | 'construction'
  | 'carpentry'
  | 'painting'

/** Category as stored in `public.categories` (new ids may be added by admins). */
export interface Category {
  id: string
  name: string
  description: string
}
