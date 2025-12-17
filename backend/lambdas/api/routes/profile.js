const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { docClient, TABLE_NAME, PREFIX, keys, ARCHIVE_BUCKET, checkRateLimit, validateUserId, validateLimit, sanitizeText, successResponse, errorResponse, rateLimitResponse } = require('../utils')
const { log } = require('../lib/logger')

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  // Disable checksums for presigned URLs - browsers can't compute them
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

/**
 * Convert S3 URL to presigned URL for private bucket access
 */
async function signPhotoUrl(photoUrl) {
  if (!photoUrl) return null

  // Extract bucket and key from S3 URL
  // Format: https://bucket.s3.region.amazonaws.com/key
  const match = photoUrl.match(/https:\/\/([^.]+)\.s3\.[^/]+\.amazonaws\.com\/(.+)/)
  if (!match) {
    log.debug('sign_photo_url_skip', { reason: 'not_s3_pattern', url: photoUrl })
    return photoUrl // Return as-is if not S3 URL
  }

  const [, bucket, key] = match
  log.debug('sign_photo_url', { bucket, key })

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
    log.debug('sign_photo_url_success', { urlLength: signedUrl?.length })
    return signedUrl
  } catch (error) {
    log.error('sign_photo_url_failed', { bucket, key, error: error.message })
    return photoUrl // Fall back to original URL
  }
}

async function handle(event, context) {
  const { requesterId, requesterEmail, isAdmin } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  if (method === 'GET' && resource === '/profile/{userId}') {
    return await getProfile(event, requesterId, isAdmin)
  }

  if (method === 'PUT' && resource === '/profile') {
    return await updateProfile(event, requesterId, requesterEmail)
  }

  if (method === 'GET' && resource === '/profile/{userId}/comments') {
    return await getUserComments(event, requesterId, isAdmin)
  }

  if (method === 'POST' && resource === '/profile/photo/upload-url') {
    return await getPhotoUploadUrl(event, requesterId)
  }

  if (method === 'GET' && resource === '/users') {
    return await listUsers(requesterId)
  }

  return errorResponse(404, 'Route not found')
}

async function getProfile(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId
  log.info('get_profile', { userId, requesterId })

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter')
  }

  const validation = validateUserId(userId)
  if (!validation.valid) {
    return errorResponse(400, validation.error)
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userProfile(userId),
    }))

    log.debug('get_profile_result', { found: !!result.Item })

    if (!result.Item || result.Item.entityType !== 'USER_PROFILE') {
      return errorResponse(404, 'Profile not found')
    }

    const profile = result.Item
    log.debug('get_profile_photo', { hasPhoto: !!profile.profilePhotoUrl })

    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private')
    }

    // Return clean profile object (strip PK/SK)
    // Sign photo URL for private bucket access
    const signedPhotoUrl = await signPhotoUrl(profile.profilePhotoUrl)

    return successResponse({
      userId: profile.userId,
      email: profile.email,
      displayName: profile.displayName,
      profilePhotoUrl: signedPhotoUrl,
      bio: profile.bio,
      familyRelationship: profile.familyRelationship,
      generation: profile.generation,
      familyBranch: profile.familyBranch,
      isProfilePrivate: profile.isProfilePrivate,
      joinedDate: profile.joinedDate,
      lastActive: profile.lastActive,
      commentCount: profile.commentCount || 0,
      mediaUploadCount: profile.mediaUploadCount || 0,
      contactEmail: profile.contactEmail,
      notifyOnMessage: profile.notifyOnMessage !== false,
      notifyOnComment: profile.notifyOnComment !== false,
      theme: profile.theme || null,
      familyRelationships: profile.familyRelationships || [],
    })
  } catch (error) {
    log.error('get_profile_failed', { userId, error: error.message })
    throw error
  }
}

