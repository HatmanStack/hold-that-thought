/**
 * Date Parser for Letter Migration
 * Extracts dates from letter content in various formats.
 */

const MONTHS = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
}

// Valid year range for letters
const MIN_YEAR = 1950
const MAX_YEAR = 2025

/**
 * Strip frontmatter from markdown content (helper for date extraction)
 * @param {string} content - Markdown content
 * @returns {string} Content without frontmatter
 */
function stripFrontmatterForParsing(content) {
  if (!content) return ''

  // Check if content starts with frontmatter delimiter
  if (!content.startsWith('---')) {
    return content
  }

  // Find the closing frontmatter delimiter
  const secondDelimiter = content.indexOf('---', 3)
  if (secondDelimiter === -1) {
    return content
  }

  // Return content after frontmatter, trimmed of leading whitespace
  return content.slice(secondDelimiter + 3).trimStart()
}

/**
 * Pad number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} size - Desired size
 * @returns {string} Padded number string
 */
function padZero(num, size = 2) {
  return String(num).padStart(size, '0')
}

/**
 * Validate and normalize a date
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null if invalid
 */
function normalizeDate(year, month, day) {
  // Basic bounds check
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  // Validate the actual date
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null // Invalid date (e.g., Feb 30)
  }

  return `${year}-${padZero(month)}-${padZero(day)}`
}

/**
 * Parse month name to number
 * @param {string} monthStr - Month name (full or abbreviated)
 * @returns {number|null} Month number (1-12) or null
 */
function parseMonth(monthStr) {
  if (!monthStr) return null
  const normalized = monthStr.toLowerCase().replace(/\.$/, '') // Remove trailing period
  return MONTHS[normalized] || null
}

/**
 * Extract date from frontmatter 'created' field
 * @param {string} content - Full markdown content
 * @returns {string|null} ISO date string or null
 */
function extractDateFromFrontmatter(content) {
  if (!content || !content.startsWith('---')) return null

  const secondDelimiter = content.indexOf('---', 3)
  if (secondDelimiter === -1) return null

  const frontmatter = content.slice(3, secondDelimiter)

  // Look for created: 'YYYY-MM-DD' or created: "YYYY-MM-DD" (allows single digit month/day)
  const match = frontmatter.match(/created:\s*['"]?(\d{4})-(\d{1,2})-(\d{1,2})['"]?/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    const day = parseInt(match[3])
    const normalized = normalizeDate(year, month, day)
    if (normalized) return normalized
  }

  return null
}

/**
 * Extract date from markdown content
 * First checks frontmatter 'created' field, then searches the first 10 lines
 * of body content for date patterns.
 *
 * Supported formats:
 * - Frontmatter: created: '2001-09-14'
 * - "Feb. 10. 2016" (abbreviated month with periods)
 * - "February 10, 2016" (full month name)
 * - "Feb 10, 2016" (abbreviated month without period)
 * - "2/10/2016" or "02/10/2016" (numeric US format)
 * - "10 February 2016" (European style)
 * - "2016-02-10" (ISO format)
 *
 * @param {string} content - Full markdown content including frontmatter
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null if no valid date found
 */
export function extractDate(content) {
  if (!content) return null

  // Try frontmatter first
  const frontmatterDate = extractDateFromFrontmatter(content)
  if (frontmatterDate) return frontmatterDate

  // Strip frontmatter and search body
  const body = stripFrontmatterForParsing(content)

  // Get first 10 lines only
  const lines = body.split('\n').slice(0, 10)
  const searchText = lines.join('\n')

  // Date patterns to try (in order of specificity)
  const patterns = [
    // ISO format: 2016-02-10
    {
      regex: /(\d{4})-(\d{2})-(\d{2})/,
      extract: (m) => ({ year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]) })
    },
    // Month name with date range: February 10-15, 2016 (use start date)
    {
      regex: /([A-Za-z]{3,9})\.?\s*(\d{1,2})\s*-\s*\d{1,2}[\.\,]?\s*(\d{4})/,
      extract: (m) => {
        const month = parseMonth(m[1])
        return month ? { year: parseInt(m[3]), month, day: parseInt(m[2]) } : null
      }
    },
    // Abbreviated month with periods: Feb. 10. 2016
    {
      regex: /([A-Za-z]{3,9})\.?\s*(\d{1,2})[\.\,]?\s*(\d{4})/,
      extract: (m) => {
        const month = parseMonth(m[1])
        return month ? { year: parseInt(m[3]), month, day: parseInt(m[2]) } : null
      }
    },
    // Numeric US format: 2/10/2016 or 02/10/2016
    {
      regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      extract: (m) => ({ year: parseInt(m[3]), month: parseInt(m[1]), day: parseInt(m[2]) })
    },
    // European style: 10 February 2016
    {
      regex: /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
      extract: (m) => {
        const month = parseMonth(m[2])
        return month ? { year: parseInt(m[3]), month, day: parseInt(m[1]) } : null
      }
    },
  ]

  for (const { regex, extract } of patterns) {
    const match = searchText.match(regex)
    if (match) {
      const parsed = extract(match)
      if (parsed) {
        const normalized = normalizeDate(parsed.year, parsed.month, parsed.day)
        if (normalized) {
          return normalized
        }
      }
    }
  }

  return null
}

/**
 * Validate that a date string is within the acceptable range
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {boolean} True if date is valid and within range
 */
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const day = parseInt(match[3])

  // Check year range
  if (year < MIN_YEAR || year > MAX_YEAR) return false

  // Validate actual date
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
