import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error }

const LOADING = { status: 'loading', data: null, error: null } as const

type Loader<T> = (signal: AbortSignal) => Promise<T>

/**
 * Runs an async loader on mount (and when the loader identity changes).
 * Pass a stable loader (module-level function or useCallback).
 */
export function useAsyncData<T>(
  loader: Loader<T>,
  { delayMs = 0, refreshKey = 0 }: { delayMs?: number; refreshKey?: number } = {},
): AsyncState<T> {
  const [result, setResult] = useState<{ loader: Loader<T>; refreshKey: number; state: AsyncState<T> } | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      let state: AsyncState<T>
      try {
        const data = await loader(controller.signal)
        state = { status: 'success', data, error: null }
      } catch (error) {
        state = {
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error('No se pudo cargar la información.'),
        }
      }
      if (!controller.signal.aborted) setResult({ loader, refreshKey, state })
    }

    const timer = delayMs > 0 ? window.setTimeout(load, delayMs) : undefined
    if (timer === undefined) void load()
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      controller.abort()
    }
  }, [loader, delayMs, refreshKey])

  return result?.loader === loader && result.refreshKey === refreshKey ? result.state : LOADING
}
