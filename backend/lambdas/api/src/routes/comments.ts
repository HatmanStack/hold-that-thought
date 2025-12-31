/**
 * Comments route handler
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { RequestContext } from '../types'
import { commentRepository } from '../repositories'
import { successResponse, errorResponse, rateLimitResponse } from '../lib/responses'
import { sanitizeText, validateContentLength } from '../lib/validation'
import { checkRateLimit, getRetryAfter } from '../lib/rate-limit'
import { log } from '../lib/logger'

/**
 * Decode base64url itemId from URL path
 */
function decodeItemId(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Main comments route handler
 */
export async function handle(
  event: APIGatewayProxyEvent,
  context: RequestContext
): Promise<APIGatewayProxyResult> {
  const { requesterId, requesterEmail, isAdmin } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  // Strip /v1 prefix if present
  const normalizedResource = resource.replace(/^\/v1/, '')

  if (method === 'GET' && normalizedResource === '/comments/{itemId}') {
    return listComments(event, requesterId)
  }

  if (method === 'POST' && normalizedResource === '/comments/{itemId}') {
    return createComment(event, requesterId, requesterEmail)
  }

  if (method === 'PUT' && normalizedResource === '/comments/{itemId}/{commentId}') {
    return editComment(event, requesterId, isAdmin)
  }

  if (method === 'DELETE' && normalizedResource === '/comments/{itemId}/{commentId}') {
    return deleteComment(event, requesterId, isAdmin)
  }

  if (method === 'DELETE' && normalizedResource === '/admin/comments/{commentId}') {
    return adminDeleteComment(event, isAdmin)
  }

  return errorResponse(404, 'Route not found')
}

/**
 * List comments for an item
 */
async function listComments(
  event: APIGatewayProxyEvent,
  _requesterId: string
): Promise<APIGatewayProxyResult> {
  const rawItemId = event.pathParameters?.itemId
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey

  if (!rawItemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  const itemId = decodeItemId(rawItemId)

  try {
    const result = await commentRepository.listByItemId(itemId, {
      limit: Math.min(limit, 100),
      lastEvaluatedKey,
    })

    log.info('list_comments', { itemId, count: result.count })

    return successResponse({
      comments: result.items,
      lastEvaluatedKey: result.lastEvaluatedKey,
      count: result.count,
    })
  } catch (error) {
    log.error('list_comments_error', { itemId, error: (error as Error).message })
    return errorResponse(500, 'Failed to fetch comments')
  }
}

/**
 * Create a new comment
 */
async function createComment(
  event: APIGatewayProxyEvent,
  requesterId: string,
  requesterEmail?: string
): Promise<APIGatewayProxyResult> {
  // Rate limit check
  const rateLimit = await checkRateLimit(requesterId, 'comment')
  if (!rateLimit.allowed) {
    return rateLimitResponse(
      getRetryAfter(rateLimit.resetAt),
      'Rate limit exceeded. Please try again later.'
    )
  }

  const rawItemId = event.pathParameters?.itemId
  if (!rawItemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  const itemId = decodeItemId(rawItemId)

  let body: { content?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }

  const content = sanitizeText(body.content)
  if (!validateContentLength(content, 1, 10000)) {
    return errorResponse(400, 'Comment content must be between 1 and 10000 characters')
  }

  try {
    const comment = await commentRepository.create({
      itemId,
      content,
      authorId: requesterId,
      authorEmail: requesterEmail,
    })

    log.info('create_comment', { itemId, commentId: comment.commentId })

    return successResponse(comment, 201)
  } catch (error) {
    log.error('create_comment_error', { itemId, error: (error as Error).message })
    return errorResponse(500, 'Failed to create comment')
  }
}

/**
 * Edit an existing comment
 */
async function editComment(
  event: APIGatewayProxyEvent,
  requesterId: string,
  isAdmin: boolean
): Promise<APIGatewayProxyResult> {
  const rawItemId = event.pathParameters?.itemId
  const commentId = event.pathParameters?.commentId

  if (!rawItemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  const itemId = decodeItemId(rawItemId)

  let body: { content?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }

  const content = sanitizeText(body.content)
  if (!validateContentLength(content, 1, 10000)) {
    return errorResponse(400, 'Comment content must be between 1 and 10000 characters')
  }

  try {
    // Get existing comment to verify ownership
    const existing = await commentRepository.getById(itemId, commentId)
    if (!existing) {
      return errorResponse(404, 'Comment not found')
    }

    // Check ownership (unless admin)
    if (!isAdmin && existing.authorId !== requesterId) {
      return errorResponse(403, 'You can only edit your own comments')
    }

    const updated = await commentRepository.updateContent(
      itemId,
      commentId,
      content,
      existing.content
    )

    log.info('edit_comment', { itemId, commentId })

    return successResponse(updated)
  } catch (error) {
    log.error('edit_comment_error', { itemId, commentId, error: (error as Error).message })
    return errorResponse(500, 'Failed to edit comment')
  }
}

/**
 * Delete a comment (soft delete)
 */
async function deleteComment(
  event: APIGatewayProxyEvent,
  requesterId: string,
  isAdmin: boolean
): Promise<APIGatewayProxyResult> {
  const rawItemId = event.pathParameters?.itemId
  const commentId = event.pathParameters?.commentId

  if (!rawItemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  const itemId = decodeItemId(rawItemId)

  try {
    // Get existing comment to verify ownership
    const existing = await commentRepository.getById(itemId, commentId)
    if (!existing) {
      return errorResponse(404, 'Comment not found')
    }

    // Check ownership (unless admin)
    if (!isAdmin && existing.authorId !== requesterId) {
      return errorResponse(403, 'You can only delete your own comments')
    }

    await commentRepository.softDelete(itemId, commentId)

    log.info('delete_comment', { itemId, commentId })

    return successResponse({ success: true })
  } catch (error) {
    log.error('delete_comment_error', { itemId, commentId, error: (error as Error).message })
    return errorResponse(500, 'Failed to delete comment')
  }
}

/**
 * Admin hard delete a comment
 */
async function adminDeleteComment(
  event: APIGatewayProxyEvent,
  isAdmin: boolean
): Promise<APIGatewayProxyResult> {
  if (!isAdmin) {
    return errorResponse(403, 'Admin access required')
  }

  const commentId = event.pathParameters?.commentId
  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter')
  }

  // For admin delete, we need to find the comment first
  // This requires knowing the itemId, which should be passed in the request
  let body: { itemId?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }

  if (!body.itemId) {
    return errorResponse(400, 'Missing itemId in request body')
  }

  const itemId = body.itemId

  try {
    await commentRepository.hardDelete(itemId, commentId)

    log.info('admin_delete_comment', { itemId, commentId })

    return successResponse({ success: true })
  } catch (error) {
    log.error('admin_delete_comment_error', { commentId, error: (error as Error).message })
    return errorResponse(500, 'Failed to delete comment')
  }
}
