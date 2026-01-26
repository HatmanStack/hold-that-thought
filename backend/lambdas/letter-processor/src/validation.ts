/**
 * Validation utilities for Gemini response parsing
 */
import type { ParsedLetterData, GeminiLetterResponse } from './types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_DATE = '1900-01-01'

/**
 * Validate a date string is in YYYY-MM-DD format
 */
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!DATE_PATTERN.test(value)) return false

  // Verify it's a real date
  const date = new Date(value)
  return !isNaN(date.getTime())
}

/**
 * Safely convert unknown value to string or null
 */
function toString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  return String(value)
}

/**
 * Safely convert unknown value to string array
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0)
}

/**
 * Validate and normalize Gemini response to ParsedLetterData
 *
 * Handles:
 * - Missing fields (uses null/defaults)
 * - Type coercion (numbers to strings)
 * - Field mapping (content -> transcription)
 * - Date format validation
 * - Array validation for tags
 */
export function validateAndNormalizeParsedData(
  raw: GeminiLetterResponse
): ParsedLetterData {
  // Validate and normalize date
  let date: string
  if (isValidDate(raw.date)) {
    date = raw.date
  } else if (typeof raw.date === 'string') {
    // Try to parse and reformat
    const parsed = new Date(raw.date)
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().split('T')[0]
    } else {
      console.warn(`Invalid date format: ${raw.date}, using default`)
      date = DEFAULT_DATE
    }
  } else {
    console.warn('Missing date, using default')
    date = DEFAULT_DATE
  }

  return {
    date,
    author: toString(raw.author),
    recipient: toString(raw.recipient),
    location: toString(raw.location),
    // Map 'content' from Gemini to 'transcription' in our schema
    transcription: toString(raw.content),
    summary: toString(raw.summary),
    tags: toStringArray(raw.tags),
  }
}
