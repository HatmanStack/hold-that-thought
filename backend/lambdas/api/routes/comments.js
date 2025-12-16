const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient, TABLE_NAME, ARCHIVE_BUCKET, PREFIX, keys, sanitizeText, successResponse, errorResponse } = require('../utils')

const s3Client = new S3Client({})

/**
 * Decode base64url itemId from URL path
 * Frontend encodes: btoa(itemId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
 */
function decodeItemId(encoded) {
  // Restore base64 padding and characters
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

async function handle(event, context) {
  const { requesterId, requesterEmail, isAdmin } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  if (method === 'GET' && resource === '/comments/{itemId}') {
    return await listComments(event)
  }

  if (method === 'POST' && resource === '/comments/{itemId}') {
    return await createComment(event, requesterId, requesterEmail)
  }

  if (method === 'PUT' && resource === '/comments/{itemId}/{commentId}') {
    return await editComment(event, requesterId, isAdmin)
  }

  if (method === 'DELETE' && resource === '/comments/{itemId}/{commentId}') {
    return await deleteComment(event, requesterId, isAdmin)
  }

  if (method === 'DELETE' && resource === '/admin/comments/{commentId}') {
    return await adminDeleteComment(event, isAdmin)
  }

  return errorResponse(404, 'Route not found')
}

async function listComments(event) {
  const rawItemId = event.pathParameters?.itemId
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey

  if (!rawItemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  // Decode base64url itemId from frontend
  const itemId = decodeItemId(rawItemId)
  console.log('[listComments] decoded itemId:', itemId)

  // Try multiple storage formats for backwards compatibility
  // Old data stored with URL-encoded itemId, new data stores plain itemId
  const itemIdVariants = [itemId, encodeURIComponent(itemId)]

  try {
    let allItems = []

    for (const tryItemId of itemIdVariants) {
      const queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'entityType = :entityType AND (attribute_not_exists(isDeleted) OR isDeleted = :false)',
        ExpressionAttributeValues: {
          ':pk': `${PREFIX.COMMENT}${tryItemId}`,
          ':skPrefix': '20',
          ':entityType': 'COMMENT',
          ':false': false,
        },
        Limit: limit,
        ScanIndexForward: true,
      }

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString())
      }

      const result = await docClient.send(new QueryCommand(queryParams))
      if (result.Items && result.Items.length > 0) {
        allItems = result.Items
        console.log('[listComments] found', result.Items.length, 'comments with itemId:', tryItemId)
        break
      }
    }

    if (allItems.length === 0) {
      return successResponse({ items: [], lastEvaluatedKey: null })
    }

    // Sign profile photo URLs for private bucket access
    const comments = await Promise.all(allItems.map(async (item) => {
      let signedPhotoUrl = null
      if (item.userPhotoUrl) {
        // Extract bucket and key from S3 URL
        // Formats: https://bucket.s3.region.amazonaws.com/key or https://bucket.s3.amazonaws.com/key
        const s3Match = item.userPhotoUrl.match(/https:\/\/([^.]+)\.s3[^/]*\.amazonaws\.com\/(.+?)(?:\?|$)/)
        if (s3Match) {
          const bucket = s3Match[1]
          const key = decodeURIComponent(s3Match[2])
          try {
            signedPhotoUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({ Bucket: bucket, Key: key }),
              { expiresIn: 3600 }
            )
          } catch (e) {
            console.warn('Failed to sign photo URL:', bucket, key, e.message)
          }
        }
      }

      return {
        itemId: item.itemId,
        commentId: item.SK,
        userId: item.userId,
        userName: item.userName,
        userPhotoUrl: signedPhotoUrl || item.userPhotoUrl,
        commentText: item.commentText,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isEdited: item.isEdited,
        reactionCount: item.reactionCount || 0,
      }
    }))

    return successResponse({
      items: comments,
      lastEvaluatedKey: null, // Pagination simplified for now
    })
  } catch (error) {
    console.error('Error listing comments:', { rawItemId, error })
    throw error
  }
}

