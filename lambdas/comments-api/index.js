const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const sanitizeHtml = require('sanitize-html');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const COMMENTS_TABLE = process.env.COMMENTS_TABLE;

/**
 * Lambda handler for Comments API
 * Routes:
 * - GET /comments/{itemId} - List comments for letter/media (paginated)
 * - POST /comments/{itemId} - Create new comment
 * - PUT /comments/{itemId}/{commentId} - Edit own comment
 * - DELETE /comments/{itemId}/{commentId} - Delete own comment (soft delete)
 * - DELETE /admin/comments/{commentId} - Admin delete any comment
 */
exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Extract userId from JWT (Cognito authorizer)
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.claims?.email;
    const userGroups = event.requestContext?.authorizer?.claims?.['cognito:groups'] || '';
    const isAdmin = userGroups.includes('Admins');

    if (!userId) {
      return errorResponse(401, 'Unauthorized: Missing user context');
    }

    // Route based on HTTP method and resource
    const method = event.httpMethod;
    const resource = event.resource;

    // GET /comments/{itemId}
    if (method === 'GET' && resource === '/comments/{itemId}') {
      return await listComments(event);
    }

    // POST /comments/{itemId}
    if (method === 'POST' && resource === '/comments/{itemId}') {
      return await createComment(event, userId, userEmail);
    }

    // PUT /comments/{itemId}/{commentId}
    if (method === 'PUT' && resource === '/comments/{itemId}/{commentId}') {
      return await editComment(event, userId, isAdmin);
    }

    // DELETE /comments/{itemId}/{commentId}
    if (method === 'DELETE' && resource === '/comments/{itemId}/{commentId}') {
      return await deleteComment(event, userId, isAdmin);
    }

    // DELETE /admin/comments/{commentId}
    if (method === 'DELETE' && resource === '/admin/comments/{commentId}') {
      return await adminDeleteComment(event, isAdmin);
    }

    return errorResponse(404, 'Route not found');

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * GET /comments/{itemId} - List comments for item
 */
async function listComments(event) {
  const itemId = event.pathParameters?.itemId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey;

  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter');
  }

  try {
    const queryParams = {
      TableName: COMMENTS_TABLE,
      KeyConditionExpression: 'itemId = :itemId',
      ExpressionAttributeValues: {
        ':itemId': itemId
      },
      Limit: limit,
      ScanIndexForward: true // Oldest first (chronological)
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString());
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Filter out soft-deleted comments
    const comments = (result.Items || []).filter(item => !item.isDeleted);

    const response = {
      items: comments,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null
    };

    return successResponse(response);

  } catch (error) {
    console.error('Error listing comments:', { itemId, error });
    throw error;
  }
}

/**
 * POST /comments/{itemId} - Create new comment
 */
async function createComment(event, userId, userEmail) {
  const itemId = event.pathParameters?.itemId;
  const body = JSON.parse(event.body || '{}');
  const commentText = body.commentText;
  const itemType = body.itemType || 'letter'; // 'letter' or 'media'
  const itemTitle = body.itemTitle || '';

  // Validate inputs
  if (!itemId) {
    return errorResponse(400, 'Missing itemId parameter');
  }

  if (!commentText || typeof commentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText');
  }

  // Sanitize HTML
  const sanitizedText = sanitizeHtml(commentText, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization');
  }

  if (sanitizedText.length > 2000) {
    return errorResponse(400, 'Comment text must be 2000 characters or less');
  }

  try {
    // Fetch user profile for denormalization
    const profileResult = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId }
    }));

    const profile = profileResult.Item || {};
    const userName = profile.displayName || userEmail || 'Anonymous';
    const userPhotoUrl = profile.profilePhotoUrl || '';

    // Generate commentId
    const timestamp = new Date().toISOString();
    const commentId = `${timestamp}#${uuidv4()}`;

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
      itemTitle
    };

    await docClient.send(new PutCommand({
      TableName: COMMENTS_TABLE,
      Item: comment
    }));

    return successResponse(comment, 201);

  } catch (error) {
    console.error('Error creating comment:', { itemId, userId, error });
    throw error;
  }
}

