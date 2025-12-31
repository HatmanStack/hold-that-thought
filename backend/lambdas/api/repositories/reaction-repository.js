// @ts-check
/**
 * Reaction repository - encapsulates all reaction-related database operations
 * @module repositories/reaction-repository
 */
const { BaseRepository } = require('./base-repository')
const { keys, PREFIX } = require('../lib/keys')

/**
 * @typedef {Object} Reaction
 * @property {string} PK
 * @property {string} SK
 * @property {string} itemId
 * @property {string} commentId
 * @property {string} userId
 * @property {string} emoji
 * @property {string} createdAt
 * @property {string} entityType
 */

class ReactionRepository extends BaseRepository {
  /**
   * Add a reaction to a comment
   * @param {string} itemId - The item the comment belongs to
   * @param {string} commentId - The comment ID
   * @param {string} userId - The user adding the reaction
   * @param {string} emoji - The emoji reaction
   * @returns {Promise<Reaction>}
   */
  async addReaction(itemId, commentId, userId, emoji) {
    const timestamp = new Date().toISOString()
    const key = keys.reaction(itemId, commentId, userId)

    const reaction = {
      ...key,
      itemId,
      commentId,
      userId,
      emoji,
      createdAt: timestamp,
      entityType: 'REACTION',
    }

    await this.putItem(reaction)
    return reaction
  }

  /**
   * Remove a reaction from a comment
   * @param {string} itemId
   * @param {string} commentId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async removeReaction(itemId, commentId, userId) {
    const key = keys.reaction(itemId, commentId, userId)
    await this.deleteItem(key)
  }

  /**
   * Get a user's reaction on a comment
   * @param {string} itemId
   * @param {string} commentId
   * @param {string} userId
   * @returns {Promise<Reaction|null>}
   */
  async getUserReaction(itemId, commentId, userId) {
    const key = keys.reaction(itemId, commentId, userId)
    return this.getItem(key)
  }

  /**
   * List all reactions on a comment
   * @param {string} itemId
   * @param {string} commentId
   * @returns {Promise<Reaction[]>}
   */
  async listByCommentId(itemId, commentId) {
    const { SKPrefix } = keys.reactionsOnComment(itemId, commentId)

    const result = await this.query({
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      expressionAttributeValues: {
        ':pk': `${PREFIX.COMMENT}${itemId}`,
        ':skPrefix': SKPrefix,
      },
      limit: 100,
    })

    return result.items
  }

  /**
   * Get reaction counts grouped by emoji
   * @param {string} itemId
   * @param {string} commentId
   * @returns {Promise<Record<string, number>>}
   */
  async getReactionCounts(itemId, commentId) {
    const reactions = await this.listByCommentId(itemId, commentId)

    const counts = {}
    for (const reaction of reactions) {
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1
    }

    return counts
  }

  /**
   * Check if user has reacted to a comment
   * @param {string} itemId
   * @param {string} commentId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasReacted(itemId, commentId, userId) {
    const reaction = await this.getUserReaction(itemId, commentId, userId)
    return reaction !== null
  }
}

module.exports = { ReactionRepository, reactionRepository: new ReactionRepository() }
