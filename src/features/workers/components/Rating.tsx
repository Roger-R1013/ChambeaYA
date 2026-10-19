import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatRating, formatReviews } from '@/utils/format'

export interface RatingProps {
  value: number
  reviewsCount?: number
  className?: string
}

export function Rating({ value, reviewsCount, className }: RatingProps) {
  const reviewsText = reviewsCount === undefined ? '' : `, ${formatReviews(reviewsCount)}`

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-caption', className)}
      aria-label={`Calificación ${formatRating(value)} de 5${reviewsText}`}
    >
      <Star className="size-3.5 fill-accent-500 text-accent-500" strokeWidth={2} aria-hidden />
      <span className="font-semibold text-ink" aria-hidden>
        {formatRating(value)}
      </span>
      {reviewsCount !== undefined && (
        <span className="text-ink-subtle" aria-hidden>
          ({formatReviews(reviewsCount)})
        </span>
      )}
    </span>
  )
}
