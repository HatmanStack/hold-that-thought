/**
 * Hold That Thought API - Main Entry Point
 *
 * This is a consolidated API Lambda that routes requests to appropriate handlers.
 * TypeScript version with type-safe routing and repositories.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { RequestContext, AuthClaims } from './types'
import { comments, messages, profile, reactions, media, letters, drafts, contact } from './routes'
import { ensureProfile } from './lib/user'
import { log } from './lib/logger'
import { errorResponse } from './lib/responses'

/**
 * Current API version
 */
export const API_VERSION = 'v1'

/**
 * Main API router - consolidates all API endpoints into a single Lambda
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod
  const rawPath = event.resource || event.path

  // Strip version prefix if present (supports /v1/... format)
  const path = rawPath.replace(/^\/v1/, '') || '/'

  // Extract auth context
  const claims = (event.requestContext?.authorizer?.claims || {}) as AuthClaims
  const requesterId = claims.sub
  const requesterEmail = claims.email
  const requesterGroups = claims['cognito:groups'] || ''
  const isAdmin = requesterGroups.includes('Admins')
  const isApprovedUser = requesterGroups.includes('ApprovedUsers')

  log.info('request', {
    method,
    path,
    rawPath,
    requesterId,
    requesterEmail,
    isAdmin,
    isApprovedUser,
  })

  // Auto-create profile for approved users on first request
  if (requesterId) {
    try {
      await ensureProfile(requesterId, requesterEmail, requesterGroups)
    } catch (err) {
      log.error('ensure_profile_failed', {
        requesterId,
        error: (err as Error).message,
      })
      return errorResponse(500, 'Failed to initialize user profile')
    }
  }

  const context: RequestContext = {
    requesterId,
    requesterEmail,
    isAdmin,
    isApprovedUser,
  }

  try {
    // Route to appropriate handler based on path
    if (path.startsWith('/comments')) {
      return comments.handle(event, context)
    }

    if (path.startsWith('/messages')) {
      return messages.handle(event, context)
    }

    if (path.startsWith('/profile') || path.startsWith('/users')) {
      return profile.handle(event, context)
    }

    if (path.startsWith('/reactions')) {
      return reactions.handle(event, context)
    }

    if (path.startsWith('/media') || path.startsWith('/pdf') || path.startsWith('/download') || path.startsWith('/upload')) {
      return media.handle(event, context)
    }

    // Drafts / Uploads (specific routes before generic /letters)
    if (path.startsWith('/letters/upload-request') || path.startsWith('/letters/process')) {
      return drafts.handle(event, context)
    }

    if (path.startsWith('/letters')) {
      return letters.handle(event, context)
    }

    if (path.startsWith('/contact')) {
      return contact.handle(event, context)
    }

    if (path.startsWith('/admin/')) {
      // Draft routes - allow ApprovedUsers (not just Admins)
      if (path.startsWith('/admin/drafts')) {
        if (!isApprovedUser && !isAdmin) {
          return errorResponse(403, 'Approved user access required')
        }
        return drafts.handle(event, context)
      }

      // Other admin routes - require Admins group
      if (!isAdmin) {
        return errorResponse(403, 'Admin access required')
      }

      // Admin comment moderation: /admin/comments/{commentId}
      if (path.startsWith('/admin/comments/')) {
        return comments.handle(event, context)
      }

      // Unknown admin route
      return errorResponse(404, `Admin route not found: ${method} ${path}`)
    }

    return errorResponse(404, `Route not found: ${method} ${path}`)
  } catch (error) {
    log.error('unhandled_error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    })
    return errorResponse(500, 'Internal server error')
  }
}
