/**
 * Barrel export for backwards compatibility
 * All utilities are now organized in lib/ modules
 *
 * @module utils
 *
 * Modules:
 * - lib/database.js   - DynamoDB client, table names, S3 config
 * - lib/prefixes.js   - Single-table key prefixes
 * - lib/keys.js       - DynamoDB key builders
 * - lib/responses.js  - HTTP response formatters
 * - lib/validation.js - Input validation helpers
 * - lib/rate-limit.js - Rate limiting logic
 * - lib/user.js       - User profile management
 */

// Re-export everything for backwards compatibility
module.exports = {
  // Database & config
  ...require('./lib/database'),

  // Key prefixes and builders
  ...require('./lib/prefixes'),
  ...require('./lib/keys'),

  // HTTP responses
  ...require('./lib/responses'),

  // Validation
  ...require('./lib/validation'),

  // Rate limiting
  ...require('./lib/rate-limit'),

  // User management
  ...require('./lib/user'),
}
