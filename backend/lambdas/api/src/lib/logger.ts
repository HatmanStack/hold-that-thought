/**
 * Structured logging utilities
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
}

function formatLog(level: LogLevel, message: string, data?: unknown): string {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  }

  if (data !== undefined) {
    entry.data = data
  }

  return JSON.stringify(entry)
}

export const log = {
  debug(message: string, data?: unknown): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(formatLog('debug', message, data))
    }
  },

  info(message: string, data?: unknown): void {
    console.log(formatLog('info', message, data))
  },

  warn(message: string, data?: unknown): void {
    console.warn(formatLog('warn', message, data))
  },

  error(message: string, data?: unknown): void {
    console.error(formatLog('error', message, data))
  },
}
