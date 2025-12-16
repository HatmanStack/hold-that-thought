// @ts-check
/**
 * Input validation helpers
 * @module lib/validation
 */
const sanitizeHtml = require('sanitize-html')

/**
 * @param {string} userId
 * @returns {{valid: boolean, error?: string}}
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required' }
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
    return { valid: false, error: 'Invalid user ID format' }
  }

  if (userId.length > 100) {
    return { valid: false, error: 'User ID too long' }
  }

  if (!uuidRegex.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' }
  }

  return { valid: true }
}

/**
 * @param {string|number} limit
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateLimit(limit) {
  const numLimit = parseInt(limit, 10)

  if (isNaN(numLimit) || numLimit < 1) {
    return { valid: false, error: 'Limit must be a positive number' }
  }

  if (numLimit > 100) {
    return { valid: false, error: 'Limit cannot exceed 100' }
  }

  return { valid: true, value: numLimit }
}

/**
 * @param {string} text
 * @param {number} [maxLength=10000]
 * @returns {string}
 */
function sanitizeText(text, maxLength = 10000) {
  if (!text) return ''
  const cleaned = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()
  return cleaned.slice(0, maxLength)
}

module.exports = {
  validateUserId,
  validateLimit,
  sanitizeText,
}
