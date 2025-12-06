const { GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient, TABLE_NAME, PREFIX, keys, sanitizeText, successResponse, errorResponse } = require('../utils')

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
  const itemId = event.pathParameters?.itemId
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  try {
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'entityType = :entityType AND (attribute_not_exists(isDeleted) OR isDeleted = :false)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.COMMENT}${itemId}`,
        ':skPrefix': '20', // Comments start with timestamp (20xx-...)
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

    const comments = (result.Items || [])
      .map(item => ({
        itemId: item.itemId,
        commentId: item.SK,
        userId: item.userId,
        userName: item.userName,
        userPhotoUrl: item.userPhotoUrl,
        commentText: item.commentText,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isEdited: item.isEdited,
        reactionCount: item.reactionCount || 0,
      }))

    return successResponse({
      items: comments,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    })
  } catch (error) {
    console.error('Error listing comments:', { itemId, error })
    throw error
  }
}

async function createComment(event, userId, userEmail) {
  const itemId = event.pathParameters?.itemId
  const body = JSON.parse(event.body || '{}')
  const { commentText, itemType = 'letter', itemTitle = '' } = body

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  if (!commentText || typeof commentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText')
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
    const userPhotoUrl = profile.profilePhotoUrl || ''

    const timestamp = new Date().toISOString()
    const commentId = `${timestamp}#${uuidv4()}`

    const comment = {
      ...keys.comment(itemId, commentId),
      entityType: 'COMMENT',
      itemId,
      userId,
      userName,
      userPhotoUrl,
      commentText: sanitizedText,
      createdAt: timestamp,
      updatedAt: null,
      isEdited: false,
      editHistory: [],
      reactionCount: 0,
      isDeleted: false,
      itemType,
      itemTitle,
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
      userPhotoUrl,
      commentText: sanitizedText,
      createdAt: timestamp,
      reactionCount: 0,
    }, 201)
  } catch (error) {
    console.error('Error creating comment:', { itemId, userId, error })
    throw error
  }
}

async function editComment(event, userId, isAdmin) {
  const itemId = event.pathParameters?.itemId
  const commentId = event.pathParameters?.commentId
  const body = JSON.parse(event.body || '{}')
  const { commentText } = body

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

  try {
    const key = keys.comment(itemId, commentId)
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    if (!result.Item || result.Item.entityType !== 'COMMENT') {
      return errorResponse(404, 'Comment not found')
    }

    const existingComment = result.Item

    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only edit your own comments')
    }

    const editHistory = existingComment.editHistory || []
    editHistory.unshift({
      text: existingComment.commentText,
      timestamp: existingComment.updatedAt || existingComment.createdAt,
    })

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key,
      UpdateExpression: 'SET commentText = :text, updatedAt = :now, isEdited = :true, editHistory = :history',
      ExpressionAttributeValues: {
        ':text': sanitizedText,
        ':now': new Date().toISOString(),
        ':true': true,
        ':history': editHistory.slice(0, 5),
      },
    }))

    return successResponse({
      itemId,
      commentId,
      commentText: sanitizedText,
      updatedAt: new Date().toISOString(),
      isEdited: true,
    })
  } catch (error) {
    console.error('Error editing comment:', { itemId, commentId, userId, error })
    throw error
  }
}

async function deleteComment(event, userId, isAdmin) {
  const itemId = event.pathParameters?.itemId
  const commentId = event.pathParameters?.commentId

  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  try {
    const key = keys.comment(itemId, commentId)
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    if (!result.Item || result.Item.entityType !== 'COMMENT') {
      return errorResponse(404, 'Comment not found')
    }

    if (result.Item.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only delete your own comments')
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

    return successResponse({ message: 'Comment deleted successfully' })
  } catch (error) {
    console.error('Error deleting comment:', { itemId, commentId, userId, error })
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
