const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 } = require('uuid')
const { docClient, TABLE_NAME, PREFIX, keys, ARCHIVE_BUCKET, successResponse, errorResponse } = require('../utils')

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

/**
 * Sign a profile photo URL for private bucket access
 */
async function signPhotoUrl(photoUrl) {
  if (!photoUrl) return null

  // Extract bucket and key from S3 URL
  const match = photoUrl.match(/https:\/\/([^.]+)\.s3\.[^/]+\.amazonaws\.com\/(.+)/)
  if (!match) return photoUrl

  const [, bucket, key] = match
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: 3600 })
}

async function handle(event, context) {
  const { requesterId } = context

  console.log('[messages] handle called:', {
    method: event.httpMethod,
    resource: event.resource,
    path: event.path,
    pathParameters: event.pathParameters,
    requesterId
  })

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  if (method === 'GET' && resource === '/messages/conversations') {
    return await listConversations(requesterId)
  }

  if (method === 'GET' && resource === '/messages/{conversationId}') {
    return await getMessages(event, requesterId)
  }

  if (method === 'POST' && resource === '/messages/conversations') {
    return await createConversation(event, requesterId)
  }

  if (method === 'POST' && resource === '/messages/{conversationId}') {
    return await sendMessage(event, requesterId)
  }

  if (method === 'POST' && resource === '/messages/{conversationId}/upload-url') {
    return await generateUploadUrl(event, requesterId)
  }

  if (method === 'POST' && resource === '/messages/attachments/upload-url') {
    return await generateUploadUrl(event, requesterId)
  }

  if (method === 'PUT' && resource === '/messages/{conversationId}/read') {
    return await markAsRead(event, requesterId)
  }

  if (method === 'DELETE' && resource === '/messages/{conversationId}') {
    return await deleteConversation(event, requesterId)
  }

  if (method === 'DELETE' && resource === '/messages/{conversationId}/{messageId}') {
    console.log('[messages] DELETE route matched, calling deleteMessage')
    return await deleteMessage(event, requesterId)
  }

  console.log('[messages] No route matched, returning 404')
  return errorResponse(404, 'Route not found')
}

async function listConversations(userId) {
  try {
    // Query user's conversation memberships: PK=USER#<userId>, SK begins with CONV#
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.USER}${userId}`,
        ':skPrefix': PREFIX.CONV,
      },
      ScanIndexForward: false,
      Limit: 50,
    }))

    const conversations = (result.Items || [])
      .filter(item => item.entityType === 'CONVERSATION_MEMBER')
      .map(item => ({
        conversationId: item.conversationId,
        conversationType: item.conversationType,
        participantIds: item.participantIds ? Array.from(item.participantIds) : [],
        participantNames: item.participantNames ? Array.from(item.participantNames) : [],
        lastMessageAt: item.lastMessageAt,
        unreadCount: item.unreadCount || 0,
        conversationTitle: item.conversationTitle,
        creatorId: item.creatorId,
      }))

    return successResponse({ conversations })
  } catch (error) {
    console.error('Error listing conversations:', { userId, error })
    throw error
  }
}

async function getMessages(event, userId) {
  const conversationId = event.pathParameters?.conversationId
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter')
  }

  try {
    // Check membership
    const memberCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userConversation(userId, conversationId),
    }))

    if (!memberCheck.Item) {
      return errorResponse(403, 'You are not a participant in this conversation')
    }

    // Query messages: PK=CONV#<convId>, SK begins with MSG#
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.CONV}${conversationId}`,
        ':skPrefix': PREFIX.MSG,
      },
      Limit: limit,
      ScanIndexForward: false,
    }

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString())
    }

    const result = await docClient.send(new QueryCommand(queryParams))

    const messages = await Promise.all(
      (result.Items || [])
        .filter(item => item.entityType === 'MESSAGE')
        .map(async item => {
          // Generate signed URLs for attachments
          const attachmentsWithUrls = await Promise.all(
            (item.attachments || []).map(async attachment => {
              if (attachment.s3Key) {
                const command = new GetObjectCommand({
                  Bucket: ARCHIVE_BUCKET,
                  Key: attachment.s3Key,
                })
                const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
                return { ...attachment, url }
              }
              return attachment
            })
          )

          return {
            messageId: item.messageId,
            conversationId: item.conversationId,
            senderId: item.senderId,
            senderName: item.senderName,
            senderPhotoUrl: await signPhotoUrl(item.senderPhotoUrl),
            messageText: item.messageText,
            attachments: attachmentsWithUrls,
            createdAt: item.createdAt,
          }
        })
    )

    return successResponse({
      messages,
      creatorId: memberCheck.Item.creatorId,
      conversationTitle: memberCheck.Item.conversationTitle,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    })
  } catch (error) {
    console.error('Error getting messages:', { conversationId, userId, error })
    throw error
  }
}

