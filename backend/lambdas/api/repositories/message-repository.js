// @ts-check
/**
 * Message repository - encapsulates all messaging-related database operations
 * @module repositories/message-repository
 */
const { BaseRepository } = require('./base-repository')
const { keys, PREFIX } = require('../lib/keys')
const { v4: uuidv4 } = require('uuid')

/**
 * @typedef {Object} Conversation
 * @property {string} PK
 * @property {string} SK
 * @property {string} conversationId
 * @property {string[]} participants
 * @property {string} createdAt
 * @property {string} [lastMessageAt]
 * @property {string} [lastMessagePreview]
 * @property {string} entityType
 */

/**
 * @typedef {Object} Message
 * @property {string} PK
 * @property {string} SK
 * @property {string} messageId
 * @property {string} conversationId
 * @property {string} senderId
 * @property {string} content
 * @property {string} createdAt
 * @property {string} [attachmentKey]
 * @property {string} [attachmentType]
 * @property {boolean} [isDeleted]
 * @property {string} entityType
 */

class MessageRepository extends BaseRepository {
  /**
   * Create a new conversation
   * @param {string[]} participants - User IDs of participants
   * @returns {Promise<Conversation>}
   */
  async createConversation(participants) {
    const conversationId = uuidv4()
    const timestamp = new Date().toISOString()

    const conversation = {
      PK: `${PREFIX.CONV}${conversationId}`,
      SK: 'META',
      conversationId,
      participants,
      createdAt: timestamp,
      entityType: 'CONVERSATION',
    }

    await this.putItem(conversation)

    // Create user-conversation links for each participant
    for (const userId of participants) {
      const link = {
        PK: `${PREFIX.USER}${userId}`,
        SK: `${PREFIX.CONV}${conversationId}`,
        conversationId,
        createdAt: timestamp,
        entityType: 'USER_CONVERSATION',
      }
      await this.putItem(link)
    }

    return conversation
  }

  /**
   * Get conversation metadata
   * @param {string} conversationId
   * @returns {Promise<Conversation|null>}
   */
  async getConversation(conversationId) {
    const key = keys.conversationMeta(conversationId)
    return this.getItem(key)
  }

  /**
   * List conversations for a user
   * @param {string} userId
   * @param {Object} [options]
   * @returns {Promise<import('./base-repository').PaginatedResult>}
   */
  async listUserConversations(userId, options = {}) {
    return this.query({
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      expressionAttributeValues: {
        ':pk': `${PREFIX.USER}${userId}`,
        ':skPrefix': PREFIX.CONV,
      },
      limit: options.limit || 50,
      lastEvaluatedKey: options.lastEvaluatedKey,
      scanIndexForward: false, // Most recent first
    })
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId
   * @param {string} senderId
   * @param {string} content
   * @param {Object} [attachment]
   * @returns {Promise<Message>}
   */
  async createMessage(conversationId, senderId, content, attachment) {
    const timestamp = new Date().toISOString()
    const messageId = `${timestamp}#${uuidv4()}`

    const message = {
      PK: `${PREFIX.CONV}${conversationId}`,
      SK: `${PREFIX.MSG}${messageId}`,
      messageId,
      conversationId,
      senderId,
      content,
      createdAt: timestamp,
      entityType: 'MESSAGE',
    }

    if (attachment) {
      message.attachmentKey = attachment.key
      message.attachmentType = attachment.type
    }

    await this.putItem(message)

    // Update conversation with last message info
    await this.updateConversationLastMessage(conversationId, content, timestamp)

    return message
  }

  /**
   * Update conversation with last message preview
   * @param {string} conversationId
   * @param {string} lastMessagePreview
   * @param {string} lastMessageAt
   * @returns {Promise<void>}
   */
  async updateConversationLastMessage(conversationId, lastMessagePreview, lastMessageAt) {
    const key = keys.conversationMeta(conversationId)
    const preview = lastMessagePreview.length > 100
      ? lastMessagePreview.substring(0, 100) + '...'
      : lastMessagePreview

    await this.updateItem(
      key,
      'SET lastMessagePreview = :preview, lastMessageAt = :timestamp',
      { ':preview': preview, ':timestamp': lastMessageAt }
    )
  }

  /**
   * List messages in a conversation
   * @param {string} conversationId
   * @param {Object} [options]
   * @returns {Promise<import('./base-repository').PaginatedResult>}
   */
  async listMessages(conversationId, options = {}) {
    return this.query({
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      filterExpression: 'attribute_not_exists(isDeleted) OR isDeleted = :false',
      expressionAttributeValues: {
        ':pk': `${PREFIX.CONV}${conversationId}`,
        ':skPrefix': PREFIX.MSG,
        ':false': false,
      },
      limit: options.limit || 50,
      lastEvaluatedKey: options.lastEvaluatedKey,
      scanIndexForward: options.ascending !== false, // Default ascending (oldest first)
    })
  }

  /**
   * Delete a message (soft delete)
   * @param {string} conversationId
   * @param {string} messageId
   * @returns {Promise<void>}
   */
  async deleteMessage(conversationId, messageId) {
    const key = keys.message(conversationId, messageId)
    const timestamp = new Date().toISOString()

    await this.updateItem(
      key,
      'SET isDeleted = :true, deletedAt = :deletedAt',
      { ':true': true, ':deletedAt': timestamp }
    )
  }

  /**
   * Check if user is participant in conversation
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isParticipant(conversationId, userId) {
    const conversation = await this.getConversation(conversationId)
    return conversation?.participants?.includes(userId) || false
  }

  /**
   * Mark conversation as read for a user
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async markAsRead(conversationId, userId) {
    const key = {
      PK: `${PREFIX.USER}${userId}`,
      SK: `${PREFIX.CONV}${conversationId}`,
    }
    const timestamp = new Date().toISOString()

    await this.updateItem(
      key,
      'SET lastReadAt = :timestamp',
      { ':timestamp': timestamp }
    )
  }
}

module.exports = { MessageRepository, messageRepository: new MessageRepository() }
