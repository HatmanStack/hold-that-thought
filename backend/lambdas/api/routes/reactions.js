const { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient, TABLE_NAME, PREFIX, keys, successResponse, errorResponse } = require('../utils')

async function handle(event, context) {
  const { requesterId } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  if (method === 'POST' && resource === '/reactions/{commentId}') {
    return await toggleReaction(event, requesterId)
  }

  if (method === 'GET' && resource === '/reactions/{commentId}') {
    return await getReactions(event)
  }

  if (method === 'DELETE' && resource === '/reactions/{commentId}') {
    return await toggleReaction(event, requesterId)
  }

  return errorResponse(404, 'Route not found')
}

async function toggleReaction(event, userId) {
  const commentId = event.pathParameters?.commentId
  const body = JSON.parse(event.body || '{}')
  const { itemId, reactionType = 'like' } = body

  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter')
  }

  if (!itemId) {
    return errorResponse(400, 'Missing itemId in request body')
  }

  try {
    const reactionKey = keys.reaction(itemId, commentId, userId)

    // Check if reaction exists
    const existingReaction = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: reactionKey,
    }))

    if (existingReaction.Item) {
      // Remove reaction
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: reactionKey,
      }))

      // Decrement comment reaction count
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: keys.comment(itemId, commentId),
          UpdateExpression: 'ADD reactionCount :decrement',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeValues: { ':decrement': -1 },
        }))
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error
      }

      return successResponse({ liked: false, message: 'Reaction removed' })
    } else {
      // Add reaction
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...reactionKey,
          entityType: 'REACTION',
          commentId,
          itemId,
          userId,
          reactionType,
          createdAt: new Date().toISOString(),
          // GSI1 for user's reaction history
          GSI1PK: `${PREFIX.USER}${userId}`,
          GSI1SK: `${PREFIX.REACTION}${new Date().toISOString()}`,
        },
      }))

      // Increment comment reaction count
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: keys.comment(itemId, commentId),
          UpdateExpression: 'ADD reactionCount :increment',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeValues: { ':increment': 1 },
        }))
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          // Rollback reaction
          await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: reactionKey,
          }))
          return errorResponse(404, 'Comment not found')
        }
        throw error
      }

      return successResponse({ liked: true, message: 'Reaction added' })
    }
  } catch (error) {
    console.error('Error toggling reaction:', { commentId, userId, error })
    throw error
  }
}

async function getReactions(event) {
  const commentId = event.pathParameters?.commentId
  const itemId = event.queryStringParameters?.itemId

  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter')
  }

  if (!itemId) {
    return errorResponse(400, 'Missing itemId query parameter')
  }

  try {
    // Query reactions for this comment: PK=COMMENT#<itemId>, SK begins with REACTION#<commentId>#
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.COMMENT}${itemId}`,
        ':skPrefix': `${PREFIX.REACTION}${commentId}#`,
      },
    }))

    const reactions = (result.Items || [])
      .filter(item => item.entityType === 'REACTION')
      .map(r => ({
        userId: r.userId,
        reactionType: r.reactionType,
        createdAt: r.createdAt,
      }))

    return successResponse({
      commentId,
      itemId,
      count: reactions.length,
      reactions,
    })
  } catch (error) {
    console.error('Error getting reactions:', { commentId, itemId, error })
    throw error
  }
}

module.exports = { handle }
