const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { docClient, TABLE_NAME, PREFIX, keys, BUCKETS, checkRateLimit, validateUserId, validateLimit, sanitizeText, successResponse, errorResponse, rateLimitResponse } = require('../utils')

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
    console.log('[signPhotoUrl] URL does not match S3 pattern, returning as-is:', photoUrl)
    return photoUrl // Return as-is if not S3 URL
  }

  const [, bucket, key] = match
  console.log('[signPhotoUrl] Extracted bucket:', bucket, 'key:', key)

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
    console.log('[signPhotoUrl] Generated signed URL length:', signedUrl?.length)
    console.log('[signPhotoUrl] Signed URL has query params:', signedUrl?.includes('?'))
    return signedUrl
  } catch (error) {
    console.error('[signPhotoUrl] Error generating signed URL:', error)
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
  console.log('[getProfile] Called for userId:', userId, 'by requesterId:', requesterId)

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

    console.log('[getProfile] DynamoDB result:', result.Item ? 'Found' : 'Not found')

    if (!result.Item || result.Item.entityType !== 'USER_PROFILE') {
      return errorResponse(404, 'Profile not found')
    }

    const profile = result.Item
    console.log('[getProfile] Profile profilePhotoUrl from DB:', profile.profilePhotoUrl)

    if (profile.isProfilePrivate && userId !== requesterId && !isAdmin) {
      return errorResponse(403, 'This profile is private')
    }

    // Return clean profile object (strip PK/SK)
    // Sign photo URL for private bucket access
    const signedPhotoUrl = await signPhotoUrl(profile.profilePhotoUrl)
    console.log('[getProfile] Signed photo URL:', signedPhotoUrl ? signedPhotoUrl.substring(0, 100) + '...' : null)

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
    })
  } catch (error) {
    console.error('[getProfile] Error fetching profile:', { userId, error })
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
      })
    }

    // Update existing profile
    const updateExpressions = []
    const expressionAttributeNames = {}
    const expressionAttributeValues = {}

    const allowedFields = ['displayName', 'profilePhotoUrl', 'bio', 'familyRelationship', 'generation', 'familyBranch', 'isProfilePrivate', 'contactEmail', 'notifyOnMessage', 'notifyOnComment']

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
    })
  } catch (error) {
    console.error('Error updating profile:', { requesterId, error })
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
    console.error('Error fetching user comments:', { userId, error })
    throw error
  }
}

async function getPhotoUploadUrl(event, requesterId) {
  console.log('getPhotoUploadUrl called', { requesterId, body: event.body, bucket: BUCKETS.profilePhotos })

  const rateLimitCheck = await checkRateLimit(requesterId, 'photoUpload')
  if (!rateLimitCheck.allowed) {
    return rateLimitResponse(rateLimitCheck.retryAfter, rateLimitCheck.error)
  }

  const body = JSON.parse(event.body || '{}')
  const { filename, contentType } = body

  if (!filename || !contentType) {
    console.log('Missing filename or contentType', { filename, contentType })
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

    console.log('Generating presigned URL', { bucket: BUCKETS.profilePhotos, key, contentType })

    const command = new PutObjectCommand({
      Bucket: BUCKETS.profilePhotos,
      Key: key,
      ContentType: contentType,
    })

    // Disable checksum for browser uploads - SDK v3 adds checksums that browsers can't compute
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32']),
    })
    const photoUrl = `https://${BUCKETS.profilePhotos}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${key}`

    console.log('Presigned URL generated successfully', { photoUrl })
    return successResponse({ uploadUrl, photoUrl, expiresIn: 300 })
  } catch (error) {
    console.error('Error generating presigned URL:', { requesterId, error: error.message, stack: error.stack })
    return errorResponse(500, 'Failed to generate upload URL')
  }
}

async function listUsers(requesterId) {
  try {
    // Scan for all user profiles (in production, consider pagination)
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :type AND #status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':type': 'USER_PROFILE',
        ':active': 'active',
      },
      Limit: 100,
    }))

    const users = await Promise.all((result.Items || []).map(async user => {
      let photoUrl = null
      try {
        photoUrl = await signPhotoUrl(user.profilePhotoUrl)
      } catch (e) {
        console.error('Error signing photo URL for user:', user.userId, e)
      }
      return {
        userId: user.userId,
        displayName: user.displayName || 'Anonymous',
        profilePhotoUrl: photoUrl,
      }
    }))

    return successResponse({ items: users })
  } catch (error) {
    console.error('Error listing users:', { requesterId, error })
    throw error
  }
}

module.exports = { handle }
