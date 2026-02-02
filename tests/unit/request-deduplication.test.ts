import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  deduplicatedFetch,
  requestKey,
  clearPendingRequests,
  isRequestPending,
} from '../../frontend/lib/utils/request-deduplication'

describe('requestKey', () => {
  it('should create key from method and URL', () => {
    const key = requestKey('GET', '/api/comments/123')
    expect(key).toBe('GET:/api/comments/123')
  })

  it('should include body hash for requests with body', () => {
    const key1 = requestKey('POST', '/api/comments', '{"content":"hello"}')
    const key2 = requestKey('POST', '/api/comments', '{"content":"hello"}')
    const key3 = requestKey('POST', '/api/comments', '{"content":"different"}')

    expect(key1).toBe(key2) // Same body = same key
    expect(key1).not.toBe(key3) // Different body = different key
  })

  it('should handle empty body', () => {
    const key = requestKey('GET', '/api/users')
    expect(key).toBe('GET:/api/users')
  })
})

describe('deduplicatedFetch', () => {
  beforeEach(() => {
    clearPendingRequests()
  })

  it('should call fetcher and return result', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
    const key = requestKey('GET', '/api/test')

    const result = await deduplicatedFetch(key, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: 'test' })
  })

  it('should deduplicate concurrent identical requests', async () => {
    let resolvePromise: (value: unknown) => void
    const promise = new Promise(resolve => {
      resolvePromise = resolve
    })

    const fetcher = vi.fn().mockReturnValue(promise)
    const key = requestKey('GET', '/api/test')

    // Start two concurrent requests with the same key
    const request1 = deduplicatedFetch(key, fetcher)
    const request2 = deduplicatedFetch(key, fetcher)

    // Fetcher should only be called once (the key behavior we're testing)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Resolve the promise
    resolvePromise!({ data: 'result' })

    // Both requests should resolve to the same result
    const [result1, result2] = await Promise.all([request1, request2])
    expect(result1).toEqual({ data: 'result' })
    expect(result2).toEqual({ data: 'result' })
  })

  it('should allow new request after previous completes', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ call: 1 })
      .mockResolvedValueOnce({ call: 2 })
    const key = requestKey('GET', '/api/test')

    // First request
    const result1 = await deduplicatedFetch(key, fetcher)
    expect(result1).toEqual({ call: 1 })

    // Second request after first completes
    const result2 = await deduplicatedFetch(key, fetcher)
    expect(result2).toEqual({ call: 2 })

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('should handle errors and clear pending request', async () => {
    const error = new Error('Network error')
    const fetcher = vi.fn().mockRejectedValue(error)
    const key = requestKey('GET', '/api/test')

    await expect(deduplicatedFetch(key, fetcher)).rejects.toThrow('Network error')

    // Request should be cleared, allowing retry
    expect(isRequestPending(key)).toBe(false)

    // New request should be allowed
    fetcher.mockResolvedValueOnce({ success: true })
    const result = await deduplicatedFetch(key, fetcher)
    expect(result).toEqual({ success: true })
  })

  it('should handle different keys independently', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ endpoint: 'comments' })
    const fetcher2 = vi.fn().mockResolvedValue({ endpoint: 'users' })

    const key1 = requestKey('GET', '/api/comments')
    const key2 = requestKey('GET', '/api/users')

    const [result1, result2] = await Promise.all([
      deduplicatedFetch(key1, fetcher1),
      deduplicatedFetch(key2, fetcher2),
    ])

    expect(fetcher1).toHaveBeenCalledTimes(1)
    expect(fetcher2).toHaveBeenCalledTimes(1)
    expect(result1).toEqual({ endpoint: 'comments' })
    expect(result2).toEqual({ endpoint: 'users' })
  })
})

describe('isRequestPending', () => {
  beforeEach(() => {
    clearPendingRequests()
  })

  it('should return false for unknown key', () => {
    expect(isRequestPending('unknown:key')).toBe(false)
  })

  it('should return true for pending request', async () => {
    let resolvePromise: (value: unknown) => void
    const promise = new Promise(resolve => {
      resolvePromise = resolve
    })

    const key = requestKey('GET', '/api/test')
    deduplicatedFetch(key, () => promise)

    expect(isRequestPending(key)).toBe(true)

    resolvePromise!({ done: true })
    await promise

    // After resolution, should no longer be pending
    // Small delay to allow finally() to run
    await new Promise(r => setTimeout(r, 0))
    expect(isRequestPending(key)).toBe(false)
  })
})

describe('clearPendingRequests', () => {
  it('should clear all pending requests', async () => {
    const key1 = requestKey('GET', '/api/1')
    const key2 = requestKey('GET', '/api/2')

    // Create pending requests that never resolve
    deduplicatedFetch(key1, () => new Promise(() => {}))
    deduplicatedFetch(key2, () => new Promise(() => {}))

    expect(isRequestPending(key1)).toBe(true)
    expect(isRequestPending(key2)).toBe(true)

    clearPendingRequests()

    expect(isRequestPending(key1)).toBe(false)
    expect(isRequestPending(key2)).toBe(false)
  })
})
