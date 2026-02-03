import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry,
  isTransientError,
  isNetworkError,
  MaxRetriesError,
} from '../../frontend/lib/utils/retry'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue({ success: true })

    const result = await withRetry(fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ success: true })
  })

  it('should retry on transient errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ success: true })

    const promise = withRetry(fn, { initialDelayMs: 100 })

    // First call fails
    await vi.advanceTimersByTimeAsync(0)

    // Wait for delay
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise

    expect(fn).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ success: true })
  })

  it('should throw MaxRetriesError after max attempts', async () => {
    vi.useRealTimers() // Use real timers for this test to avoid unhandled rejection

    const error = new TypeError('Failed to fetch')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })
    ).rejects.toThrow(MaxRetriesError)

    expect(fn).toHaveBeenCalledTimes(3)

    vi.useFakeTimers() // Restore fake timers
  })

  it('should not retry non-transient errors', async () => {
    const error = new Error('User not found')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withRetry(fn)).rejects.toThrow('User not found')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ success: true })

    const onRetry = vi.fn()

    const promise = withRetry(fn, {
      initialDelayMs: 100,
      backoffMultiplier: 2,
      onRetry,
    })

    await vi.advanceTimersByTimeAsync(0)  // Attempt 1 fails
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 100)

    await vi.advanceTimersByTimeAsync(100)  // Wait 100ms, attempt 2 fails
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), 200)

    await vi.advanceTimersByTimeAsync(200)  // Wait 200ms, attempt 3 succeeds

    const result = await promise
    expect(result).toEqual({ success: true })
  })

  it('should respect maxDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ success: true })

    const onRetry = vi.fn()

    const promise = withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 1000,
      maxDelayMs: 1500,
      backoffMultiplier: 2,
      onRetry,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(onRetry).toHaveBeenLastCalledWith(1, expect.any(Error), 1000)

    await vi.advanceTimersByTimeAsync(1000)
    // Would be 2000, but capped at 1500
    expect(onRetry).toHaveBeenLastCalledWith(2, expect.any(Error), 1500)

    await vi.advanceTimersByTimeAsync(1500)
    // Still capped at 1500
    expect(onRetry).toHaveBeenLastCalledWith(3, expect.any(Error), 1500)

    await vi.advanceTimersByTimeAsync(1500)

    await promise
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('should use custom isRetryable function', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Custom retryable error'))
      .mockResolvedValueOnce({ success: true })

    const customIsRetryable = (err: unknown) =>
      err instanceof Error && err.message.includes('Custom retryable')

    const promise = withRetry(fn, {
      isRetryable: customIsRetryable,
      initialDelayMs: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toEqual({ success: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('isTransientError', () => {
  it('should return true for fetch errors', () => {
    const error = new TypeError('Failed to fetch')
    expect(isTransientError(error)).toBe(true)
  })

  it('should return true for network errors', () => {
    expect(isTransientError(new Error('Network error'))).toBe(true)
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true)
    expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true)
  })

  it('should return true for timeout errors', () => {
    expect(isTransientError(new Error('Request timeout'))).toBe(true)
    expect(isTransientError(new Error('Timeout exceeded'))).toBe(true)
  })

  it('should return true for rate limit errors', () => {
    expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true)
    expect(isTransientError(new Error('HTTP 429'))).toBe(true)
  })

  it('should return true for server errors', () => {
    expect(isTransientError(new Error('HTTP 500'))).toBe(true)
    expect(isTransientError(new Error('HTTP 502'))).toBe(true)
    expect(isTransientError(new Error('HTTP 503'))).toBe(true)
    expect(isTransientError(new Error('HTTP 504'))).toBe(true)
  })

  it('should return false for client errors', () => {
    expect(isTransientError(new Error('User not found'))).toBe(false)
    expect(isTransientError(new Error('Invalid input'))).toBe(false)
    expect(isTransientError(new Error('Unauthorized'))).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(isTransientError('string error')).toBe(false)
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})

describe('isNetworkError', () => {
  it('should return true for fetch errors', () => {
    const error = new TypeError('Failed to fetch')
    expect(isNetworkError(error)).toBe(true)
  })

  it('should return true for connection errors', () => {
    expect(isNetworkError(new Error('ECONNRESET'))).toBe(true)
    expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true)
  })

  it('should return false for server errors', () => {
    expect(isNetworkError(new Error('HTTP 500'))).toBe(false)
    expect(isNetworkError(new Error('HTTP 502'))).toBe(false)
  })

  it('should return false for non-network errors', () => {
    expect(isNetworkError(new Error('User not found'))).toBe(false)
    expect(isNetworkError(new Error('Invalid input'))).toBe(false)
  })
})

describe('MaxRetriesError', () => {
  it('should contain attempts and last error', () => {
    const lastError = new Error('Connection failed')
    const error = new MaxRetriesError(3, lastError)

    expect(error.attempts).toBe(3)
    expect(error.lastError).toBe(lastError)
    expect(error.message).toContain('Max retries (3) exceeded')
    expect(error.message).toContain('Connection failed')
  })

  it('should handle non-Error last error', () => {
    const error = new MaxRetriesError(2, 'string error')

    expect(error.attempts).toBe(2)
    expect(error.lastError).toBe('string error')
    expect(error.message).toContain('string error')
  })
})
