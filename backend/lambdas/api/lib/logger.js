// @ts-check
/**
 * Structured logging for Lambda functions
 * @module lib/logger
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const levels = { error: 0, warn: 1, info: 2, debug: 3 }

const shouldLog = level => levels[level] <= levels[LOG_LEVEL]

const formatLog = (level, msg, data = {}) => JSON.stringify({
  level,
  msg,
  ...data,
  ts: Date.now(),
})

const log = {
  error: (msg, data = {}) => shouldLog('error') && console.error(formatLog('error', msg, data)),
  warn: (msg, data = {}) => shouldLog('warn') && console.warn(formatLog('warn', msg, data)),
  info: (msg, data = {}) => shouldLog('info') && console.log(formatLog('info', msg, data)),
  debug: (msg, data = {}) => shouldLog('debug') && console.log(formatLog('debug', msg, data)),
}

module.exports = { log }
