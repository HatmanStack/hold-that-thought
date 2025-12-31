/**
 * HTTP response helpers
 */
import type { APIGatewayProxyResult } from 'aws-lambda'

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*'

/**
 * Get CORS headers with the configured origin
 */
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // If wildcard is configured, allow all
  if (ALLOWED_ORIGINS === '*') {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    }
  }

  // Check if request origin is in allowed list
  const allowedList = ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  const origin =
    requestOrigin && allowedList.includes(requestOrigin)
      ? requestOrigin
      : allowedList[0] || '*'

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
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
