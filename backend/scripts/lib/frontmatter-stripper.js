export function stripFrontmatter(content) {
  if (!content) return ''

  // Check if content starts with frontmatter delimiter
  if (!content.startsWith('---')) {
    return content
  }

  // Find the closing frontmatter delimiter (must be on its own line)
  // Look for \n---\n or \n--- at end of string
  const closingPattern = /\n---(\n|$)/
  const match = content.slice(3).match(closingPattern)

  if (!match) {
    // No valid closing delimiter found, return as-is
    return content
  }

  // Calculate position of content after frontmatter
  const closingIndex = 3 + match.index + match[0].length

  // Return content after frontmatter, trimmed of leading whitespace/newlines
  return content.slice(closingIndex).trimStart()
}

export function extractFrontmatter(content) {
  if (!content) return {}

  // Check if content starts with frontmatter delimiter
  if (!content.startsWith('---')) {
    return {}
  }

  // Find the closing frontmatter delimiter
  const closingPattern = /\n---(\n|$)/
  const match = content.slice(3).match(closingPattern)

  if (!match) {
    return {}
  }

  // Extract frontmatter block (between delimiters)
  const frontmatterText = content.slice(4, 3 + match.index)

  // Simple YAML parsing for key: value pairs
  const result = {}
  const lines = frontmatterText.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue // Skip empty lines and comments

    // Match key: value pattern
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (key) {
      result[key] = value
    }
  }

  return result
}
