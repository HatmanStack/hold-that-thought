// @ts-check
/**
 * HTTP response helpers
 * @module lib/responses
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
}

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
}
