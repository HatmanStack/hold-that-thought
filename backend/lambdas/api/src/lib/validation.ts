/**
 * Input validation utilities
 */
import sanitizeHtml from 'sanitize-html'

// UUID v4 regex pattern
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate a user ID (Cognito sub)
 */
export function validateUserId(userId: string | undefined | null): boolean {
  if (!userId || typeof userId !== 'string') return false
  // Check for path traversal attempts
  if (userId.includes('..') || userId.includes('/') || userId.includes('\\'))
    return false
  // Must be a valid UUID
  return UUID_PATTERN.test(userId)
}

/**
 * Validate pagination limit
 */
export function validateLimit(
  limit: string | undefined | null,
  defaultLimit = 50,
  maxLimit = 100
): number {
  if (!limit) return defaultLimit
  const parsed = parseInt(limit, 10)
  if (isNaN(parsed) || parsed < 1) return defaultLimit
  return Math.min(parsed, maxLimit)
}

/**
 * Validate a comment ID format (timestamp#uuid)
 */
export function validateCommentId(
  commentId: string | undefined | null
): boolean {
  if (!commentId || typeof commentId !== 'string') return false
  // Format: ISO timestamp # UUID
  const parts = commentId.split('#')
  if (parts.length !== 2) return false
  // Check timestamp is valid ISO date
  const timestamp = Date.parse(parts[0])
  if (isNaN(timestamp)) return false
  // Check UUID
  return UUID_PATTERN.test(parts[1])
}

/**
 * Sanitize text content (remove HTML/scripts)
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return ''
  return sanitizeHtml(text, {
    allowedTags: [], // Strip all HTML
    allowedAttributes: {},
  }).trim()
}

/**
 * Sanitize content with basic formatting (bold, italic, links)
 */
export function sanitizeContent(text: string | undefined | null): string {
  if (!text) return ''
  return sanitizeHtml(text, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  }).trim()
}

/**
 * Validate email format
 */
export function validateEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false
  // Basic email regex
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(email)
}

/**
 * Validate content length
 */
export function validateContentLength(
  content: string | undefined | null,
  minLength = 1,
  maxLength = 10000
): boolean {
  if (!content) return minLength === 0
  return content.length >= minLength && content.length <= maxLength
}
