/**
 * Cancellable fetch utilities
 *
 * Provides AbortController wrappers for request cancellation,
 * useful for cleaning up in-flight requests on component unmount.
 */

/**
 * Result of a cancellable fetch operation
 */
export interface CancellableFetch<T> {
  /** The promise that resolves with the response */
  promise: Promise<T>
  /** Function to abort the request */
  abort: () => void
  /** The AbortController signal (for advanced use cases) */
  signal: AbortSignal
}

/**
 * Create a cancellable fetch request.
 *
 * Wraps the standard fetch with an AbortController for request cancellation.
 * Useful for long-running requests that should be cancelled on component unmount.
 *
 * @param url - The URL to fetch
 * @param options - Standard RequestInit options (signal will be overwritten)
 * @returns Object with promise, abort function, and signal
 *
 * @example
 * ```typescript
 * const { promise, abort } = cancellableFetch<Comment[]>('/api/comments')
 *
 * // In cleanup:
 * abort()
 *
 * // Handle the result:
 * try {
 *   const data = await promise
 * } catch (err) {
 *   if (err.name === 'AbortError') return // Request was cancelled
 *   throw err
 * }
 * ```
 */
export function cancellableFetch<T>(
  url: string,
  options: RequestInit = {},
): CancellableFetch<T> {
  const controller = new AbortController()

  const promise = fetch(url, {
    ...options,
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = (errorData as { error?: string }).error || `HTTP ${response.status}`
      throw new Error(errorMessage)
    }
    return response.json() as Promise<T>
  })

  return {
    promise,
    abort: () => controller.abort(),
    signal: controller.signal,
  }
}

/**
 * Factory for creating abortable requests with automatic cleanup.
 *
 * Useful in Svelte components where you want to cancel the previous request
 * when starting a new one, and clean up on component destroy.
 *
 * @returns Object with fetch function and cleanup function
 *
 * @example
 * ```svelte
 * <script>
 *   import { createAbortableRequest } from '$lib/utils/cancellable-fetch'
 *   import { onDestroy } from 'svelte'
 *
 *   const { fetch: abortableFetch, cleanup } = createAbortableRequest()
 *   onDestroy(cleanup)
 *
 *   async function loadData() {
 *     const { promise } = abortableFetch('/api/data', { headers: {...} })
 *     try {
 *       data = await promise
 *     } catch (err) {
 *       if (isAbortError(err)) return
 *       error = err.message
 *     }
 *   }
 * </script>
 * ```
 */
export function createAbortableRequest() {
  let currentAbort: (() => void) | null = null

  return {
    /**
     * Make a fetch request, aborting any previous request.
     */
    fetch: <T>(url: string, options?: RequestInit): CancellableFetch<T> => {
      // Abort previous request if any
      currentAbort?.()

      const result = cancellableFetch<T>(url, options)
      currentAbort = result.abort
      return result
    },

    /**
     * Abort the current request (if any) and prevent future requests.
     * Call this in onDestroy.
     */
    cleanup: () => {
      currentAbort?.()
      currentAbort = null
    },

    /**
     * Abort the current request but allow future requests.
     */
    abort: () => {
      currentAbort?.()
      currentAbort = null
    },
  }
}

/**
 * Check if an error is an AbortError (request was cancelled).
 *
 * @param error - The error to check
 * @returns True if the error is an AbortError
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * Fetch with automatic abort on timeout.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns The response data
 * @throws Error if request times out
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = (errorData as { error?: string }).error || `HTTP ${response.status}`
      throw new Error(errorMessage)
    }

    return await response.json() as T
  }
  catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
  finally {
    clearTimeout(timeoutId)
  }
}
