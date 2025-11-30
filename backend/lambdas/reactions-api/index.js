const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const COMMENT_REACTIONS_TABLE = process.env.COMMENT_REACTIONS_TABLE;
const COMMENTS_TABLE = process.env.COMMENTS_TABLE;

exports.handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return errorResponse(401, 'Unauthorized: Missing user context');
    }

    const method = event.httpMethod;
    const resource = event.resource;

    if (method === 'POST' && resource === '/reactions/{commentId}') {
      return await toggleReaction(event, userId);
    }

    if (method === 'GET' && resource === '/reactions/{commentId}') {
      return await getReactions(event);
    }

    return errorResponse(404, 'Route not found');

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

async function toggleReaction(event, userId) {
  const commentId = event.pathParameters?.commentId;
  const body = JSON.parse(event.body || '{}');
  const itemId = body.itemId;
  const reactionType = body.reactionType || 'like';

  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter');
  }

  if (!itemId) {
    return errorResponse(400, 'Missing itemId in request body');
  }

  try {
    const existingReaction = await docClient.send(new GetCommand({
      TableName: COMMENT_REACTIONS_TABLE,
      Key: { commentId, userId }
    }));

    const reactionExists = !!existingReaction.Item;

    if (reactionExists) {
      await docClient.send(new DeleteCommand({
        TableName: COMMENT_REACTIONS_TABLE,
        Key: { commentId, userId }
      }));

      try {
        await docClient.send(new UpdateCommand({
          TableName: COMMENTS_TABLE,
          Key: { itemId, commentId },
          UpdateExpression: 'ADD reactionCount :decrement',
          ConditionExpression: 'attribute_exists(commentId)',
          ExpressionAttributeValues: {
            ':decrement': -1
          }
        }));
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') {
          throw error;
        }
      }

      return successResponse({ liked: false, message: 'Reaction removed' });

    } else {
      const reaction = {
        commentId,
        userId,
        reactionType,
        createdAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: COMMENT_REACTIONS_TABLE,
        Item: reaction
      }));

      try {
        await docClient.send(new UpdateCommand({
          TableName: COMMENTS_TABLE,
          Key: { itemId, commentId },
          UpdateExpression: 'ADD reactionCount :increment',
          ConditionExpression: 'attribute_exists(commentId)',
          ExpressionAttributeValues: {
            ':increment': 1
          }
        }));
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          console.error('Comment does not exist, rolling back reaction:', { itemId, commentId });
          await docClient.send(new DeleteCommand({
            TableName: COMMENT_REACTIONS_TABLE,
            Key: { commentId, userId }
          }));
          return errorResponse(404, 'Comment not found');
        }
        throw error;
      }

      return successResponse({ liked: true, message: 'Reaction added' });
    }

  } catch (error) {
    console.error('Error toggling reaction:', { commentId, userId, error });
    throw error;
  }
}

async function getReactions(event) {
  const commentId = event.pathParameters?.commentId;

  if (!commentId) {
    return errorResponse(400, 'Missing commentId parameter');
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: COMMENT_REACTIONS_TABLE,
      KeyConditionExpression: 'commentId = :commentId',
      ExpressionAttributeValues: {
        ':commentId': commentId
      }
    }));

    const reactions = result.Items || [];

    return successResponse({
      commentId,
      count: reactions.length,
      reactions: reactions.map(r => ({
        userId: r.userId,
        reactionType: r.reactionType,
        createdAt: r.createdAt
      }))
    });

  } catch (error) {
    console.error('Error getting reactions:', { commentId, error });
    throw error;
  }
}

function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(data)
  };
}

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify({ error: message })
  };
}