async function createConversation(event, userId) {
  const body = JSON.parse(event.body || '{}')
  const participantIds = body.participantIds || []
  const { messageText, conversationTitle } = body

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return errorResponse(400, 'participantIds must be a non-empty array')
  }

  if (!participantIds.includes(userId)) {
    participantIds.push(userId)
  }

  try {
    const conversationId = participantIds.length === 2
      ? participantIds.sort().join('_')
      : uuidv4()

    const conversationType = participantIds.length === 2 ? 'direct' : 'group'
    const participantNames = await fetchUserNames(participantIds)

    const now = new Date().toISOString()

    // Create membership records for each participant
    const memberRecords = participantIds.map(pid => ({
      PutRequest: {
        Item: {
          ...keys.userConversation(pid, conversationId),
          entityType: 'CONVERSATION_MEMBER',
          conversationId,
          conversationType,
          creatorId: userId,
          participantIds: new Set(participantIds),
          participantNames: new Set(participantNames),
          lastMessageAt: now,
          unreadCount: pid === userId ? 0 : 1,
          conversationTitle: conversationTitle || null,
        },
      },
    }))

    // Add Conversation Meta record
    memberRecords.push({
      PutRequest: {
        Item: {
          ...keys.conversationMeta(conversationId),
          entityType: 'CONVERSATION_META',
          creatorId: userId,
          createdAt: now,
          conversationType,
          participantIds: new Set(participantIds),
          conversationTitle: conversationTitle || null,
        }
      }
    })

    // Batch write memberships and meta
    for (let i = 0; i < memberRecords.length; i += 25) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: memberRecords.slice(i, i + 25) },
      }))
    }

    // Send initial message if provided
    let message = null
    if (messageText) {
      message = await createMessage(conversationId, userId, messageText, participantIds, conversationType)
    }

    return successResponse({ conversationId, conversationType, participantIds, message }, 201)
  } catch (error) {
    console.error('Error creating conversation:', { userId, participantIds, error })
    throw error
  }
}

async function sendMessage(event, userId) {
  const conversationId = event.pathParameters?.conversationId
  const body = JSON.parse(event.body || '{}')
  const { messageText = '', attachments = [] } = body

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter')
  }

  // Require either text or attachments
  const hasText = messageText && typeof messageText === 'string' && messageText.trim().length > 0
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (!hasText && !hasAttachments) {
    return errorResponse(400, 'Message must have text or attachments')
  }

  if (messageText && messageText.length > 5000) {
    return errorResponse(400, 'Message text must be 5000 characters or less')
  }

  try {
    // Check membership
    const memberCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userConversation(userId, conversationId),
    }))

    if (!memberCheck.Item) {
      return errorResponse(403, 'You are not a participant in this conversation')
    }

    const conversation = memberCheck.Item
    const participantIds = Array.from(conversation.participantIds)
    const conversationType = conversation.conversationType

    const message = await createMessage(conversationId, userId, messageText, participantIds, conversationType, attachments)
    await updateConversationMembers(conversationId, userId, participantIds)

    return successResponse(message, 201)
  } catch (error) {
    console.error('Error sending message:', { conversationId, userId, error })
    throw error
  }
}

async function generateUploadUrl(event, userId) {
  const body = JSON.parse(event.body || '{}')
  // Support both fileName and filename for backwards compatibility
  const fileName = body.fileName || body.filename
  const contentType = body.contentType || 'application/octet-stream'

  if (!fileName) {
    return errorResponse(400, 'Missing fileName - received: ' + JSON.stringify(Object.keys(body)))
  }

  try {
    const key = `messages/attachments/${userId}/${uuidv4()}_${fileName}`

    const command = new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
      Key: key,
      ContentType: contentType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })

    return successResponse({ uploadUrl: presignedUrl, s3Key: key, fileName, contentType })
  } catch (error) {
    console.error('Error generating upload URL:', { userId, fileName, error })
    throw error
  }
}

