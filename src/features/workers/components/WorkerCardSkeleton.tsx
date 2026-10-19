import { Skeleton } from '@/components/ui/LoadingState'

export function WorkerCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/70 bg-white shadow-sm" aria-hidden>
      <div className="flex gap-3.5 p-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-1 h-3 w-3/4" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}
