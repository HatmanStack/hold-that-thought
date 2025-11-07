const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONVERSATION_MEMBERS_TABLE = process.env.CONVERSATION_MEMBERS_TABLE;
const BUCKET_NAME = process.env.BUCKET_NAME;

/**
 * Lambda handler for Messages API
 */
exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));

    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return errorResponse(401, 'Unauthorized: Missing user context');
    }

    const method = event.httpMethod;
    const resource = event.resource;

    // GET /messages/conversations
    if (method === 'GET' && resource === '/messages/conversations') {
      return await listConversations(userId);
    }

    // GET /messages/conversations/{conversationId}
    if (method === 'GET' && resource === '/messages/conversations/{conversationId}') {
      return await getMessages(event, userId);
    }

    // POST /messages/conversations
    if (method === 'POST' && resource === '/messages/conversations') {
      return await createConversation(event, userId);
    }

    // POST /messages/conversations/{conversationId}
    if (method === 'POST' && resource === '/messages/conversations/{conversationId}') {
      return await sendMessage(event, userId);
    }

    // POST /messages/upload
    if (method === 'POST' && resource === '/messages/upload') {
      return await generateUploadUrl(event, userId);
    }

    // PUT /messages/conversations/{conversationId}/read
    if (method === 'PUT' && resource === '/messages/conversations/{conversationId}/read') {
      return await markAsRead(event, userId);
    }

    return errorResponse(404, 'Route not found');

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * GET /messages/conversations - List user's conversations
 */
async function listConversations(userId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONVERSATION_MEMBERS_TABLE,
      IndexName: 'RecentConversationsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false, // Most recent first
      Limit: 50
    }));

    return successResponse({
      conversations: result.Items || []
    });

  } catch (error) {
    console.error('Error listing conversations:', { userId, error });
    throw error;
  }
}

/**
 * GET /messages/conversations/{conversationId} - Get messages in conversation
 */
async function getMessages(event, userId) {
  const conversationId = event.pathParameters?.conversationId;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey;

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter');
  }

  try {
    // Check if user is participant
    const memberCheck = await docClient.send(new GetCommand({
      TableName: CONVERSATION_MEMBERS_TABLE,
      Key: { userId, conversationId }
    }));

    if (!memberCheck.Item) {
      return errorResponse(403, 'You are not a participant in this conversation');
    }

    // Query messages
    const queryParams = {
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString());
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    return successResponse({
      messages: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null
    });

  } catch (error) {
    console.error('Error getting messages:', { conversationId, userId, error });
    throw error;
  }
}

/**
 * POST /messages/conversations - Create new conversation
 */
async function createConversation(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const participantIds = body.participantIds || [];
  const messageText = body.messageText;
  const conversationTitle = body.conversationTitle;

  // Validate
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return errorResponse(400, 'participantIds must be a non-empty array');
  }

  // Include sender in participants
  if (!participantIds.includes(userId)) {
    participantIds.push(userId);
  }

  try {
    // Generate conversationId
    const conversationId = participantIds.length === 2
      ? participantIds.sort().join('#') // 1-on-1: sorted user IDs
      : uuidv4(); // Group: UUID

    const conversationType = participantIds.length === 2 ? 'direct' : 'group';

    // Fetch participant names
    const participantNames = await fetchUserNames(participantIds);

    // Create ConversationMembers records
    const now = new Date().toISOString();
    const memberRecords = participantIds.map(pid => ({
      PutRequest: {
        Item: {
          userId: pid,
          conversationId,
          conversationType,
          participantIds: new Set(participantIds),
          participantNames: new Set(participantNames),
          lastMessageAt: now,
          unreadCount: pid === userId ? 0 : 1, // Sender has 0 unread
          conversationTitle: conversationTitle || null
        }
      }
    }));

    // Batch write members (max 25 items per batch)
    for (let i = 0; i < memberRecords.length; i += 25) {
      const batch = memberRecords.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [CONVERSATION_MEMBERS_TABLE]: batch
        }
      }));
    }

    // Send initial message if provided
    let message = null;
    if (messageText) {
      message = await createMessage(conversationId, userId, messageText, participantIds, conversationType);
    }

    return successResponse({
      conversationId,
      conversationType,
      participantIds,
      message
    }, 201);

  } catch (error) {
    console.error('Error creating conversation:', { userId, participantIds, error });
    throw error;
  }
}

/**
 * POST /messages/conversations/{conversationId} - Send message
 */
