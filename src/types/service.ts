/**
 * Lifecycle of a hired service. Not used in Stage 1; defined now so the
 * future tracking/requests features share a single source of truth.
 */
export const SERVICE_STATUS = {
  accepted: 'accepted',
  preparing: 'preparing',
  onTheWay: 'on_the_way',
  arriving: 'arriving',
  arrived: 'arrived',
  inProgress: 'in_progress',
  completed: 'completed',
} as const

export type ServiceStatus = (typeof SERVICE_STATUS)[keyof typeof SERVICE_STATUS]

/** Statuses during which the worker's live location is shared with the client. */
export const TRACKABLE_STATUSES: readonly ServiceStatus[] = [
  SERVICE_STATUS.onTheWay,
  SERVICE_STATUS.arriving,
]
