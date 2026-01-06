// @ts-check
/**
 * User/Profile repository - encapsulates all user-related database operations
 * @module repositories/user-repository
 */
const { BaseRepository } = require('./base-repository')
const { keys, PREFIX } = require('../lib/keys')

/**
 * @typedef {Object} UserProfile
 * @property {string} PK
 * @property {string} SK
 * @property {string} userId
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {string} [bio]
 * @property {string} [photoUrl]
 * @property {string} [photoKey]
 * @property {boolean} [isPrivate]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 * @property {string} entityType
 */

/**
 * @typedef {Object} CreateProfileInput
 * @property {string} userId
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {string} [groups]
 */

class UserRepository extends BaseRepository {
  /**
   * Get a user profile by ID
   * @param {string} userId
   * @returns {Promise<UserProfile|null>}
   */
  async getProfile(userId) {
    const key = keys.userProfile(userId)
    return this.getItem(key)
  }

  /**
   * Create or update a user profile (upsert)
   * @param {CreateProfileInput} input
   * @returns {Promise<UserProfile>}
   */
  async createProfile(input) {
    const { userId, email, displayName, groups } = input
    const timestamp = new Date().toISOString()

    const profile = {
      PK: `${PREFIX.USER}${userId}`,
      SK: 'PROFILE',
      userId,
      email,
      displayName: displayName || email?.split('@')[0] || 'User',
      groups,
      createdAt: timestamp,
      updatedAt: timestamp,
      entityType: 'USER_PROFILE',
    }

    await this.putItem(profile, {
      conditionExpression: 'attribute_not_exists(PK)',
      expressionAttributeValues: {},
    }).catch((err) => {
      // Profile already exists, that's fine
      if (err.name !== 'ConditionalCheckFailedException') {
        throw err
      }
    })

    return profile
  }

  /**
   * Update profile fields
   * @param {string} userId
   * @param {Partial<UserProfile>} updates
   * @returns {Promise<UserProfile>}
   */
  async updateProfile(userId, updates) {
    const key = keys.userProfile(userId)
    const timestamp = new Date().toISOString()

    const updateParts = ['updatedAt = :updatedAt']
    const expressionAttributeValues = { ':updatedAt': timestamp }
    const expressionAttributeNames = {}

    for (const [field, value] of Object.entries(updates)) {
      if (['PK', 'SK', 'userId', 'entityType', 'createdAt'].includes(field)) {
        continue // Skip immutable fields
      }

      const placeholder = `:${field}`
      const namePlaceholder = `#${field}`

      // Handle reserved words
      if (['name', 'status'].includes(field)) {
        expressionAttributeNames[namePlaceholder] = field
        updateParts.push(`${namePlaceholder} = ${placeholder}`)
      } else {
        updateParts.push(`${field} = ${placeholder}`)
      }

      expressionAttributeValues[placeholder] = value
    }

    return this.updateItem(
      key,
      `SET ${updateParts.join(', ')}`,
      expressionAttributeValues,
      { expressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined }
    )
  }

  /**
   * Get multiple profiles by user IDs
   * @param {string[]} userIds
   * @returns {Promise<UserProfile[]>}
   */
  async getProfiles(userIds) {
    if (userIds.length === 0) return []

    const uniqueIds = [...new Set(userIds)]
    const profileKeys = uniqueIds.map(userId => keys.userProfile(userId))

    return this.batchGetItems(profileKeys)
  }

  /**
   * List all user profiles (for user directory)
   * @param {Object} [options]
   * @returns {Promise<import('./base-repository').PaginatedResult>}
   */
  async listProfiles(options = {}) {
    // Note: This requires a GSI on entityType or a scan
    // For now, use a scan with filter (acceptable for small user base)
    return this.query({
      indexName: 'GSI1',
      keyConditionExpression: 'GSI1PK = :entityType',
      expressionAttributeValues: {
        ':entityType': 'USERS',
      },
      limit: options.limit || 100,
      lastEvaluatedKey: options.lastEvaluatedKey,
    })
  }

  /**
   * Check if profile exists
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async exists(userId) {
    const profile = await this.getProfile(userId)
    return profile !== null
  }
}

module.exports = { UserRepository, userRepository: new UserRepository() }