async function updateProfile(event, requesterId, requesterEmail) {
  const rateLimitCheck = await checkRateLimit(requesterId, 'updateProfile')
  if (!rateLimitCheck.allowed) {
    return rateLimitResponse(rateLimitCheck.retryAfter, rateLimitCheck.error)
  }

  const body = JSON.parse(event.body || '{}')

  // Sanitize inputs (no limit on bio - let people write their life stories)
  if (body.bio) body.bio = sanitizeText(body.bio)
  if (body.displayName) body.displayName = sanitizeText(body.displayName, 100)
  if (body.familyRelationship) body.familyRelationship = sanitizeText(body.familyRelationship, 100)

  // Validate theme if provided (must be a non-empty string, max 50 chars, alphanumeric/hyphen only)
  if (body.theme !== undefined) {
    if (typeof body.theme !== 'string' || body.theme.length > 50 || !/^[a-z0-9-]+$/.test(body.theme)) {
      return errorResponse(400, 'Invalid theme value')
    }
  }

  // Validate and sanitize familyRelationships if provided
  if (body.familyRelationships !== undefined) {
    if (!Array.isArray(body.familyRelationships)) {
      return errorResponse(400, 'familyRelationships must be an array')
    }

    const now = new Date().toISOString()
    for (let i = 0; i < body.familyRelationships.length; i++) {
      const rel = body.familyRelationships[i]

      // Validate required fields
      if (!rel.id || typeof rel.id !== 'string') {
        return errorResponse(400, `Relationship at index ${i} is missing required field: id`)
      }
      if (!rel.type || typeof rel.type !== 'string') {
        return errorResponse(400, `Relationship at index ${i} is missing required field: type`)
      }
      if (!rel.name || typeof rel.name !== 'string') {
        return errorResponse(400, `Relationship at index ${i} is missing required field: name`)
      }

      // Sanitize text fields
      rel.name = sanitizeText(rel.name, 200)
      if (rel.customType) {
        rel.customType = sanitizeText(rel.customType, 100)
      }

      // Generate createdAt if missing
      if (!rel.createdAt) {
        rel.createdAt = now
      }
    }
  }

  const errors = []
  if (body.displayName && body.displayName.length > 100) errors.push('Display name must be 100 characters or less')
  if (body.familyRelationship && body.familyRelationship.length > 100) errors.push('Family relationship must be 100 characters or less')

  if (errors.length > 0) {
    return errorResponse(400, errors.join(', '))
  }

  try {
    // Check if profile exists
    const existingProfile = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userProfile(requesterId),
    }))

    const now = new Date().toISOString()

    if (!existingProfile.Item) {
      // Create new profile
      const newProfile = {
        ...keys.userProfile(requesterId),
        entityType: 'USER_PROFILE',
        userId: requesterId,
        email: requesterEmail,
        displayName: body.displayName || requesterEmail?.split('@')[0] || 'Anonymous',
        profilePhotoUrl: body.profilePhotoUrl || null,
        bio: body.bio || null,
        familyRelationship: body.familyRelationship || null,
        generation: body.generation || null,
        familyBranch: body.familyBranch || null,
        isProfilePrivate: body.isProfilePrivate || false,
        contactEmail: body.contactEmail || null,
        notifyOnMessage: body.notifyOnMessage !== false,
        notifyOnComment: body.notifyOnComment !== false,
        theme: body.theme || null,
        familyRelationships: body.familyRelationships || [],
        joinedDate: now,
        createdAt: now,
        updatedAt: now,
        lastActive: now,
        commentCount: 0,
        mediaUploadCount: 0,
        status: 'active',
      }

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newProfile,
      }))

      return successResponse({
        userId: requesterId,
        displayName: newProfile.displayName,
        email: newProfile.email,
        profilePhotoUrl: newProfile.profilePhotoUrl,
        bio: newProfile.bio,
        familyRelationship: newProfile.familyRelationship,
        joinedDate: newProfile.joinedDate,
        theme: newProfile.theme,
        familyRelationships: newProfile.familyRelationships,
      })
    }

    // Update existing profile
    const updateExpressions = []
    const expressionAttributeNames = {}
    const expressionAttributeValues = {}

    const allowedFields = ['displayName', 'profilePhotoUrl', 'bio', 'familyRelationship', 'generation', 'familyBranch', 'isProfilePrivate', 'contactEmail', 'notifyOnMessage', 'notifyOnComment', 'theme', 'familyRelationships']

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`)
        expressionAttributeNames[`#${field}`] = field
        expressionAttributeValues[`:${field}`] = body[field]
      }
    })

    updateExpressions.push('#updatedAt = :updatedAt', '#lastActive = :lastActive')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeNames['#lastActive'] = 'lastActive'
    expressionAttributeValues[':updatedAt'] = now
    expressionAttributeValues[':lastActive'] = now

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.userProfile(requesterId),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }))

    const updated = result.Attributes
    return successResponse({
      userId: updated.userId,
      displayName: updated.displayName,
      email: updated.email,
      profilePhotoUrl: updated.profilePhotoUrl,
      bio: updated.bio,
      familyRelationship: updated.familyRelationship,
      isProfilePrivate: updated.isProfilePrivate,
      familyRelationships: updated.familyRelationships || [],
    })
  } catch (error) {
    log.error('update_profile_failed', { requesterId, error: error.message })
    throw error
  }
}

