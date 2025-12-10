const { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb')
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
  const rawCommentId = event.pathParameters?.commentId
  const commentId = decodeURIComponent(rawCommentId)
  const body = JSON.parse(event.body || '{}')
  const { itemId: rawItemId, reactionType = 'like' } = body

  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter')
  }

  if (!rawItemId) {
    return errorResponse(400, 'Missing itemId in request body')
  }

  // Decode itemId in case it's URL-encoded from comment object
  const itemId = decodeURIComponent(rawItemId)

  console.log('[toggleReaction] commentId:', commentId, 'itemId:', itemId)

  // Try both plain and URL-encoded itemId for backwards compat
  const itemIdVariants = [itemId, encodeURIComponent(itemId)]

  try {
    let foundCommentKey = null

    // Find the comment first
    for (const tryItemId of itemIdVariants) {
      const tryKey = keys.comment(tryItemId, commentId)
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: tryKey,
      }))
      if (result.Item && result.Item.entityType === 'COMMENT') {
        foundCommentKey = tryKey
        console.log('[toggleReaction] found comment with itemId:', tryItemId)
        break
      }
    }

    if (!foundCommentKey) {
      return errorResponse(404, 'Comment not found')
    }

    // Use the itemId that matched
    const actualItemId = foundCommentKey.PK.replace(PREFIX.COMMENT, '')
    const reactionKey = keys.reaction(actualItemId, commentId, userId)

    // Check if reaction exists
    const existingReaction = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: reactionKey,
    }))

    if (existingReaction.Item) {
      // Remove reaction atomically with count decrement
      try {
        await docClient.send(new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: TABLE_NAME,
                Key: reactionKey,
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: foundCommentKey,
                UpdateExpression: 'ADD reactionCount :decrement',
                ConditionExpression: 'attribute_exists(PK)',
                ExpressionAttributeValues: { ':decrement': -1 },
              },
            },
          ],
        }))
      } catch (error) {
        // If comment doesn't exist, still allow reaction deletion
        if (error.name === 'TransactionCanceledException') {
          await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: reactionKey,
          }))
        } else {
          throw error
        }
      }

      return successResponse({ liked: false, message: 'Reaction removed' })
    } else {
      // Add reaction atomically with count increment
      const now = new Date().toISOString()

      try {
        await docClient.send(new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  ...reactionKey,
                  entityType: 'REACTION',
                  commentId,
                  itemId: actualItemId,
                  userId,
                  reactionType,
                  createdAt: now,
                  GSI1PK: `${PREFIX.USER}${userId}`,
                  GSI1SK: `${PREFIX.REACTION}${now}`,
                },
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: foundCommentKey,
                UpdateExpression: 'ADD reactionCount :increment',
                ConditionExpression: 'attribute_exists(PK)',
                ExpressionAttributeValues: { ':increment': 1 },
              },
            },
          ],
        }))
      } catch (error) {
        if (error.name === 'TransactionCanceledException') {
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
