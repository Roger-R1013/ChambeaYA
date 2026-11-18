export const ROUTES = {
  splash: '/',
  welcome: '/welcome',
  login: '/login',
  register: '/register',
  accountType: '/onboarding/account-type',
  home: '/app',
  search: '/app/search',
  activity: '/app/activity',
  profile: '/app/profile',
  profileEdit: '/app/profile/edit',
  settings: '/app/settings',
  workerProfessional: '/app/profile/professional',
  workerVerification: '/app/profile/verification',
  workerDetail: '/app/workers/:workerId',
  admin: '/admin',
} as const

export function buildWorkerDetailPath(workerId: string): string {
  return ROUTES.workerDetail.replace(':workerId', encodeURIComponent(workerId))
}
