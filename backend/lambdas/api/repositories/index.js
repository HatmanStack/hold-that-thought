// @ts-check
/**
 * Repository exports - centralized access to all repositories
 * @module repositories
 */
const { BaseRepository } = require('./base-repository')
const { CommentRepository, commentRepository } = require('./comment-repository')
const { UserRepository, userRepository } = require('./user-repository')
const { MessageRepository, messageRepository } = require('./message-repository')
const { ReactionRepository, reactionRepository } = require('./reaction-repository')

module.exports = {
  // Base class for custom repositories
  BaseRepository,

  // Repository classes (for custom instantiation)
  CommentRepository,
  UserRepository,
  MessageRepository,
  ReactionRepository,

  // Singleton instances (recommended for most use cases)
  commentRepository,
  userRepository,
  messageRepository,
  reactionRepository,
}
