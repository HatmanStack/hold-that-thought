// @ts-check
/**
 * Rate limiting functionality
 * @module lib/rate-limit
 */
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient, TABLE_NAME } = require('./database')
const { keys } = require('./keys')
const { log } = require('./logger')

const RATE_LIMITS = {
  createComment: { requests: 20, windowSeconds: 60 },
  updateProfile: { requests: 10, windowSeconds: 60 },
  photoUpload: { requests: 5, windowSeconds: 300 },
  sendMessage: { requests: 30, windowSeconds: 60 },
}

/**
 * @param {string} userId
 * @param {string} action
 * @returns {Promise<{allowed: boolean, error?: string, retryAfter?: number}>}
 */
async function checkRateLimit(userId, action) {
  if (!TABLE_NAME) return { allowed: true }

  const limit = RATE_LIMITS[action]
  if (!limit) return { allowed: true }

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - limit.windowSeconds
  const key = keys.rateLimit(userId, action)

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    const item = result.Item

    if (item && item.count >= limit.requests && item.windowStart > windowStart) {
      const resetTime = item.windowStart + limit.windowSeconds
      return {
        allowed: false,
        error: `Rate limit exceeded. Try again in ${resetTime - now} seconds`,
        retryAfter: resetTime - now,
      }
    }

    const newCount = (item && item.windowStart > windowStart) ? item.count + 1 : 1
    const newWindowStart = (item && item.windowStart > windowStart) ? item.windowStart : now

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...key,
        entityType: 'RATE_LIMIT',
        count: newCount,
        windowStart: newWindowStart,
        ttl: now + limit.windowSeconds + 3600,
      },
    }))

    return { allowed: true }
  } catch (error) {
    log.error('rate_limit_check_failed', { userId, action, error: error.message })
    return { allowed: true }
  }
}

module.exports = {
  RATE_LIMITS,
  checkRateLimit,
}
