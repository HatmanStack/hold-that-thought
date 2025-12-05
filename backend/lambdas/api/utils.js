const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const sanitizeHtml = require('sanitize-html')

// Shared DynamoDB clients
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// Single table name from environment
const TABLE_NAME = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE

// S3 archive bucket (single bucket for all storage)
const ARCHIVE_BUCKET = process.env.ARCHIVE_BUCKET

// S3 prefixes within archive bucket
const S3_PREFIXES = {
  letters: 'letters/',
  media: 'media/',
  profilePhotos: 'profile-photos/',
}

// =============================================================================
// Key Prefixes for Single-Table Design
// =============================================================================
const PREFIX = {
  USER: 'USER#',
  COMMENT: 'COMMENT#',
  CONV: 'CONV#',
  MSG: 'MSG#',
  REACTION: 'REACTION#',
  RATE: 'RATE#',
  LETTER: 'LETTER#',
  VERSION: 'VERSION#',
}

// =============================================================================
// Key Builders
// =============================================================================
const keys = {
  // User profile: PK=USER#<userId>, SK=PROFILE
  userProfile: (userId) => ({
    PK: `${PREFIX.USER}${userId}`,
    SK: 'PROFILE',
  }),

  // User's conversation membership: PK=USER#<userId>, SK=CONV#<convId>
  userConversation: (userId, convId) => ({
    PK: `${PREFIX.USER}${userId}`,
    SK: `${PREFIX.CONV}${convId}`,
  }),

  // Rate limit: PK=USER#<userId>, SK=RATE#<action>
  rateLimit: (userId, action) => ({
    PK: `${PREFIX.USER}${userId}`,
    SK: `${PREFIX.RATE}${action}`,
  }),

  // Comment: PK=COMMENT#<itemId>, SK=<timestamp>#<commentId>
  comment: (itemId, commentId) => ({
    PK: `${PREFIX.COMMENT}${itemId}`,
    SK: commentId, // Already includes timestamp
  }),

  // Comments on item (for queries): PK=COMMENT#<itemId>
  commentsOnItem: (itemId) => ({
    PK: `${PREFIX.COMMENT}${itemId}`,
  }),

  // Reaction: PK=COMMENT#<itemId>, SK=REACTION#<commentId>#<userId>
  reaction: (itemId, commentId, userId) => ({
    PK: `${PREFIX.COMMENT}${itemId}`,
    SK: `${PREFIX.REACTION}${commentId}#${userId}`,
  }),

  // Reactions on comment (for queries): prefix REACTION#<commentId>
  reactionsOnComment: (itemId, commentId) => ({
    PK: `${PREFIX.COMMENT}${itemId}`,
    SKPrefix: `${PREFIX.REACTION}${commentId}#`,
  }),

  // Conversation metadata: PK=CONV#<convId>, SK=META
  conversationMeta: (convId) => ({
    PK: `${PREFIX.CONV}${convId}`,
    SK: 'META',
  }),

  // Message: PK=CONV#<convId>, SK=MSG#<timestamp>#<msgId>
  message: (convId, msgId) => ({
    PK: `${PREFIX.CONV}${convId}`,
    SK: `${PREFIX.MSG}${msgId}`,
  }),

  // Messages in conversation (for queries): PK=CONV#<convId>, SK begins with MSG#
  messagesInConversation: (convId) => ({
    PK: `${PREFIX.CONV}${convId}`,
    SKPrefix: PREFIX.MSG,
  }),

  // Letter: PK=LETTER#<date>, SK=CURRENT
  letter: (date) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SK: 'CURRENT',
  }),

  // Letter versions: PK=LETTER#<date>, SK=VERSION#<timestamp>
  letterVersion: (date, timestamp) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SK: `${PREFIX.VERSION}${timestamp}`,
  }),

  // Query all versions: PK=LETTER#<date>, SK begins_with VERSION#
  letterVersions: (date) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SKPrefix: PREFIX.VERSION,
  }),
}

