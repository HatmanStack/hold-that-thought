/**
 * HTTP response helpers
 */
import type { APIGatewayProxyResult } from 'aws-lambda'

/**
 * Get configured allowed origins.
 * Fails closed: requires explicit configuration, no permissive default.
 */
function getAllowedOrigins(): string {
  const origins = process.env.ALLOWED_ORIGINS

  if (!origins) {
    // In local development, allow wildcard if explicitly not set
    if (process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'test') {
      return '*'
    }
    console.error('CORS_CONFIG_ERROR: ALLOWED_ORIGINS environment variable is not set')
    // Fail closed: return empty string which will reject all cross-origin requests
    return ''
  }

  return origins
}

const ALLOWED_ORIGINS = getAllowedOrigins()

/**
 * Get CORS headers with the configured origin
 */
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // If no origins configured, return restrictive headers (fail closed)
  if (!ALLOWED_ORIGINS) {
    return {
      'Content-Type': 'application/json',
      // No Access-Control-Allow-Origin header = browser will block cross-origin requests
    }
  }

  // If wildcard is explicitly configured (development only)
  if (ALLOWED_ORIGINS === '*') {
    // CORS spec: credentials not allowed with wildcard origin
    // If we have a request origin, echo it to allow credentials
    if (requestOrigin) {
      return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Credentials': 'true',
      }
    }
    // No origin provided - use wildcard without credentials
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  }

  // Check if request origin is in allowed list
  const allowedList = ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)

  // If request origin is in the allowed list, echo it back
  if (requestOrigin && allowedList.includes(requestOrigin)) {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Credentials': 'true',
    }
  }

  // Request origin not in allowed list - use first allowed origin
  // This allows same-origin requests to work
  const defaultOrigin = allowedList[0]
  if (defaultOrigin) {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': defaultOrigin,
      'Access-Control-Allow-Credentials': 'true',
    }
  }

  // No valid origins configured - fail closed
  return {
    'Content-Type': 'application/json',
  }
}

// Default headers for backwards compatibility
const CORS_HEADERS = getCorsHeaders()

/**
 * Create a success response
 */
export function successResponse(
  data: unknown,
  statusCode = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  }
}

/**
 * Create an error response
 */
export function errorResponse(
  statusCode: number,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  }
}

/**
 * Create a rate limit response
 */
export function rateLimitResponse(
  retryAfter: number,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode: 429,
    headers: {
      ...CORS_HEADERS,
      'Retry-After': retryAfter.toString(),
    },
    body: JSON.stringify({ error: message }),
  }
}