async function getUserComments(event, requesterId, isAdmin) {
  const userId = event.pathParameters?.userId
  const limitParam = event.queryStringParameters?.limit || '50'
  const lastEvaluatedKeyParam = event.queryStringParameters?.lastEvaluatedKey

  if (!userId) {
    return errorResponse(400, 'Missing userId parameter')
  }

  const userIdValidation = validateUserId(userId)
  if (!userIdValidation.valid) {
    return errorResponse(400, userIdValidation.error)
  }

  const limitValidation = validateLimit(limitParam)
  if (!limitValidation.valid) {
    return errorResponse(400, limitValidation.error)
  }

  try {
    // Check if profile is private
    const profileResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.userProfile(userId),
    }))

    if (!profileResult.Item) {
      return errorResponse(404, 'Profile not found')
    }

    if (profileResult.Item.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private')
    }

    // Query user's comments via GSI1
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.USER}${userId}`,
        ':skPrefix': PREFIX.COMMENT,
      },
      Limit: limitValidation.value,
      ScanIndexForward: false,
    }

    if (lastEvaluatedKeyParam) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKeyParam, 'base64').toString())
      } catch {
        return errorResponse(400, 'Invalid pagination key')
      }
    }

    const result = await docClient.send(new QueryCommand(queryParams))

    const comments = (result.Items || [])
      .filter(item => !item.isDeleted)
      .map(item => ({
        itemId: item.itemId,
        commentId: item.SK,
        commentText: item.commentText,
        createdAt: item.createdAt,
        itemType: item.itemType,
        itemTitle: item.itemTitle,
        reactionCount: item.reactionCount || 0,
      }))

    return successResponse({
      items: comments,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    })
  } catch (error) {
    log.error('get_user_comments_failed', { userId, error: error.message })
    throw error
  }
}

async function getPhotoUploadUrl(event, requesterId) {
  log.info('get_photo_upload_url', { requesterId, bucket: ARCHIVE_BUCKET })

  const rateLimitCheck = await checkRateLimit(requesterId, 'photoUpload')
  if (!rateLimitCheck.allowed) {
    return rateLimitResponse(rateLimitCheck.retryAfter, rateLimitCheck.error)
  }

  const body = JSON.parse(event.body || '{}')
  const { filename, contentType } = body

  if (!filename || !contentType) {
    log.warn('photo_upload_missing_params', { filename: !!filename, contentType: !!contentType })
    return errorResponse(400, 'Filename and contentType are required')
  }

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedImageTypes.includes(contentType)) {
    return errorResponse(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed')
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return errorResponse(400, 'Invalid filename')
  }

  const ext = filename.split('.').pop()?.toLowerCase()
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  if (!ext || !validExtensions.includes(ext)) {
    return errorResponse(400, 'Invalid file extension')
  }

  try {
    const timestamp = Date.now()
    const sanitizedFilename = filename.replace(/[^\w.-]/g, '_')
    const key = `profile-photos/${requesterId}/${timestamp}-${sanitizedFilename}`

    log.debug('generating_presigned_url', { bucket: ARCHIVE_BUCKET, key, contentType })

    const command = new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
      Key: key,
      ContentType: contentType,
    })

    // Disable checksum for browser uploads - SDK v3 adds checksums that browsers can't compute
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32']),
    })
    const photoUrl = `https://${ARCHIVE_BUCKET}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${key}`

    log.info('presigned_url_generated', { photoUrl })
    return successResponse({ uploadUrl, photoUrl, expiresIn: 300 })
  } catch (error) {
    log.error('presigned_url_failed', { requesterId, error: error.message })
    return errorResponse(500, 'Failed to generate upload URL')
  }
}

