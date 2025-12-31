// @ts-check
/**
 * HTTP response helpers
 * @module lib/responses
 */

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*'

/**
 * Get CORS headers with the configured origin
 * @param {string} [requestOrigin] - The origin from the request
 * @returns {Record<string, string>}
 */
function getCorsHeaders(requestOrigin) {
  // If wildcard is configured, allow all
  if (ALLOWED_ORIGINS === '*') {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    }
  }

  // Check if request origin is in allowed list
  const allowedList = ALLOWED_ORIGINS.split(',').map(o => o.trim())
  const origin = requestOrigin && allowedList.includes(requestOrigin) ? requestOrigin : allowedList[0]

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Default headers for backwards compatibility (used when no origin context available)
const CORS_HEADERS = getCorsHeaders()

/**
 * @param {object} data
 * @param {number} [statusCode=200]
 * @returns {import('aws-lambda').APIGatewayProxyResult}
 */
function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  }
}

/**
 * @param {number} statusCode
 * @param {string} message
 * @returns {import('aws-lambda').APIGatewayProxyResult}
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  }
}

/**
 * @param {number} retryAfter
 * @param {string} message
 * @returns {import('aws-lambda').APIGatewayProxyResult}
 */
function rateLimitResponse(retryAfter, message) {
  return {
    statusCode: 429,
    headers: {
      ...CORS_HEADERS,
      'Retry-After': retryAfter.toString(),
    },
    body: JSON.stringify({ error: message }),
  }
}

module.exports = {
  successResponse,
  errorResponse,
  rateLimitResponse,
  getCorsHeaders,
}