async function createComment(event, userId, userEmail) {
  const rawItemId = event.pathParameters?.itemId
  const itemId = decodeItemId(rawItemId)
  console.log('[createComment] decoded itemId:', itemId)
  const body = JSON.parse(event.body || '{}')
  const { commentText, itemType = 'letter', itemTitle = '' } = body

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  if (!commentText || typeof commentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText')
  }

  if (commentText.length > 2000) {
    return errorResponse(400, 'Comment must be 2000 characters or less')
  }

  const sanitizedText = sanitizeText(commentText, 2000)

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization')
  }

  try {
    // Get user profile for display name
    const profileResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userProfile(userId),
    }))

    const profile = profileResult.Item || {}
    const userName = profile.displayName || userEmail || 'Anonymous'
    const rawPhotoUrl = profile.profilePhotoUrl || ''

    // Sign the profile photo URL for the response
    let signedPhotoUrl = ''
    if (rawPhotoUrl) {
      const s3Match = rawPhotoUrl.match(/https:\/\/([^.]+)\.s3[^/]*\.amazonaws\.com\/(.+?)(?:\?|$)/)
      if (s3Match) {
        try {
          signedPhotoUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: s3Match[1], Key: decodeURIComponent(s3Match[2]) }),
            { expiresIn: 3600 }
          )
        } catch (e) {
          console.warn('Failed to sign photo URL:', e.message)
        }
      }
    }

    // Query for previous commenters on this item (for notifications)
    const previousCommenters = await getPreviousCommenters(itemId, userId)

    const timestamp = new Date().toISOString()
    const commentId = `${timestamp}#${uuidv4()}`

    const comment = {
      ...keys.comment(itemId, commentId),
      entityType: 'COMMENT',
      itemId,
      userId,
      userName,
      userPhotoUrl: rawPhotoUrl,
      commentText: sanitizedText,
      createdAt: timestamp,
      updatedAt: null,
      isEdited: false,
      editHistory: [],
      reactionCount: 0,
      isDeleted: false,
      itemType,
      itemTitle,
      // For notifications: list of users who previously commented on this item
      previousCommenters,
      // GSI1 for user's comment history
      GSI1PK: `${PREFIX.USER}${userId}`,
      GSI1SK: `${PREFIX.COMMENT}${timestamp}`,
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: comment,
    }))

    return successResponse({
      itemId,
      commentId,
      userId,
      userName,
      userPhotoUrl: signedPhotoUrl || rawPhotoUrl,
      commentText: sanitizedText,
      createdAt: timestamp,
      reactionCount: 0,
    }, 201)
  } catch (error) {
    console.error('Error creating comment:', { itemId, userId, error })
    throw error
  }
}

/**
 * Get list of unique user IDs who have previously commented on this item
 * Excludes the current commenter
 */
async function getPreviousCommenters(itemId, currentUserId) {
  const itemIdVariants = [itemId, encodeURIComponent(itemId)]
  const userIds = new Set()

  for (const tryItemId of itemIdVariants) {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'entityType = :entityType AND (attribute_not_exists(isDeleted) OR isDeleted = :false)',
        ExpressionAttributeValues: {
          ':pk': `${PREFIX.COMMENT}${tryItemId}`,
          ':skPrefix': '20',
          ':entityType': 'COMMENT',
          ':false': false,
        },
        ProjectionExpression: 'userId',
      }))

      if (result.Items) {
        for (const item of result.Items) {
          if (item.userId && item.userId !== currentUserId) {
            userIds.add(item.userId)
          }
        }
      }
    } catch (e) {
      console.warn('Error querying previous commenters:', e.message)
    }
  }

  return Array.from(userIds)
}

