/**
 * Frontend retry utility with exponential backoff
 *
 * Provides retry logic for API calls to handle transient network errors.
 * Matches backend retry sophistication for consistent error handling.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay between retries in milliseconds (default: 5000) */
  maxDelayMs?: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number
  /** Function to determine if error is retryable (default: isTransientError) */
  isRetryable?: (error: unknown) => boolean
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

/**
 * Error thrown when all retry attempts are exhausted
 */
export class MaxRetriesError extends Error {
  public readonly attempts: number
  public readonly lastError: unknown

  constructor(attempts: number, lastError: unknown) {
    const message
      = lastError instanceof Error ? lastError.message : String(lastError)
    super(`Max retries (${attempts}) exceeded: ${message}`)
    this.name = 'MaxRetriesError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute an async function with retry support and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The original error if not retryable
 * @throws MaxRetriesError if all retries are exhausted
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(() => fetch('/api/data'))
 *
 * // With custom options
 * const result = await withRetry(
 *   () => createComment(data),
 *   {
 *     maxAttempts: 2,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error)
 *   }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    isRetryable = isTransientError,
    onRetry,
  } = options

  let lastError: unknown
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error

      // If it's the last attempt, throw MaxRetriesError
      if (attempt === maxAttempts) {
        throw new MaxRetriesError(attempt, lastError)
      }

      // Check if the error is retryable
      if (!isRetryable(error)) {
        throw error
      }

      // Callback before retry
      if (onRetry) {
        onRetry(attempt, error, delay)
      }

      // Wait before next attempt
      await sleep(delay)

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelayMs)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new MaxRetriesError(maxAttempts, lastError)
}

/**
 * Determine if an error is likely transient and worth retrying.
 *
 * Identifies:
 * - Network errors (failed to fetch, connection refused, etc.)
 * - Rate limiting (429)
 * - Server errors (500-504)
 * - Timeout errors
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Network/connection errors
    if (
      (name === 'typeerror' && message.includes('failed to fetch'))
      || message.includes('network')
      || message.includes('econnreset')
      || message.includes('econnrefused')
      || message.includes('timeout')
      || message.includes('socket hang up')
      || message.includes('aborted')
    ) {
      return true
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return true
    }

    // Server errors
    if (
      message.includes('500')
      || message.includes('502')
      || message.includes('503')
      || message.includes('504')
      || name.includes('serviceunavailable')
    ) {
      return true
    }
  }

  return false
}

/**
 * Retry only on network errors (not server errors)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    return (
      (name === 'typeerror' && message.includes('failed to fetch'))
      || message.includes('network')
      || message.includes('econnreset')
      || message.includes('econnrefused')
      || message.includes('timeout')
    )
  }
  return false
}
