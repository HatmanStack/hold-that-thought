/**
 * Rate limiting utilities
 */
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from './database'
import { keys } from './keys'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Default rate limits by action
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  comment: { maxRequests: 20, windowMs: 60000 }, // 20 per minute
  message: { maxRequests: 30, windowMs: 60000 }, // 30 per minute
  reaction: { maxRequests: 60, windowMs: 60000 }, // 60 per minute
  upload: { maxRequests: 10, windowMs: 300000 }, // 10 per 5 minutes
  default: { maxRequests: 100, windowMs: 60000 }, // 100 per minute
}

/**
 * Check if a user action is rate limited
 */
export async function checkRateLimit(
  userId: string,
  action: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action] || RATE_LIMITS.default
  const key = keys.rateLimit(userId, action)
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Get current rate limit record
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: key,
      })
    )

    const record = result.Item

    // If no record or window expired, start fresh
    if (!record || record.windowStart < windowStart) {
      const ttl = Math.floor((now + config.windowMs) / 1000)

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...key,
            userId,
            action,
            count: 1,
            windowStart: now,
            ttl,
            entityType: 'RATE_LIMIT',
          },
        })
      )

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowMs,
      }
    }

    // Check if over limit
    const count = (record.count as number) || 0
    if (count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: (record.windowStart as number) + config.windowMs,
      }
    }

    // Increment counter
    const ttl = Math.floor((now + config.windowMs) / 1000)
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...record,
          count: count + 1,
          ttl,
        },
      })
    )

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetAt: (record.windowStart as number) + config.windowMs,
    }
  } catch (error) {
    // On error, allow the request (fail open for availability)
    console.error('Rate limit check failed:', error)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    }
  }
}

/**
 * Calculate seconds until rate limit resets
 */
export function getRetryAfter(resetAt: number): number {
  const seconds = Math.ceil((resetAt - Date.now()) / 1000)
  return Math.max(1, seconds)
}
