export function generateSlug(title, maxWords = 3) {
  if (!title) return ''

  return title
    .toLowerCase()
    // Remove apostrophes
    .replace(/'/g, '')
    // Replace special characters with spaces
    .replace(/[^a-z0-9\s-]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Split into words and take first N
    .split(' ')
    .slice(0, maxWords)
    // Join with hyphens
    .join('-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
}

export function generateUniqueFilename(date, title, existingDates) {
  // Try simple date-based name first
  if (!existingDates.has(date)) {
    existingDates.add(date)
    return {
      md: `${date}.md`,
      pdf: `${date}.pdf`
    }
  }

  // Collision! Generate slug from title
  const slug = generateSlug(title)
  const basePrefix = slug ? `${date}-${slug}` : `${date}-letter`

  // Check if slug-based name is also taken
  if (!existingDates.has(basePrefix)) {
    existingDates.add(basePrefix)
    return {
      md: `${basePrefix}.md`,
      pdf: `${basePrefix}.pdf`
    }
  }

  // Multiple collisions - append incrementing number
  let counter = 1
  let prefix = `${basePrefix}-${counter}`
  while (existingDates.has(prefix)) {
    counter++
    prefix = `${basePrefix}-${counter}`
  }

  existingDates.add(prefix)
  return {
    md: `${prefix}.md`,
    pdf: `${prefix}.pdf`
  }
}
