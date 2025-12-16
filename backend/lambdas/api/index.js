// @ts-check
const comments = require('./routes/comments')
const messages = require('./routes/messages')
const profile = require('./routes/profile')
const reactions = require('./routes/reactions')
const media = require('./routes/media')
const letters = require('./routes/letters')
const drafts = require('./routes/drafts')
const { ensureProfile } = require('./utils')
const { log } = require('./lib/logger')
const { errorResponse } = require('./lib/responses')

/**
 * Main API router - consolidates all API endpoints into a single Lambda
 * @param {import('aws-lambda').APIGatewayProxyEvent} event
 * @returns {Promise<import('aws-lambda').APIGatewayProxyResult>}
 */
exports.handler = async (event) => {
  const method = event.httpMethod
  const path = event.resource || event.path

  // Extract auth context
  const claims = event.requestContext?.authorizer?.claims || {}
  const requesterId = claims.sub
  const requesterEmail = claims.email
  const requesterGroups = claims['cognito:groups'] || ''
  const isAdmin = requesterGroups.includes('Admins')
  const isApprovedUser = requesterGroups.includes('ApprovedUsers')

  log.info('auth_context', { requesterId, requesterEmail, requesterGroups })

  // Auto-create profile for approved users on first request
  if (requesterId) {
    try {
      await ensureProfile(requesterId, requesterEmail, requesterGroups)
    } catch (err) {
      log.error('ensure_profile_failed', { requesterId, error: err.message })
      return errorResponse(500, 'Failed to initialize user profile')
    }
  }

  const context = { requesterId, requesterEmail, isAdmin, isApprovedUser }

  try {
    // Route to appropriate handler based on path
    if (path.startsWith('/comments')) {
      return await comments.handle(event, context)
    }

    if (path.startsWith('/messages')) {
      return await messages.handle(event, context)
    }

    if (path.startsWith('/profile') || path.startsWith('/users')) {
      return await profile.handle(event, context)
    }

    if (path.startsWith('/reactions')) {
      return await reactions.handle(event, context)
    }

    if (path.startsWith('/media') || path.startsWith('/pdf') || path.startsWith('/download') || path.startsWith('/upload')) {
      return await media.handle(event, context)
    }

    // Drafts / Uploads (specific routes before generic /letters)
    if (path.startsWith('/letters/upload-request') || path.startsWith('/letters/process')) {
      return await drafts.handle(event, context)
    }

    if (path.startsWith('/letters')) {
      return await letters.handle(event, context)
    }

    if (path.startsWith('/admin')) {
      // Draft routes - allow ApprovedUsers (not just Admins)
      if (path.includes('/drafts')) {
        if (!isApprovedUser && !isAdmin) {
          return errorResponse(403, 'Approved user access required')
        }
        return await drafts.handle(event, context)
      }

      // Other admin routes - require Admins group
      if (!isAdmin) {
        return errorResponse(403, 'Admin access required')
      }
      if (path.includes('/comments/')) {
        return await comments.handle(event, context)
      }
    }

    return errorResponse(404, `Route not found: ${method} ${path}`)
  } catch (error) {
    log.error('unhandled_error', { error: error.message, stack: error.stack })
    return errorResponse(500, 'Internal server error')
  }
}
