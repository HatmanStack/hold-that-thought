const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const sanitizeHtml = require('sanitize-html')
const { v4: uuidv4 } = require('uuid')

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE
const COMMENTS_TABLE = process.env.COMMENTS_TABLE

exports.handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.claims?.sub
    const userEmail = event.requestContext?.authorizer?.claims?.email
    const userGroupsRaw = event.requestContext?.authorizer?.claims?.['cognito:groups']

    let userGroups = []
    if (Array.isArray(userGroupsRaw)) {
      userGroups = userGroupsRaw
    }
    else if (typeof userGroupsRaw === 'string') {
      userGroups = userGroupsRaw.split(',').map(g => g.trim()).filter(g => g)
    }

    const isAdmin = userGroups.includes('Admins')

    if (!userId) {
      return errorResponse(401, 'Unauthorized: Missing user context')
    }

    const method = event.httpMethod
    const resource = event.resource

    if (method === 'GET' && resource === '/comments/{itemId}') {
      return await listComments(event)
    }

    if (method === 'POST' && resource === '/comments/{itemId}') {
      return await createComment(event, userId, userEmail)
    }

    if (method === 'PUT' && resource === '/comments/{itemId}/{commentId}') {
      return await editComment(event, userId, isAdmin)
    }

    if (method === 'DELETE' && resource === '/comments/{itemId}/{commentId}') {
      return await deleteComment(event, userId, isAdmin)
    }

    if (method === 'DELETE' && resource === '/admin/comments/{commentId}') {
      return await adminDeleteComment(event, isAdmin)
    }

    return errorResponse(404, 'Route not found')
  }
  catch (error) {
    console.error('Error:', error)
    return errorResponse(500, 'Internal server error')
  }
}

async function listComments(event) {
  const itemId = event.pathParameters?.itemId
  const limit = Number.parseInt(event.queryStringParameters?.limit || '50')
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  try {
    const queryParams = {
      TableName: COMMENTS_TABLE,
      KeyConditionExpression: 'itemId = :itemId',
      ExpressionAttributeValues: {
        ':itemId': itemId,
      },
      Limit: limit,
      ScanIndexForward: true,
    }

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString())
    }

    const result = await docClient.send(new QueryCommand(queryParams))

    const comments = (result.Items || []).filter(item => !item.isDeleted)

    const response = {
      items: comments,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    }

    return successResponse(response)
  }
  catch (error) {
    console.error('Error listing comments:', { itemId, error })
    throw error
  }
}

async function createComment(event, userId, userEmail) {
  const itemId = event.pathParameters?.itemId
  const body = JSON.parse(event.body || '{}')
  const commentText = body.commentText
  const itemType = body.itemType || 'letter'
  const itemTitle = body.itemTitle || ''

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter')
  }

  if (!commentText || typeof commentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText')
  }

  const sanitizedText = sanitizeHtml(commentText, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization')
  }

  if (sanitizedText.length > 2000) {
    return errorResponse(400, 'Comment text must be 2000 characters or less')
  }

  try {
    const profileResult = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId },
    }))

    const profile = profileResult.Item || {}
    const userName = profile.displayName || userEmail || 'Anonymous'
    const userPhotoUrl = profile.profilePhotoUrl || ''

    const timestamp = new Date().toISOString()
    const commentId = `${timestamp}#${uuidv4()}`

    const comment = {
      itemId,
      commentId,
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
    }

    await docClient.send(new PutCommand({
      TableName: COMMENTS_TABLE,
      Item: comment,
    }))

    return successResponse(comment, 201)
  }
  catch (error) {
    console.error('Error creating comment:', { itemId, userId, error })
    throw error
  }
}

async function editComment(event, userId, isAdmin) {
  const itemId = event.pathParameters?.itemId
  const commentId = event.pathParameters?.commentId
  const body = JSON.parse(event.body || '{}')
  const newCommentText = body.commentText

  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter')
  }

  if (!newCommentText || typeof newCommentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText')
  }

  const sanitizedText = sanitizeHtml(newCommentText, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization')
  }

  if (sanitizedText.length > 2000) {
    return errorResponse(400, 'Comment text must be 2000 characters or less')
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
    }))

    if (!result.Item) {
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
    const trimmedHistory = editHistory.slice(0, 5)

    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET commentText = :text, updatedAt = :now, isEdited = :true, editHistory = :history',
      ExpressionAttributeValues: {
        ':text': sanitizedText,
        ':now': new Date().toISOString(),
        ':true': true,
        ':history': trimmedHistory,
      },
    }))

    const updatedResult = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
    }))

    return successResponse(updatedResult.Item)
  }
  catch (error) {
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
    const result = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
    }))

    if (!result.Item) {
      return errorResponse(404, 'Comment not found')
    }

    const existingComment = result.Item

    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only delete your own comments')
    }

    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
      },
    }))

    return successResponse({ message: 'Comment deleted successfully' })
  }
  catch (error) {
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
  const itemId = body.itemId

  if (!commentId || !itemId) {
    return errorResponse(400, 'Missing commentId or itemId')
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
      },
    }))

    return successResponse({ message: 'Comment deleted by admin' })
  }
  catch (error) {
    console.error('Error admin deleting comment:', { itemId, commentId, error })
    throw error
  }
}

function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  }
}

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ error: message }),
  }
}