async function markAsRead(event, userId) {
  const conversationId = event.pathParameters?.conversationId

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter')
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.userConversation(userId, conversationId),
      UpdateExpression: 'SET unreadCount = :zero',
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeValues: { ':zero': 0 },
    }))

    return successResponse({ message: 'Conversation marked as read' })
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse(403, 'You are not a member of this conversation')
    }
    console.error('Error marking conversation as read:', { conversationId, userId, error })
    throw error
  }
}

async function deleteConversation(event, userId) {
  const conversationId = decodeURIComponent(event.pathParameters?.conversationId || '')

  if (!conversationId) {
    return errorResponse(400, 'Missing conversationId parameter')
  }

  try {
    // 1. Check if user is the creator
    // We can check the META record or the user's membership record
    // Using META record is more reliable for the source of truth
    const metaKey = keys.conversationMeta(conversationId)
    const metaResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: metaKey,
    }))

    // If no meta record (legacy conversation), check the user's membership to see if they are a participant
    // For legacy, we might restrict deletion or allow if they are the "first" participant?
    // For now, strict check: must have creatorId matching requester
    
    let isCreator = false
    let participantIds = []

    if (metaResult.Item) {
      if (metaResult.Item.creatorId !== userId) {
        return errorResponse(403, 'Only the conversation creator can delete it')
      }
      isCreator = true
      participantIds = Array.from(metaResult.Item.participantIds || [])
    } else {
      // Fallback: Check user membership. If they created it recently (after we added creatorId to member), it might be there.
      const memberResult = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: keys.userConversation(userId, conversationId),
      }))
      
      if (!memberResult.Item) {
        return errorResponse(404, 'Conversation not found')
      }

      if (memberResult.Item.creatorId === userId) {
        isCreator = true
        participantIds = Array.from(memberResult.Item.participantIds || [])
      } else {
        // If it's a legacy conversation without creatorId, we block deletion for safety
        // unless we want to allow participants to "leave" (delete for themselves)?
        // The requirement is "delete the entire message", implying deletion for everyone.
        return errorResponse(403, 'Cannot delete legacy conversation or not the creator')
      }
    }

    // 2. Delete all items
    const deleteOps = []

    // A. Delete User Memberships
    if (participantIds.length > 0) {
      participantIds.forEach(pid => {
        deleteOps.push({
          DeleteRequest: {
            Key: keys.userConversation(pid, conversationId)
          }
        })
      })
    }

    // B. Delete Conversation Meta
    deleteOps.push({
      DeleteRequest: {
        Key: metaKey
      }
    })

    // C. Delete All Messages
    // We need to query all messages first
    let messageItems = []
    let lastEvaluatedKey = undefined

    do {
      const msgs = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `${PREFIX.CONV}${conversationId}`,
          ':skPrefix': PREFIX.MSG,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }))
      
      if (msgs.Items) {
        messageItems = [...messageItems, ...msgs.Items]
      }
      lastEvaluatedKey = msgs.LastEvaluatedKey
    } while (lastEvaluatedKey)

    // Add messages to delete ops
    messageItems.forEach(msg => {
      deleteOps.push({
        DeleteRequest: {
          Key: { PK: msg.PK, SK: msg.SK }
        }
      })
      
      // Also delete attachments from S3 if any
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(att => {
          if (att.s3Key) {
             // Fire and forget S3 delete
             s3Client.send(new DeleteObjectCommand({
               Bucket: ARCHIVE_BUCKET,
               Key: att.s3Key
             })).catch(e => console.warn('Failed to delete attachment', att.s3Key, e))
          }
        })
      }
    })

    // Execute Batch Writes (max 25 items per batch)
    for (let i = 0; i < deleteOps.length; i += 25) {
      const batch = deleteOps.slice(i, i + 25)
      // BatchWriteItem can fail if items are large, but deletes are small (Keys only)
      // UnprocessedItems handling is recommended but skipping for brevity in this iteration unless critical
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch
        }
      }))
    }

    return successResponse({ message: 'Conversation deleted' })

  } catch (error) {
    console.error('Error deleting conversation:', { conversationId, userId, error })
    throw error
  }
}

