import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error }

const LOADING = { status: 'loading', data: null, error: null } as const

/**
 * Runs an async loader on mount (and when the loader identity changes).
 * Pass a stable loader (module-level function or useCallback).
 */
export function useAsyncData<T>(loader: () => Promise<T>): AsyncState<T> {
  const [result, setResult] = useState<{ loader: () => Promise<T>; state: AsyncState<T> } | null>(null)

  useEffect(() => {
    let isActive = true
    loader()
      .then((data) => {
        if (isActive) setResult({ loader, state: { status: 'success', data, error: null } })
      })
      .catch((error: unknown) => {
        if (isActive) {
          setResult({
            loader,
            state: {
              status: 'error',
              data: null,
              error: error instanceof Error ? error : new Error('No se pudo cargar la información.'),
            },
          })
        }
      })
    return () => {
      isActive = false
    }
  }, [loader])

  return result?.loader === loader ? result.state : LOADING
}
