import { contentService } from '$lib/services/content-service'
import { error } from '@sveltejs/kit'

export async function loadRouteContent(routePath: string) {
  try {
    const s3Key = `${routePath.slice(1)}/+page.svelte.md`
    const content = await contentService.getContent(s3Key)

    const frontmatterMatch = content.match(/^---([\s\S]*?)---([\s\S]*)$/)

    if (!frontmatterMatch) {
      return {
        frontmatter: {},
        content: content.trim(),
        raw: content,
      }
    }

    const frontmatterText = frontmatterMatch[1].trim()
    const bodyContent = frontmatterMatch[2].trim()

    const frontmatter: Record<string, unknown> = {}
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
  catch {
    throw error(404, `Content not found: ${routePath}`)
  }
}

export async function getContentMetadata(prefix: string = '') {
  const items = await contentService.listContent(prefix)

  const metadata = await Promise.all(
    items
      .filter(item => item.key.endsWith('+page.svelte.md'))
      .map(async (item) => {
        try {
          const routePath = `/${item.key.replace('/+page.svelte.md', '')}`
          const content = await contentService.getContent(item.key)

          const frontmatterMatch = content.match(/^---([\s\S]*?)---/)
          const frontmatter: Record<string, unknown> = {}

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
            title: (frontmatter.title as string) || routePath.split('/').pop() || 'Untitled',
            date: (frontmatter.date as string) || item.lastModified,
            lastModified: item.lastModified,
            size: item.size,
            frontmatter,
          }
        }
        catch {
          return null
        }
      }),
  )

  return metadata.filter(item => item !== null)
}