async function deleteMessage(event, userId) {
  console.log('[deleteMessage] Function called')
  console.log('[deleteMessage] pathParameters:', event.pathParameters)

  // URL decode path parameters - API Gateway may pass them encoded
  const conversationId = decodeURIComponent(event.pathParameters?.conversationId || '')
  const messageId = decodeURIComponent(event.pathParameters?.messageId || '')

  console.log('[deleteMessage] conversationId (decoded):', conversationId)
  console.log('[deleteMessage] messageId (decoded):', messageId)
  console.log('[deleteMessage] userId:', userId)

  if (!conversationId || !messageId) {
    console.log('[deleteMessage] Missing parameters, returning 400')
    return errorResponse(400, 'Missing conversationId or messageId parameter')
  }

  try {
    const messageKey = keys.message(conversationId, messageId)
    console.log('[deleteMessage] Looking up message with key:', messageKey)

    // Get the message to verify ownership and get attachment info
    const messageResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: messageKey,
    }))

    console.log('[deleteMessage] DynamoDB GetCommand result:', messageResult.Item ? 'Found' : 'Not found')

    if (!messageResult.Item) {
      return errorResponse(404, 'Message not found')
    }

    const message = messageResult.Item

    // Only the sender can delete their own message
    if (message.senderId !== userId) {
      return errorResponse(403, 'You can only delete your own messages')
    }

    // Delete attachments from S3 if any
    if (message.attachments && message.attachments.length > 0) {
      await Promise.all(
        message.attachments.map(async attachment => {
          if (attachment.s3Key) {
            try {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: ARCHIVE_BUCKET,
                Key: attachment.s3Key,
              }))
            } catch (e) {
              console.warn('Failed to delete attachment from S3:', attachment.s3Key, e)
            }
          }
        })
      )
    }

    // Delete the message from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys.message(conversationId, messageId),
    }))

    return successResponse({ message: 'Message deleted' })
  } catch (error) {
    console.error('Error deleting message:', { conversationId, messageId, userId, error })
    throw error
  }
}

async function createMessage(conversationId, senderId, messageText, participantIds, conversationType, attachments = []) {
  // Get sender's profile
  const profileResult = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: keys.userProfile(senderId),
  }))

  const senderName = profileResult.Item?.displayName || 'Anonymous'
  const senderPhotoUrl = profileResult.Item?.profilePhotoUrl || null
  const timestamp = new Date().toISOString()
  const messageId = `${timestamp}#${uuidv4()}`

  const message = {
    ...keys.message(conversationId, messageId),
    entityType: 'MESSAGE',
    messageId,
    conversationId,
    senderId,
    senderName,
    senderPhotoUrl,
    messageText,
    attachments,
    createdAt: timestamp,
    conversationType,
    participants: new Set(participantIds),
  }

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: message,
  }))

  // Generate signed URLs for attachments in the response
  const attachmentsWithUrls = await Promise.all(
    attachments.map(async attachment => {
      if (attachment.s3Key) {
        const command = new GetObjectCommand({
          Bucket: ARCHIVE_BUCKET,
          Key: attachment.s3Key,
        })
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
        return { ...attachment, url }
      }
      return attachment
    })
  )

  return {
    messageId,
    conversationId,
    senderId,
    senderName,
    senderPhotoUrl: await signPhotoUrl(senderPhotoUrl),
    messageText,
    attachments: attachmentsWithUrls,
    createdAt: timestamp,
    participants: participantIds,
  }
}

async function updateConversationMembers(conversationId, senderId, participantIds) {
  const now = new Date().toISOString()

  await Promise.all(participantIds.map(participantId => {
    const updateExpression = participantId === senderId
      ? 'SET lastMessageAt = :now'
      : 'SET lastMessageAt = :now ADD unreadCount :one'

    const expressionValues = participantId === senderId
      ? { ':now': now }
      : { ':now': now, ':one': 1 }

    return docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.userConversation(participantId, conversationId),
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues,
    }))
  }))
}

async function fetchUserNames(userIds) {
  if (userIds.length === 0) return []

  const result = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [TABLE_NAME]: {
        Keys: userIds.map(userId => keys.userProfile(userId)),
      },
    },
  }))

  const userMap = {}
  ;(result.Responses?.[TABLE_NAME] || []).forEach(item => {
    // Extract userId from PK (USER#<userId>)
    const userId = item.PK.replace(PREFIX.USER, '')
    userMap[userId] = item.displayName || 'Anonymous'
  })

  return userIds.map(userId => userMap[userId] || 'Anonymous')
}

module.exports = { handle }
