import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  withRetry,
  isTransientError,
  TimeoutError,
  MaxRetriesExceededError,
} from '../../backend/lambdas/letter-processor/src/lib/retry.ts'

describe('withRetry utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const promise = withRetry(fn, { maxAttempts: 3 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
    })

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0)
    // Wait for delay before second attempt
    await vi.advanceTimersByTimeAsync(100)
    // Second attempt fails
    await vi.advanceTimersByTimeAsync(0)
    // Wait for delay before third attempt
    await vi.advanceTimersByTimeAsync(200)

    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw MaxRetriesExceededError after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
    })

    // Run through all retries
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(MaxRetriesExceededError)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should call onRetry callback before each retry', async () => {
    const onRetry = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 100)
  })

  it('should respect isRetryable predicate', async () => {
    const nonRetryableError = new Error('non-retryable')
    const fn = vi.fn().mockRejectedValue(nonRetryableError)

    const promise = withRetry(fn, {
      maxAttempts: 3,
      isRetryable: (err) => err instanceof TimeoutError, // Only retry timeouts
    })

    await vi.runAllTimersAsync()

    // Should throw immediately without retrying
    await expect(promise).rejects.toThrow('non-retryable')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should use exponential backoff', async () => {
    const onRetry = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    // First retry delay: 100ms
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100)
    // Second retry delay: 200ms (100 * 2)
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 200)
  })

  it('should cap delay at maxDelayMs', async () => {
    const onRetry = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 10,
      maxDelayMs: 5000,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    // Second retry would be 10000ms but capped at 5000ms
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 5000)
  })
})

describe('TimeoutError', () => {
  it('should have correct name and message', () => {
    const error = new TimeoutError(30000)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toBe('Operation timed out after 30000ms')
  })
})

describe('MaxRetriesExceededError', () => {
  it('should include attempts and last error', () => {
    const lastError = new Error('final failure')
    const error = new MaxRetriesExceededError(3, lastError)

    expect(error.name).toBe('MaxRetriesExceededError')
    expect(error.attempts).toBe(3)
    expect(error.lastError).toBe(lastError)
    expect(error.message).toContain('Max retries (3) exceeded')
    expect(error.message).toContain('final failure')
  })

  it('should handle non-Error last error', () => {
    const error = new MaxRetriesExceededError(3, 'string error')
    expect(error.message).toContain('string error')
  })
})

describe('isTransientError', () => {
  it('should return true for TimeoutError', () => {
    expect(isTransientError(new TimeoutError(5000))).toBe(true)
  })

  it('should return true for network errors', () => {
    expect(isTransientError(new Error('network error'))).toBe(true)
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true)
    expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true)
    expect(isTransientError(new Error('socket hang up'))).toBe(true)
  })

  it('should return true for rate limiting', () => {
    expect(isTransientError(new Error('rate limit exceeded'))).toBe(true)
    expect(isTransientError(new Error('HTTP 429'))).toBe(true)
  })

  it('should return true for server errors', () => {
    expect(isTransientError(new Error('HTTP 500 Internal Server Error'))).toBe(true)
    expect(isTransientError(new Error('502 Bad Gateway'))).toBe(true)
    expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true)
    expect(isTransientError(new Error('504 Gateway Timeout'))).toBe(true)
  })

  it('should return false for other errors', () => {
    expect(isTransientError(new Error('Invalid input'))).toBe(false)
    expect(isTransientError(new Error('Not found'))).toBe(false)
    expect(isTransientError(new Error('Authentication failed'))).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(isTransientError('string')).toBe(false)
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})