/**
 * Batch sign multiple photo URLs in parallel
 * Returns a Map of originalUrl -> signedUrl
 */
async function batchSignUrls(urls) {
  const signedMap = new Map()
  const uniqueUrls = [...new Set(urls.filter(Boolean))]

  await Promise.all(uniqueUrls.map(async url => {
    try {
      signedMap.set(url, await signPhotoUrl(url))
    } catch (e) {
      log.error('batch_sign_url_failed', { url, error: e.message })
      signedMap.set(url, null)
    }
  }))

  return signedMap
}

async function listUsers(requesterId) {
  try {
    log.info('list_users_start', { requesterId, tableName: TABLE_NAME })

    // Scan for all user profiles - collect all pages since filter happens server-side
    // and Limit applies to items scanned, not items returned
    let allItems = []
    let lastEvaluatedKey = undefined

    do {
      const scanParams = {
        TableName: TABLE_NAME,
        FilterExpression: 'entityType = :type',
        ExpressionAttributeValues: {
          ':type': 'USER_PROFILE',
        },
      }
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey
      }

      const scanResult = await docClient.send(new ScanCommand(scanParams))
      allItems = allItems.concat(scanResult.Items || [])
      lastEvaluatedKey = scanResult.LastEvaluatedKey

      log.debug('list_users_scan_page', {
        pageItems: scanResult.Items?.length || 0,
        totalSoFar: allItems.length,
        hasMore: !!lastEvaluatedKey,
      })
    } while (lastEvaluatedKey && allItems.length < 500) // Safety cap at 500 users

    const result = { Items: allItems, ScannedCount: allItems.length }

    log.info('list_users_scan_result', {
      itemCount: result.Items?.length || 0,
      scannedCount: result.ScannedCount,
      items: result.Items?.map(u => ({ userId: u.userId, status: u.status, displayName: u.displayName })),
    })

    // Filter in code: exclude inactive/deleted users (handles missing status field)
    // Also exclude the requester (can't message yourself)
    const activeItems = (result.Items || []).filter(user =>
      user.status !== 'inactive' && user.status !== 'deleted' && user.userId !== requesterId
    )

    log.info('list_users_after_filter', {
      activeCount: activeItems.length,
      filteredOut: (result.Items?.length || 0) - activeItems.length,
      requesterId,
    })

    // Batch sign all photo URLs (deduped for efficiency)
    const photoUrls = activeItems.map(u => u.profilePhotoUrl)
    const signedUrls = await batchSignUrls(photoUrls)

    // Map results with email included for search/display
    const users = activeItems.map(user => ({
      userId: user.userId,
      displayName: user.displayName || 'Anonymous',
      email: user.email || '',
      profilePhotoUrl: signedUrls.get(user.profilePhotoUrl) || null,
    }))

    return successResponse({ items: users })
  } catch (error) {
    log.error('list_users_failed', { requesterId, error: error.message })
    throw error
  }
}

module.exports = { handle }
