import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error }

/**
 * Runs an async loader on mount (and when the loader identity changes).
 * Pass a stable loader (module-level function or useCallback).
 */
export function useAsyncData<T>(loader: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null, error: null })

  useEffect(() => {
    let isActive = true
    loader()
      .then((data) => {
        if (isActive) setState({ status: 'success', data, error: null })
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            status: 'error',
            data: null,
            error: error instanceof Error ? error : new Error('No se pudo cargar la información.'),
          })
        }
      })
    return () => {
      isActive = false
    }
  }, [loader])

  return state
}