async function editComment(event, userId, isAdmin) {
  const rawItemId = event.pathParameters?.itemId
  const rawCommentId = event.pathParameters?.commentId
  const body = JSON.parse(event.body || '{}')
  const { commentText } = body

  const itemId = decodeItemId(rawItemId)
  const commentId = decodeURIComponent(rawCommentId)
  console.log('[editComment] decoded itemId:', itemId, 'commentId:', commentId)

  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  if (!commentText || typeof commentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText')
  }

  const sanitizedText = sanitizeText(commentText, 2000)

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization')
  }

  // Try both plain and URL-encoded itemId for backwards compat with old data
  const itemIdVariants = [itemId, encodeURIComponent(itemId)]

  try {
    let existingComment = null
    let foundKey = null

    for (const tryItemId of itemIdVariants) {
      const key = keys.comment(tryItemId, commentId)

      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: key,
      }))

      if (result.Item && result.Item.entityType === 'COMMENT') {
        existingComment = result.Item
        foundKey = key
        console.log('[editComment] found comment with itemId:', tryItemId)
        break
      }
    }

    if (!existingComment) {
      return errorResponse(404, 'Comment not found')
    }

    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only edit your own comments')
    }

    const editHistory = existingComment.editHistory || []
    editHistory.unshift({
      text: existingComment.commentText,
      timestamp: existingComment.updatedAt || existingComment.createdAt,
    })

    const now = new Date().toISOString()

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: foundKey,
      UpdateExpression: 'SET commentText = :text, updatedAt = :now, isEdited = :true, editHistory = :history',
      ExpressionAttributeValues: {
        ':text': sanitizedText,
        ':now': now,
        ':true': true,
        ':history': editHistory.slice(0, 5),
      },
    }))

    // Return full comment object for frontend
    return successResponse({
      itemId: existingComment.itemId,
      commentId,
      userId: existingComment.userId,
      userName: existingComment.userName,
      userPhotoUrl: existingComment.userPhotoUrl,
      commentText: sanitizedText,
      createdAt: existingComment.createdAt,
      updatedAt: now,
      isEdited: true,
      reactionCount: existingComment.reactionCount || 0,
    })
  } catch (error) {
    console.error('Error editing comment:', { rawItemId, commentId, userId, error })
    throw error
  }
}

async function deleteComment(event, userId, isAdmin) {
  const rawItemId = event.pathParameters?.itemId
  const rawCommentId = event.pathParameters?.commentId

  const itemId = decodeItemId(rawItemId)
  const commentId = decodeURIComponent(rawCommentId)
  console.log('[deleteComment] decoded itemId:', itemId, 'commentId:', commentId)

  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  // Try both plain and URL-encoded itemId for backwards compat with old data
  const itemIdVariants = [itemId, encodeURIComponent(itemId)]

  try {
    let existingComment = null
    let foundKey = null

    for (const tryItemId of itemIdVariants) {
      const key = keys.comment(tryItemId, commentId)
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: key,
      }))

      if (result.Item && result.Item.entityType === 'COMMENT') {
        existingComment = result.Item
        foundKey = key
        break
      }
    }

    if (!existingComment) {
      return errorResponse(404, 'Comment not found')
    }

    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only delete your own comments')
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: foundKey,
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
      },
    }))

    return successResponse({ message: 'Comment deleted successfully' })
  } catch (error) {
    console.error('Error deleting comment:', { rawItemId, commentId, userId, error })
    throw error
  }
}

async function adminDeleteComment(event, isAdmin) {
  if (!isAdmin) {
    return errorResponse(403, 'Admin access required')
  }

  const commentId = event.pathParameters?.commentId
  const body = JSON.parse(event.body || '{}')
  const { itemId } = body

  if (!commentId || !itemId) {
    return errorResponse(400, 'Missing commentId or itemId')
  }

  try {
    const key = keys.comment(itemId, commentId)

    // Verify comment exists before updating
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    if (!result.Item || result.Item.entityType !== 'COMMENT') {
      return errorResponse(404, 'Comment not found')
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key,
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
      },
    }))

    return successResponse({ message: 'Comment deleted by admin' })
  } catch (error) {
    console.error('Error admin deleting comment:', { itemId, commentId, error })
    throw error
  }
}

module.exports = { handle }
