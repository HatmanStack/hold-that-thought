const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sanitizeHtml = require('sanitize-html');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const COMMENTS_TABLE = process.env.COMMENTS_TABLE;
const PROFILE_PHOTOS_BUCKET = process.env.PROFILE_PHOTOS_BUCKET;
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE;

const RATE_LIMITS = {
  updateProfile: { requests: 10, windowSeconds: 60 },
  photoUpload: { requests: 5, windowSeconds: 300 }
};

async function checkRateLimit(userId, action) {
  if (!RATE_LIMIT_TABLE) {
    return { allowed: true };
  }

  const limit = RATE_LIMITS[action];
  if (!limit) {
    return { allowed: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - limit.windowSeconds;
  const key = `${userId}:${action}`;

  try {
    const result = await docClient.send(new GetCommand({
      TableName: RATE_LIMIT_TABLE,
      Key: { rateLimitKey: key }
    }));

    const item = result.Item;

    if (item && item.count >= limit.requests && item.windowStart > windowStart) {
      const resetTime = item.windowStart + limit.windowSeconds;
      return {
        allowed: false,
        error: `Rate limit exceeded. Try again in ${resetTime - now} seconds`,
        retryAfter: resetTime - now
      };
    }

    const newCount = (item && item.windowStart > windowStart) ? item.count + 1 : 1;
    const newWindowStart = (item && item.windowStart > windowStart) ? item.windowStart : now;

    await docClient.send(new PutCommand({
      TableName: RATE_LIMIT_TABLE,
      Item: {
        rateLimitKey: key,
        count: newCount,
        windowStart: newWindowStart,
        ttl: now + limit.windowSeconds + 3600
      }
    }));

    return { allowed: true };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true };
  }
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  if (userId.length > 100) {
    return { valid: false, error: 'User ID too long' };
  }

  if (!uuidRegex.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  return { valid: true };
}

function validateLimit(limit) {
  const numLimit = parseInt(limit, 10);

  if (isNaN(numLimit) || numLimit < 1) {
    return { valid: false, error: 'Limit must be a positive number' };
  }

  if (numLimit > 100) {
    return { valid: false, error: 'Limit cannot exceed 100' };
  }

  return { valid: true, value: numLimit };
}

function validateLastEvaluatedKey(key) {
  if (!key) {
    return { valid: true, value: null };
  }

  try {
    const decoded = Buffer.from(key, 'base64').toString();
    const parsed = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, error: 'Invalid pagination key format' };
    }

    return { valid: true, value: parsed };
  } catch (error) {
    return { valid: false, error: 'Invalid pagination key encoding' };
  }
}

exports.handler = async (event) => {
  try {
    const requesterId = event.requestContext?.authorizer?.claims?.sub;
    const requesterEmail = event.requestContext?.authorizer?.claims?.email;
    const requesterGroups = event.requestContext?.authorizer?.claims?.['cognito:groups'] || '';
    const isAdmin = requesterGroups.includes('Admins');

    if (!requesterId) {
      return errorResponse(401, 'Unauthorized: Missing user context');
    }

    const method = event.httpMethod;
    const resource = event.resource;

    if (method === 'GET' && resource === '/profile/{userId}') {
      return await getProfile(event, requesterId, isAdmin);
    }

    if (method === 'PUT' && resource === '/profile') {
      return await updateProfile(event, requesterId, requesterEmail);
    }

    if (method === 'GET' && resource === '/profile/{userId}/comments') {
      return await getUserComments(event, requesterId, isAdmin);
    }

    if (method === 'POST' && resource === '/profile/photo/upload-url') {
      return await getPhotoUploadUrl(event, requesterId);
    }

    return errorResponse(404, 'Route not found');

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

async function getProfile(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter');
  }

  const validation = validateUserId(userId);
  if (!validation.valid) {
    return errorResponse(400, validation.error);
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

    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private');
    }

    return successResponse(profile);

  } catch (error) {
    console.error('Error fetching profile:', { userId, error });
    throw error;
  }
}

async function updateProfile(event, requesterId, requesterEmail) {
  const rateLimitCheck = await checkRateLimit(requesterId, 'updateProfile');
  if (!rateLimitCheck.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Retry-After': rateLimitCheck.retryAfter.toString()
      },
      body: JSON.stringify({ error: rateLimitCheck.error })
    };
  }

  const body = JSON.parse(event.body || '{}');

  if (body.bio) {
    body.bio = sanitizeHtml(body.bio, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();
  }

  if (body.displayName) {
    body.displayName = sanitizeHtml(body.displayName, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();
  }

  if (body.familyRelationship) {
    body.familyRelationship = sanitizeHtml(body.familyRelationship, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();
  }

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

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

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

async function getUserComments(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId;
  const limitParam = event.queryStringParameters?.limit || '50';
  const lastEvaluatedKeyParam = event.queryStringParameters?.lastEvaluatedKey;

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter');
  }

  const userIdValidation = validateUserId(userId);
  if (!userIdValidation.valid) {
    return errorResponse(400, userIdValidation.error);
  }

  const limitValidation = validateLimit(limitParam);
  if (!limitValidation.valid) {
    return errorResponse(400, limitValidation.error);
  }
  const limit = limitValidation.value;

  const keyValidation = validateLastEvaluatedKey(lastEvaluatedKeyParam);
  if (!keyValidation.valid) {
    return errorResponse(400, keyValidation.error);
  }
  const lastEvaluatedKey = keyValidation.value;

  try {
    const profileResult = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { userId }
    }));

    if (!profileResult.Item) {
      return errorResponse(404, 'Profile not found');
    }

    const profile = profileResult.Item;

    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private');
    }

    const queryParams = {
      TableName: COMMENTS_TABLE,
      IndexName: 'UserCommentsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

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

async function getPhotoUploadUrl(event, requesterId) {
  const rateLimitCheck = await checkRateLimit(requesterId, 'photoUpload');
  if (!rateLimitCheck.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Retry-After': rateLimitCheck.retryAfter.toString()
      },
      body: JSON.stringify({ error: rateLimitCheck.error })
    };
  }

  const body = JSON.parse(event.body || '{}');
  const { filename, contentType } = body;

  if (!filename || !contentType) {
    return errorResponse(400, 'Filename and contentType are required');
  }

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedImageTypes.includes(contentType)) {
    return errorResponse(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed for profile photos');
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return errorResponse(400, 'Invalid filename');
  }

  if (filename.length > 255) {
    return errorResponse(400, 'Filename too long');
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (!ext || !validExtensions.includes(ext)) {
    return errorResponse(400, 'Invalid file extension');
  }

  try {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `profile-photos/${requesterId}/${timestamp}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: PROFILE_PHOTOS_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLengthRange: [0, 5 * 1024 * 1024],
      Metadata: {
        'uploaded-by': requesterId,
        'upload-timestamp': new Date().toISOString()
      }
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300
    });

    const photoUrl = `https://${PROFILE_PHOTOS_BUCKET}.s3.amazonaws.com/${key}`;

    return successResponse({
      uploadUrl,
      photoUrl,
      expiresIn: 300
    });

  } catch (error) {
    console.error('Error generating presigned URL:', { requesterId, error });
    return errorResponse(500, 'Failed to generate upload URL');
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
