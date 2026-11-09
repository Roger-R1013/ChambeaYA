import { useCallback, useState } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { verificationService } from '@/services/verification.service'

/** Loader + `reload()` helper shared by the private-document lists. */
function useReloadable<T>(load: () => Promise<T>, key: string) {
  const [version, setVersion] = useState(0)
  // `version` is part of the loader identity so useAsyncData re-runs on reload().
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(() => load(), [key, version])
  const state = useAsyncData(loader)
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { ...state, reload }
}

/** The signed-in worker's certificates (`public.worker_certificates`). */
export function useCertificates(userId: string) {
  return useReloadable(() => verificationService.listCertificates(userId), userId)
}

/** The signed-in worker's identity document pointers (`public.identity_documents`). */
export function useIdentityDocuments(userId: string) {
  return useReloadable(() => verificationService.listIdentityDocuments(userId), userId)
}