/**
 * PUT /comments/{itemId}/{commentId} - Edit own comment
 */
async function editComment(event, userId, isAdmin) {
  const itemId = event.pathParameters?.itemId;
  const commentId = event.pathParameters?.commentId;
  const body = JSON.parse(event.body || '{}');
  const newCommentText = body.commentText;

  // Validate inputs
  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter');
  }

  if (!newCommentText || typeof newCommentText !== 'string') {
    return errorResponse(400, 'Missing or invalid commentText');
  }

  // Sanitize HTML
  const sanitizedText = sanitizeHtml(newCommentText, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();

  if (!sanitizedText) {
    return errorResponse(400, 'Comment text cannot be empty after sanitization');
  }

  if (sanitizedText.length > 2000) {
    return errorResponse(400, 'Comment text must be 2000 characters or less');
  }

  try {
    // Fetch existing comment
    const result = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId }
    }));

    if (!result.Item) {
      return errorResponse(404, 'Comment not found');
    }

    const existingComment = result.Item;

    // Check ownership (unless admin)
    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only edit your own comments');
    }

    // Build edit history (keep last 5)
    const editHistory = existingComment.editHistory || [];
    editHistory.unshift({
      text: existingComment.commentText,
      timestamp: existingComment.updatedAt || existingComment.createdAt
    });
    const trimmedHistory = editHistory.slice(0, 5);

    // Update comment
    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET commentText = :text, updatedAt = :now, isEdited = :true, editHistory = :history',
      ExpressionAttributeValues: {
        ':text': sanitizedText,
        ':now': new Date().toISOString(),
        ':true': true,
        ':history': trimmedHistory
      }
    }));

    // Fetch updated comment
    const updatedResult = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId }
    }));

    return successResponse(updatedResult.Item);

  } catch (error) {
    console.error('Error editing comment:', { itemId, commentId, userId, error });
    throw error;
  }
}

/**
 * DELETE /comments/{itemId}/{commentId} - Soft delete own comment
 */
async function deleteComment(event, userId, isAdmin) {
  const itemId = event.pathParameters?.itemId;
  const commentId = event.pathParameters?.commentId;

  if (!itemId || !commentId) {
    return errorResponse(400, 'Missing itemId or commentId parameter');
  }

  try {
    // Fetch existing comment
    const result = await docClient.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId }
    }));

    if (!result.Item) {
      return errorResponse(404, 'Comment not found');
    }

    const existingComment = result.Item;

    // Check ownership (unless admin)
    if (existingComment.userId !== userId && !isAdmin) {
      return errorResponse(403, 'You can only delete your own comments');
    }

    // Soft delete
    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString()
      }
    }));

    return successResponse({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('Error deleting comment:', { itemId, commentId, userId, error });
    throw error;
  }
}

/**
 * DELETE /admin/comments/{commentId} - Admin delete any comment
 */
async function adminDeleteComment(event, isAdmin) {
  if (!isAdmin) {
    return errorResponse(403, 'Admin access required');
  }

  const commentId = event.pathParameters?.commentId;
  const body = JSON.parse(event.body || '{}');
  const itemId = body.itemId;

  if (!commentId || !itemId) {
    return errorResponse(400, 'Missing commentId or itemId');
  }

  try {
    // Soft delete
    await docClient.send(new UpdateCommand({
      TableName: COMMENTS_TABLE,
      Key: { itemId, commentId },
      UpdateExpression: 'SET isDeleted = :true, updatedAt = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString()
      }
    }));

    return successResponse({ message: 'Comment deleted by admin' });

  } catch (error) {
    console.error('Error admin deleting comment:', { itemId, commentId, error });
    throw error;
  }
}

/**
 * Success response helper
 */
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

/**
 * Error response helper
 */
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
