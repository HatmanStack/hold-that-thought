// @ts-check
/**
 * Comment repository - encapsulates all comment-related database operations
 * @module repositories/comment-repository
 */
const { BaseRepository } = require('./base-repository')
const { keys, PREFIX } = require('../lib/keys')

/**
 * @typedef {Object} Comment
 * @property {string} PK
 * @property {string} SK
 * @property {string} commentId
 * @property {string} itemId
 * @property {string} content
 * @property {string} authorId
 * @property {string} [authorEmail]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 * @property {boolean} [isEdited]
 * @property {boolean} [isDeleted]
 * @property {string} entityType
 */

/**
 * @typedef {Object} CreateCommentInput
 * @property {string} itemId
 * @property {string} content
 * @property {string} authorId
 * @property {string} [authorEmail]
 */

class CommentRepository extends BaseRepository {
  /**
   * List comments for an item
   * @param {string} itemId - The item ID to get comments for
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Max items to return
   * @param {string} [options.lastEvaluatedKey] - Pagination cursor
   * @returns {Promise<import('./base-repository').PaginatedResult>}
   */
  async listByItemId(itemId, options = {}) {
    // Try multiple storage formats for backwards compatibility
    const itemIdVariants = [itemId, encodeURIComponent(itemId)]

    for (const tryItemId of itemIdVariants) {
      const result = await this.query({
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        filterExpression: 'entityType = :entityType AND (attribute_not_exists(isDeleted) OR isDeleted = :false)',
        expressionAttributeValues: {
          ':pk': `${PREFIX.COMMENT}${tryItemId}`,
          ':skPrefix': '20', // Year prefix for timestamp-based sort keys
          ':entityType': 'COMMENT',
          ':false': false,
        },
        limit: options.limit || 50,
        lastEvaluatedKey: options.lastEvaluatedKey,
        scanIndexForward: true,
      })

      if (result.items.length > 0) {
        return result
      }
    }

    return { items: [], lastEvaluatedKey: null, count: 0 }
  }

  /**
   * Get a single comment by ID
   * @param {string} itemId - The item the comment belongs to
   * @param {string} commentId - The comment ID (includes timestamp prefix)
   * @returns {Promise<Comment|null>}
   */
  async getById(itemId, commentId) {
    const key = keys.comment(itemId, commentId)
    return this.getItem(key)
  }

  /**
   * Create a new comment
   * @param {CreateCommentInput} input
   * @returns {Promise<Comment>}
   */
  async create(input) {
    const { itemId, content, authorId, authorEmail } = input
    const timestamp = new Date().toISOString()
    const { v4: uuidv4 } = require('uuid')
    const commentId = `${timestamp}#${uuidv4()}`

    const comment = {
      PK: `${PREFIX.COMMENT}${itemId}`,
      SK: commentId,
      commentId,
      itemId,
      content,
      authorId,
      authorEmail,
      createdAt: timestamp,
      entityType: 'COMMENT',
    }

    await this.putItem(comment)
    return comment
  }

  /**
   * Update a comment's content
   * @param {string} itemId
   * @param {string} commentId
   * @param {string} newContent
   * @param {string} [previousContent] - For edit history
   * @returns {Promise<Comment>}
   */
  async updateContent(itemId, commentId, newContent, previousContent) {
    const key = keys.comment(itemId, commentId)
    const timestamp = new Date().toISOString()

    const updateExpression = previousContent
      ? 'SET content = :content, updatedAt = :updatedAt, isEdited = :true, previousContent = :previousContent'
      : 'SET content = :content, updatedAt = :updatedAt, isEdited = :true'

    const expressionAttributeValues = {
      ':content': newContent,
      ':updatedAt': timestamp,
      ':true': true,
    }

    if (previousContent) {
      expressionAttributeValues[':previousContent'] = previousContent
    }

    return this.updateItem(key, updateExpression, expressionAttributeValues)
  }

  /**
   * Soft delete a comment
   * @param {string} itemId
   * @param {string} commentId
   * @returns {Promise<Comment>}
   */
  async softDelete(itemId, commentId) {
    const key = keys.comment(itemId, commentId)
    const timestamp = new Date().toISOString()

    return this.updateItem(
      key,
      'SET isDeleted = :true, deletedAt = :deletedAt',
      { ':true': true, ':deletedAt': timestamp }
    )
  }

  /**
   * Hard delete a comment (admin only)
   * @param {string} itemId
   * @param {string} commentId
   * @returns {Promise<void>}
   */
  async hardDelete(itemId, commentId) {
    const key = keys.comment(itemId, commentId)
    await this.deleteItem(key)
  }

  /**
   * Get comments by user ID (via GSI)
   * @param {string} userId
   * @param {Object} [options]
   * @returns {Promise<import('./base-repository').PaginatedResult>}
   */
  async listByUserId(userId, options = {}) {
    return this.query({
      indexName: 'GSI1',
      keyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)',
      expressionAttributeValues: {
        ':gsi1pk': `${PREFIX.USER}${userId}`,
        ':prefix': `${PREFIX.COMMENT}`,
      },
      limit: options.limit || 50,
      lastEvaluatedKey: options.lastEvaluatedKey,
      scanIndexForward: false, // Most recent first
    })
  }
}

module.exports = { CommentRepository, commentRepository: new CommentRepository() }