async function sendMessage(event, userId) {
  const conversationId = event.pathParameters?.conversationId;
  const body = JSON.parse(event.body || '{}');
  const messageText = body.messageText;
  const attachments = body.attachments || [];

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter');
  }

  if (!messageText || typeof messageText !== 'string') {
    return errorResponse(400, 'Missing or invalid messageText');
  }

  if (messageText.length > 5000) {
    return errorResponse(400, 'Message text must be 5000 characters or less');
  }

  try {
    // Check if user is participant
    const memberCheck = await docClient.send(new GetCommand({
      TableName: CONVERSATION_MEMBERS_TABLE,
      Key: { userId, conversationId }
    }));

    if (!memberCheck.Item) {
      return errorResponse(403, 'You are not a participant in this conversation');
    }

    const conversation = memberCheck.Item;
    const participantIds = Array.from(conversation.participantIds);
    const conversationType = conversation.conversationType;

    // Create message
    const message = await createMessage(conversationId, userId, messageText, participantIds, conversationType, attachments);

    // Update ConversationMembers
    await updateConversationMembers(conversationId, userId, participantIds);

    return successResponse(message, 201);

  } catch (error) {
    console.error('Error sending message:', { conversationId, userId, error });
    throw error;
  }
}

/**
 * POST /messages/upload - Generate presigned URL for attachment upload
 */
async function generateUploadUrl(event, userId) {
  const body = JSON.parse(event.body || '{}');
  const fileName = body.fileName;
  const contentType = body.contentType || 'application/octet-stream';

  if (!fileName) {
    return errorResponse(400, 'Missing fileName');
  }

  try {
    const key = `messages/attachments/${userId}/${uuidv4()}_${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

    return successResponse({
      uploadUrl: presignedUrl,
      s3Key: key,
      fileName,
      contentType
    });

  } catch (error) {
    console.error('Error generating upload URL:', { userId, fileName, error });
    throw error;
  }
}

/**
 * PUT /messages/conversations/{conversationId}/read - Mark conversation as read
 */
async function markAsRead(event, userId) {
  const conversationId = event.pathParameters?.conversationId;

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter');
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: CONVERSATION_MEMBERS_TABLE,
      Key: { userId, conversationId },
      UpdateExpression: 'SET unreadCount = :zero',
      ExpressionAttributeValues: {
        ':zero': 0
      }
    }));

    return successResponse({ message: 'Conversation marked as read' });

  } catch (error) {
    console.error('Error marking conversation as read:', { conversationId, userId, error });
    throw error;
  }
}

/**
 * Helper: Create message record
 */
async function createMessage(conversationId, senderId, messageText, participantIds, conversationType, attachments = []) {
  // Fetch sender name
  const profileResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { userId: senderId }
  }));

  const senderName = profileResult.Item?.displayName || 'Anonymous';

  const messageId = `${new Date().toISOString()}#${uuidv4()}`;

  const message = {
    conversationId,
    messageId,
    senderId,
    senderName,
    messageText,
    attachments,
    createdAt: new Date().toISOString(),
    conversationType,
    participants: new Set(participantIds)
  };

  await docClient.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item: message
  }));

  // Convert Set to Array for JSON serialization
  return {
    ...message,
    participants: participantIds
  };
}

/**
 * Helper: Update conversation members with new message timestamp and unread counts
 */
async function updateConversationMembers(conversationId, senderId, participantIds) {
  const now = new Date().toISOString();

  // Use Promise.all for parallel updates instead of sequential loop
  const updatePromises = participantIds.map(participantId => {
    if (participantId === senderId) {
      // Sender: just update lastMessageAt
      return docClient.send(new UpdateCommand({
        TableName: CONVERSATION_MEMBERS_TABLE,
        Key: { userId: participantId, conversationId },
        UpdateExpression: 'SET lastMessageAt = :now',
        ExpressionAttributeValues: {
          ':now': now
        }
      }));
    } else {
      // Recipients: update lastMessageAt and increment unreadCount
      return docClient.send(new UpdateCommand({
        TableName: CONVERSATION_MEMBERS_TABLE,
        Key: { userId: participantId, conversationId },
        UpdateExpression: 'SET lastMessageAt = :now ADD unreadCount :one',
        ExpressionAttributeValues: {
          ':now': now,
          ':one': 1
        }
      }));
    }
  });

  await Promise.all(updatePromises);
}

/**
 * Helper: Fetch user display names
 */
async function fetchUserNames(userIds) {
  if (userIds.length === 0) {
    return [];
  }

  // Use BatchGetCommand for parallel reads instead of sequential loop
  const result = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [USER_PROFILES_TABLE]: {
        Keys: userIds.map(userId => ({ userId }))
      }
    }
  }));

  // Create a map of userId to displayName for quick lookup
  const userMap = {};
  (result.Responses?.[USER_PROFILES_TABLE] || []).forEach(item => {
    userMap[item.userId] = item.displayName || 'Anonymous';
  });

  // Return names in the same order as userIds
  return userIds.map(userId => userMap[userId] || 'Anonymous');
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
