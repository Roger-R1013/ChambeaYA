export type CategoryId =
  | 'electricity'
  | 'plumbing'
  | 'technology'
  | 'cleaning'
  | 'mechanics'
  | 'construction'
  | 'carpentry'
  | 'painting'

export interface Category {
  id: CategoryId
  name: string
  description: string
  workersCount: number
}
