/**
 * Retry utility with exponential backoff and timeout support
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay between retries in milliseconds (default: 10000) */
  maxDelayMs?: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number
  /** Timeout for each attempt in milliseconds (default: 30000) */
  timeoutMs?: number
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export class MaxRetriesExceededError extends Error {
  public readonly attempts: number
  public readonly lastError: unknown

  constructor(attempts: number, lastError: unknown) {
    const message =
      lastError instanceof Error ? lastError.message : String(lastError)
    super(`Max retries (${attempts}) exceeded. Last error: ${message}`)
    this.name = 'MaxRetriesExceededError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a promise that rejects after a timeout
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(ms)), ms)
  })
}

/**
 * Execute an async function with retry and timeout support
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws TimeoutError if the operation times out
 * @throws MaxRetriesExceededError if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    timeoutMs = 30000,
    isRetryable = () => true,
    onRetry,
  } = options

  let lastError: unknown
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Race the operation against a timeout
      const result = await Promise.race([fn(), createTimeout(timeoutMs)])
      return result
    } catch (error) {
      lastError = error

      // If it's the last attempt, throw
      if (attempt === maxAttempts) {
        throw new MaxRetriesExceededError(attempt, lastError)
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
  throw new MaxRetriesExceededError(maxAttempts, lastError)
}

/**
 * Determine if an error is likely transient and worth retrying
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Network/connection errors
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('timeout') ||
      message.includes('socket hang up')
    ) {
      return true
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return true
    }

    // Server errors
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      name.includes('serviceunavailable')
    ) {
      return true
    }
  }

  return false
}