// =============================================================================
// Rate Limiting
// =============================================================================
const RATE_LIMITS = {
  createComment: { requests: 20, windowSeconds: 60 },
  updateProfile: { requests: 10, windowSeconds: 60 },
  photoUpload: { requests: 5, windowSeconds: 300 },
  sendMessage: { requests: 30, windowSeconds: 60 },
}

async function checkRateLimit(userId, action) {
  if (!TABLE_NAME) return { allowed: true }

  const limit = RATE_LIMITS[action]
  if (!limit) return { allowed: true }

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - limit.windowSeconds
  const key = keys.rateLimit(userId, action)

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    const item = result.Item

    if (item && item.count >= limit.requests && item.windowStart > windowStart) {
      const resetTime = item.windowStart + limit.windowSeconds
      return {
        allowed: false,
        error: `Rate limit exceeded. Try again in ${resetTime - now} seconds`,
        retryAfter: resetTime - now,
      }
    }

    const newCount = (item && item.windowStart > windowStart) ? item.count + 1 : 1
    const newWindowStart = (item && item.windowStart > windowStart) ? item.windowStart : now

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...key,
        entityType: 'RATE_LIMIT',
        count: newCount,
        windowStart: newWindowStart,
        ttl: now + limit.windowSeconds + 3600,
      },
    }))

    return { allowed: true }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return { allowed: true }
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required' }
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
    return { valid: false, error: 'Invalid user ID format' }
  }

  if (userId.length > 100) {
    return { valid: false, error: 'User ID too long' }
  }

  if (!uuidRegex.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' }
  }

  return { valid: true }
}

function validateLimit(limit) {
  const numLimit = parseInt(limit, 10)

  if (isNaN(numLimit) || numLimit < 1) {
    return { valid: false, error: 'Limit must be a positive number' }
  }

  if (numLimit > 100) {
    return { valid: false, error: 'Limit cannot exceed 100' }
  }

  return { valid: true, value: numLimit }
}

function sanitizeText(text, maxLength = 10000) {
  if (!text) return ''
  const cleaned = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()
  return cleaned.slice(0, maxLength)
}

// =============================================================================
// Response Helpers
// =============================================================================
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

function rateLimitResponse(retryAfter, message) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Retry-After': retryAfter.toString(),
    },
    body: JSON.stringify({ error: message }),
  }
}

// =============================================================================
// Auto-create profile for approved users on first request
// =============================================================================
async function ensureProfile(userId, email, groups) {
  if (!userId || !TABLE_NAME) return

  // Only auto-create for ApprovedUsers group
  if (!groups || !groups.includes('ApprovedUsers')) return

  const key = keys.userProfile(userId)

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key,
    }))

    if (result.Item) return // Profile exists

    // Create new profile
    const now = new Date().toISOString()
    const displayName = email?.split('@')[0] || 'User'

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...key,
        entityType: 'USER_PROFILE',
        userId,
        email: email || null,
        displayName,
        profilePhotoUrl: null,
        bio: null,
        familyRelationship: null,
        generation: null,
        familyBranch: null,
        isProfilePrivate: false,
        joinedDate: now,
        createdAt: now,
        updatedAt: now,
        lastActive: now,
        commentCount: 0,
        mediaUploadCount: 0,
        status: 'active',
      },
      ConditionExpression: 'attribute_not_exists(PK)', // Prevent race conditions
    }))

    console.log('Auto-created profile for user:', userId)
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Profile was created by another request, that's fine
      return
    }
    console.error('Error ensuring profile:', error)
  }
}

module.exports = {
  docClient,
  TABLE_NAME,
  ARCHIVE_BUCKET,
  S3_PREFIXES,
  PREFIX,
  keys,
  checkRateLimit,
  ensureProfile,
  validateUserId,
  validateLimit,
  sanitizeText,
  successResponse,
  errorResponse,
  rateLimitResponse,
}
