import { contentService } from '$lib/services/content-service'
import { error } from '@sveltejs/kit'

/**
 * Load content for a SvelteKit route from S3
 */
export async function loadRouteContent(routePath: string) {
  try {
    // Convert route path to S3 key
    const s3Key = `${routePath.slice(1)}/+page.svelte.md`

    console.log('Loading route content for:', routePath, '-> S3 key:', s3Key)

    const content = await contentService.getContent(s3Key)

    // Parse frontmatter and content
    const frontmatterMatch = content.match(/^---([\s\S]*?)---([\s\S]*)$/)

    if (!frontmatterMatch) {
      // No frontmatter, treat entire content as body
      return {
        frontmatter: {},
        content: content.trim(),
        raw: content,
      }
    }

    const frontmatterText = frontmatterMatch[1].trim()
    const bodyContent = frontmatterMatch[2].trim()

    // Parse frontmatter (simple YAML-like parsing)
    const frontmatter: Record<string, any> = {}
    frontmatterText.split('\n').forEach((line) => {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '')
        frontmatter[key] = value
      }
    })

    return {
      frontmatter,
      content: bodyContent,
      raw: content,
    }
  }
  catch (err) {
    console.error('Error loading route content:', err)
    throw error(404, `Content not found: ${routePath}`)
  }
}

/**
 * Get metadata for all content items
 */
export async function getContentMetadata(prefix: string = '') {
  try {
    const items = await contentService.listContent(prefix)

    // Convert S3 keys to route paths and extract metadata
    const metadata = await Promise.all(
      items
        .filter(item => item.key.endsWith('+page.svelte.md'))
        .map(async (item) => {
          try {
            const routePath = `/${item.key.replace('/+page.svelte.md', '')}`
            const content = await contentService.getContent(item.key)

            // Extract frontmatter
            const frontmatterMatch = content.match(/^---([\s\S]*?)---/)
            const frontmatter: Record<string, any> = {}

            if (frontmatterMatch) {
              frontmatterMatch[1].trim().split('\n').forEach((line) => {
                const colonIndex = line.indexOf(':')
                if (colonIndex > 0) {
                  const key = line.substring(0, colonIndex).trim()
                  const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '')
                  frontmatter[key] = value
                }
              })
            }

            return {
              path: routePath,
              title: frontmatter.title || routePath.split('/').pop() || 'Untitled',
              date: frontmatter.date || item.lastModified,
              lastModified: item.lastModified,
              size: item.size,
              frontmatter,
            }
          }
          catch (err) {
            console.warn('Error processing item:', item.key, err)
            return null
          }
        }),
    )

    return metadata.filter(item => item !== null)
  }
  catch (error) {
    console.error('Error getting content metadata:', error)
    throw error
  }
}
