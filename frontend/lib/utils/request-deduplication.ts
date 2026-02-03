/**
 * Request deduplication utilities
 *
 * Prevents duplicate concurrent API calls from rapid user interactions
 * (e.g., double-clicks, multiple component mounts).
 */

type PendingRequest<T> = Promise<T>

const pendingRequests = new Map<string, PendingRequest<unknown>>()

/**
 * Deduplicate identical concurrent requests.
 *
 * If a request with the same key is already in flight, returns the existing promise.
 * Otherwise, executes the fetcher and caches the promise until completion.
 *
 * @param key - Unique identifier for this request (use requestKey() to generate)
 * @param fetcher - Async function that performs the actual request
 * @returns The result of the request
 *
 * @example
 * ```typescript
 * const key = requestKey('GET', '/api/comments/123')
 * const result = await deduplicatedFetch(key, () => fetch('/api/comments/123'))
 * ```
 */
export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = pendingRequests.get(key)
  if (existing) {
    return existing as Promise<T>
  }

  const request = fetcher().finally(() => {
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, request)
  return request
}

/**
 * Generate a cache key from method, URL, and optional body.
 *
 * For GET requests, the key is method:url.
 * For requests with a body, a simple hash of the body is included.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Request URL
 * @param body - Optional request body (for POST/PUT)
 * @returns A unique key string
 */
export function requestKey(method: string, url: string, body?: string): string {
  if (body) {
    // Simple hash for body deduplication
    let hash = 0
    for (let i = 0; i < body.length; i++) {
      hash = ((hash << 5) - hash) + body.charCodeAt(i)
      hash |= 0 // Convert to 32-bit integer
    }
    return `${method}:${url}:${hash}`
  }
  return `${method}:${url}`
}

/**
 * Clear all pending requests.
 * Useful for testing or cleanup scenarios.
 */
export function clearPendingRequests(): void {
  pendingRequests.clear()
}

/**
 * Check if a request is currently in flight.
 *
 * @param key - The request key to check
 * @returns True if a request with this key is pending
 */
export function isRequestPending(key: string): boolean {
  return pendingRequests.has(key)
}
