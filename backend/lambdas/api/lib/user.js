// @ts-check
/**
 * User profile management
 * @module lib/user
 */
const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient, TABLE_NAME } = require('./database')
const { keys } = require('./keys')
const { log } = require('./logger')

/**
 * Auto-create profile for approved users on first request
 * Uses conditional write to prevent race conditions
 * @param {string} userId
 * @param {string|null} email
 * @param {string|string[]} groups
 * @returns {Promise<void>}
 */
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

    log.info('profile_auto_created', { userId })
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Profile was created by another request, that's fine
      return
    }
    log.error('ensure_profile_error', { userId, error: error.message })
  }
}

/**
 * Increment media upload count for a user
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function incrementMediaUploadCount(userId) {
  if (!userId || !TABLE_NAME) return

  const key = keys.userProfile(userId)

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key,
      UpdateExpression: 'ADD mediaUploadCount :inc SET lastActive = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': new Date().toISOString(),
      },
    }))
    log.info('media_upload_count_incremented', { userId })
  } catch (error) {
    log.error('increment_media_upload_error', { userId, error: error.message })
  }
}

module.exports = {
  ensureProfile,
  incrementMediaUploadCount,
}
