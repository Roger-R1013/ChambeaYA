export const ROUTES = {
  splash: '/',
  welcome: '/welcome',
  login: '/login',
  register: '/register',
  accountType: '/onboarding/account-type',
  home: '/app',
  search: '/app/search',
  activity: '/app/activity',
  serviceRequest: '/app/activity/:requestId',
  serviceJourney: '/app/activity/:requestId/tracking',
  profile: '/app/profile',
  profileEdit: '/app/profile/edit',
  settings: '/app/settings',
  workerProfessional: '/app/profile/professional',
  workerVerification: '/app/profile/verification',
  workerDetail: '/app/workers/:workerId',
  requestWorker: '/app/workers/:workerId/request',
  admin: '/admin',
} as const

export function buildWorkerDetailPath(workerId: string): string {
  return ROUTES.workerDetail.replace(':workerId', encodeURIComponent(workerId))
}

export function buildRequestWorkerPath(workerId: string): string {
  return ROUTES.requestWorker.replace(':workerId', encodeURIComponent(workerId))
}

export function buildServiceRequestPath(requestId: string): string {
  return ROUTES.serviceRequest.replace(':requestId', encodeURIComponent(requestId))
}

export function buildServiceJourneyPath(requestId: string): string {
  return ROUTES.serviceJourney.replace(':requestId', encodeURIComponent(requestId))
}
