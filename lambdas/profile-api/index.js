const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const COMMENTS_TABLE = process.env.COMMENTS_TABLE;

/**
 * Lambda handler for Profile API
 * Routes:
 * - GET /profile/{userId} - Retrieve user profile
 * - PUT /profile - Update own profile
 * - GET /profile/{userId}/comments - Get user's comment history
 */
exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Extract userId from JWT (Cognito authorizer)
    const requesterId = event.requestContext?.authorizer?.claims?.sub;
    const requesterEmail = event.requestContext?.authorizer?.claims?.email;
    const requesterGroups = event.requestContext?.authorizer?.claims?.['cognito:groups'] || '';
    const isAdmin = requesterGroups.includes('Admins');

    if (!requesterId) {
      return errorResponse(401, 'Unauthorized: Missing user context');
    }

    // Route based on HTTP method and resource
    const method = event.httpMethod;
    const resource = event.resource;

    // GET /profile/{userId}
    if (method === 'GET' && resource === '/profile/{userId}') {
      return await getProfile(event, requesterId, isAdmin);
    }

    // PUT /profile
    if (method === 'PUT' && resource === '/profile') {
      return await updateProfile(event, requesterId, requesterEmail);
    }

    // GET /profile/{userId}/comments
    if (method === 'GET' && resource === '/profile/{userId}/comments') {
      return await getUserComments(event, requesterId, isAdmin);
    }

    return errorResponse(404, 'Route not found');

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * GET /profile/{userId} - Retrieve user profile
 */
async function getProfile(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter');
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId }
    }));

    if (!result.Item) {
      return errorResponse(404, 'Profile not found');
    }

    const profile = result.Item;

    // Check privacy settings
    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private');
    }

    return successResponse(profile);

  } catch (error) {
    console.error('Error fetching profile:', { userId, error });
    throw error;
  }
}

/**
 * PUT /profile - Update own profile
 */
async function updateProfile(event, requesterId, requesterEmail) {
  const body = JSON.parse(event.body || '{}');

  // Validate inputs
  const errors = [];

  if (body.bio && body.bio.length > 500) {
    errors.push('Bio must be 500 characters or less');
  }

  if (body.displayName && body.displayName.length > 100) {
    errors.push('Display name must be 100 characters or less');
  }

  if (body.familyRelationship && body.familyRelationship.length > 100) {
    errors.push('Family relationship must be 100 characters or less');
  }

  if (errors.length > 0) {
    return errorResponse(400, errors.join(', '));
  }

  try {
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedFields = [
      'displayName',
      'profilePhotoUrl',
      'bio',
      'familyRelationship',
      'generation',
      'familyBranch',
      'isProfilePrivate'
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = body[field];
      }
    });

    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // If this is first update, set createdAt, joinedDate, email
    const now = new Date().toISOString();
    updateExpressions.push('#lastActive = :lastActive');
    expressionAttributeNames['#lastActive'] = 'lastActive';
    expressionAttributeValues[':lastActive'] = now;

    const result = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId: requesterId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    // Set email and joinedDate if creating for first time
    if (!result.Attributes.email) {
      await docClient.send(new UpdateCommand({
        TableName: USER_PROFILES_TABLE,
        Key: { userId: requesterId },
        UpdateExpression: 'SET #email = :email, #joinedDate = :joinedDate, #createdAt = :createdAt, #commentCount = :zero, #mediaUploadCount = :zero',
        ExpressionAttributeNames: {
          '#email': 'email',
          '#joinedDate': 'joinedDate',
          '#createdAt': 'createdAt',
          '#commentCount': 'commentCount',
          '#mediaUploadCount': 'mediaUploadCount'
        },
        ExpressionAttributeValues: {
          ':email': requesterEmail,
          ':joinedDate': now,
          ':createdAt': now,
          ':zero': 0
        },
        ReturnValues: 'ALL_NEW'
      }));
    }

    return successResponse(result.Attributes);

  } catch (error) {
    console.error('Error updating profile:', { requesterId, error });
    throw error;
  }
}

/**
 * GET /profile/{userId}/comments - Get user's comment history
 */
async function getUserComments(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey;

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter');
  }

  // First check if profile is private
  try {
    const profileResult = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId }
    }));

    if (!profileResult.Item) {
      return errorResponse(404, 'Profile not found');
    }

    const profile = profileResult.Item;

    // Check privacy settings
    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private');
    }

    // Query comments using GSI
    const queryParams = {
      TableName: COMMENTS_TABLE,
      IndexName: 'UserCommentsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
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
    console.error('Error fetching user comments:', { userId, error });
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
