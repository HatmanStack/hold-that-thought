/**
 * DynamoDB key builders for single-table design
 * @module lib/keys
 */
const { PREFIX } = require('./prefixes')

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

  // Draft: PK=DRAFT#<draftId>, SK=METADATA
  draft: (draftId) => ({
    PK: `${PREFIX.DRAFT}${draftId}`,
    SK: 'METADATA',
  }),
}

module.exports = {
  keys,
  PREFIX, // Re-export for convenience
}
